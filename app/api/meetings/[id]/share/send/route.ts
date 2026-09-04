import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { sendMeetingRecapEmail } from "@/lib/meeting-recap";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  try {
    await sendMeetingRecapEmail(params.id, session.user.id, parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to send meeting recap", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send recap" },
      { status: 500 }
    );
  }
}
