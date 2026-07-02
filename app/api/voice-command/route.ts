import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { createClient } from "@deepgram/sdk";

const WAKE_PHRASE = "hey meetflhow";

const COMMAND_PATTERNS: Array<{ pattern: RegExp; command: string; description: string }> = [
  { pattern: /start recording/i, command: "START_RECORDING", description: "Starting recording" },
  { pattern: /stop recording/i, command: "STOP_RECORDING", description: "Stopping and saving" },
  { pattern: /pause/i, command: "PAUSE_RECORDING", description: "Pausing recording" },
  { pattern: /resume/i, command: "RESUME_RECORDING", description: "Resuming recording" },
  { pattern: /open meetings/i, command: "NAVIGATE_MEETINGS", description: "Opening meetings" },
  { pattern: /open tasks/i, command: "NAVIGATE_TASKS", description: "Opening tasks" },
  { pattern: /what.?s my score/i, command: "READ_SCORE", description: "Reading your last score" },
  { pattern: /add task (.+)/i, command: "ADD_TASK", description: "Adding task" },
];

function matchCommand(text: string): { command: string; description: string; payload?: string } | null {
  for (const { pattern, command, description } of COMMAND_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return { command, description, payload: match[1] };
    }
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const audio = formData.get("audio");
  const duration = Number(formData.get("duration") ?? 0);

  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ command: null, confidence: 0 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ command: null, confidence: 0, error: "Deepgram not configured" });
  }

  try {
    const deepgram = createClient(apiKey);
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { result } = await deepgram.listen.prerecorded.transcribeFile(buffer, {
      model: "nova-2",
      language: "en",
      smart_format: false,
    });

    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.toLowerCase() ?? "";

    if (!transcript.includes(WAKE_PHRASE)) {
      return NextResponse.json({ command: null, confidence: 0, transcript });
    }

    const afterWake = transcript.split(WAKE_PHRASE).slice(1).join("").trim();
    const matched = matchCommand(afterWake);

    if (!matched) {
      return NextResponse.json({
        command: null,
        confidence: 0.5,
        transcript,
        hint: "Try: start recording, stop recording, open meetings, open tasks, what's my score",
      });
    }

    return NextResponse.json({
      command: matched.command,
      confidence: 0.9,
      description: matched.description,
      payload: matched.payload ?? null,
      transcript,
    });
  } catch (err) {
    console.error("[voice-command]", err);
    return NextResponse.json({ command: null, confidence: 0 });
  }
}
