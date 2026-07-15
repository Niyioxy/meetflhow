import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { locales } from "@/i18n/config";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const language = body?.language;

  if (typeof language !== "string" || !locales.includes(language as (typeof locales)[number])) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }

  await db.update(users).set({ language }).where(eq(users.id, session.user.id));

  return NextResponse.json({ language });
}
