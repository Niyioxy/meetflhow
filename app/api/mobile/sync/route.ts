import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { db } from "@/db";
import { meetings } from "@/db/schema";

interface OfflineRecording {
  id: string;
  title: string;
  platform: string;
  recorded_at: string;
  duration: number;
  audio_base64: string;
}

export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { recordings: OfflineRecording[] };
  const { recordings } = body;

  if (!Array.isArray(recordings) || recordings.length === 0) {
    return NextResponse.json({ error: "recordings array required" }, { status: 400 });
  }

  const results: { localId: string; meetingId: string; status: string }[] = [];

  for (const rec of recordings) {
    try {
      const audioBuffer = Buffer.from(rec.audio_base64, "base64");
      const blob = new Blob([audioBuffer], { type: "audio/m4a" });

      const [meeting] = await db
        .insert(meetings)
        .values({
          userId: user.id,
          title: rec.title || "Offline Recording",
          platform: rec.platform || "other",
          durationSeconds: rec.duration,
          status: "uploading",
        })
        .returning();

      const formData = new FormData();
      formData.append("file", blob, `${meeting.id}.m4a`);
      formData.append("meetingId", meeting.id);

      const uploadUrl = `${process.env.NEXTAUTH_URL}/api/meetings/upload`;
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${request.headers.get("authorization")?.slice(7)}` },
        body: formData,
      });

      results.push({
        localId: rec.id,
        meetingId: meeting.id,
        status: uploadRes.ok ? "queued" : "upload_failed",
      });
    } catch {
      results.push({ localId: rec.id, meetingId: "", status: "error" });
    }
  }

  return NextResponse.json({ results });
}
