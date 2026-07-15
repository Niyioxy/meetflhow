import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createLiveCaptionToken } from "@/lib/deepgram/live-token";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { key, expiresAt } = await createLiveCaptionToken();
    return NextResponse.json({ key, expiresAt });
  } catch (error) {
    console.error("Failed to create live caption token", error);
    return NextResponse.json(
      { error: "Failed to create live caption token" },
      { status: 500 }
    );
  }
}
