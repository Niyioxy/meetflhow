import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { supportedLanguageEnum } from "@/db/schema";
import { translateUtterance } from "@/lib/gemini/translate-utterance";

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
  target_language: z.enum(supportedLanguageEnum),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const translated = await translateUtterance(
      parsed.data.text,
      parsed.data.target_language
    );
    return NextResponse.json({ translated });
  } catch (error) {
    console.error("Live utterance translation failed", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
