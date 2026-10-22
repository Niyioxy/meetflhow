import { NextResponse } from "next/server";
import { z } from "zod";
import { getMobileUser } from "@/lib/mobile-auth";
import { createMobileUploadRequest, isValidLocalRecordingId } from "@/lib/mobile-upload";

export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().refine(isValidLocalRecordingId, "Invalid recording id"),
});

// Hands the phone a short-lived, user-scoped request for uploading one
// recording straight to Blob storage. See lib/mobile-upload.ts.
export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid recording id is required" }, { status: 400 });
  }

  try {
    return NextResponse.json({ upload: await createMobileUploadRequest(user.id, parsed.data.id) });
  } catch (error) {
    console.error("Failed to create mobile upload request", error);
    return NextResponse.json({ error: "Failed to start upload" }, { status: 500 });
  }
}
