import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVoiceProfile, deleteVoiceProfile } from "@/lib/voice-profile";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getVoiceProfile(session.user.id);
  if (!profile) {
    return NextResponse.json({ enrolled: false });
  }

  return NextResponse.json({
    enrolled: true,
    quality: profile.enrolmentQuality,
    sampleDurationSeconds: profile.sampleDurationSeconds,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteVoiceProfile(session.user.id);
  return NextResponse.json({ success: true });
}
