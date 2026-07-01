import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { extensionTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/** Generates (or retrieves) a long-lived API token for the Chrome extension. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.query.extensionTokens.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.userId, session.user.id),
  });

  if (existing) {
    await db
      .update(extensionTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(extensionTokens.userId, session.user.id));
    return NextResponse.json({ token: existing.token, email: session.user.email });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(extensionTokens).values({
    userId: session.user.id,
    token,
    lastUsedAt: new Date(),
  });

  return NextResponse.json({ token, email: session.user.email });
}
