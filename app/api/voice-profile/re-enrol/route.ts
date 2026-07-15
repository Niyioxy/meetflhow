import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { enrolAndSave } from "@/lib/voice-profile";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const consent = formData.get("consent") === "true";
  const durationSeconds = Number(formData.get("durationSeconds") ?? 0);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: "Consent is required to enrol a voice profile" }, { status: 400 });
  }

  try {
    const audioBuffer = Buffer.from(await file.arrayBuffer());
    const result = await enrolAndSave(session.user.id, audioBuffer, durationSeconds, new Date());
    return NextResponse.json(result);
  } catch (error) {
    console.error("Voice re-enrolment failed", error);
    return NextResponse.json({ error: "Failed to process recording" }, { status: 500 });
  }
}
