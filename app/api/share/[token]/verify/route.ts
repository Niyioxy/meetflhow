import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySharePassword, unlockCookieName, unlockCookieValue } from "@/lib/shares";

const bodySchema = z.object({ password: z.string().min(1) });

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const valid = await verifySharePassword(params.token, parsed.data.password);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(unlockCookieName(params.token), unlockCookieValue(params.token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
