import { NextResponse } from "next/server";
import { db } from "@/db";
import { extensionTokens, meetings, transcripts } from "@/db/schema";
import { runAllMeetingAnalyses, wordCount } from "@/lib/meetings";
import { transcribeAudio } from "@/lib/deepgram/transcribe";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;

// Simple in-memory rate limiter: max 5 uploads per token per hour.
// Note: resets per serverless instance — use Upstash/Redis for multi-instance limits.
const uploadLog = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function isRateLimited(token: string): boolean {
  const now = Date.now();
  const times = (uploadLog.get(token) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) return true;
  uploadLog.set(token, [...times, now]);
  return false;
}

async function getBearerToken(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const [scheme, token] = auth.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

export async function POST(req: Request) {
  const rawToken = await getBearerToken(req);
  if (!rawToken) {
    return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });
  }

  const tokenRow = await db.query.extensionTokens.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.token, rawToken),
  });
  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (isRateLimited(rawToken)) {
    return NextResponse.json({ error: "Rate limit exceeded — max 5 uploads/hour" }, { status: 429 });
  }

  await db
    .update(extensionTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionTokens.id, tokenRow.id));

  const form = await req.formData().catch(() => null);
  const audioFile = form?.get("audio");
  const platform = (form?.get("platform") as string | null) ?? "other";
  const title = (form?.get("title") as string | null) ?? "Extension Recording";

  if (!audioFile || typeof audioFile === "string") {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  // Create meeting record
  const [meeting] = await db
    .insert(meetings)
    .values({
      userId: tokenRow.userId,
      title: title.slice(0, 200),
      platform,
      status: "transcribing",
    })
    .returning();

  // Transcribe via Deepgram (reuse the shared helper)
  let transcriptionText = "";
  let durationSeconds: number | null = null;

  try {
    const transcription = await transcribeAudio(audioFile as File);
    transcriptionText = transcription.text;
    durationSeconds = transcription.durationSeconds;
  } catch (error) {
    console.error("Extension upload: transcription failed", error);
    await db.update(meetings).set({ status: "failed" }).where(eq(meetings.id, meeting.id));
    return NextResponse.json({ error: "Transcription failed", meetingId: meeting.id }, { status: 500 });
  }

  if (!transcriptionText) {
    await db.update(meetings).set({ status: "failed" }).where(eq(meetings.id, meeting.id));
    return NextResponse.json({ error: "No speech detected in recording", meetingId: meeting.id }, { status: 422 });
  }

  await db.insert(transcripts).values({
    meetingId: meeting.id,
    fullText: transcriptionText,
    wordCount: wordCount(transcriptionText),
  });

  if (durationSeconds) {
    await db.update(meetings).set({ durationSeconds }).where(eq(meetings.id, meeting.id));
  }

  try {
    await runAllMeetingAnalyses(meeting.id, transcriptionText);
    return NextResponse.json({ meetingId: meeting.id, status: "ready" });
  } catch {
    return NextResponse.json({ meetingId: meeting.id, status: "failed" }, { status: 500 });
  }
}
