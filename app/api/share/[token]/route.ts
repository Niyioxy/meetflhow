import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPublicShare, unlockCookieName, unlockCookieValue } from "@/lib/shares";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const cookieStore = cookies();
  const unlocked =
    cookieStore.get(unlockCookieName(params.token))?.value === unlockCookieValue(params.token);

  const result = await getPublicShare(params.token, unlocked);
  if (!result) {
    return NextResponse.json({ error: "Share link not found" }, { status: 404 });
  }
  if (result.expired) {
    return NextResponse.json({ error: "This share link has expired" }, { status: 410 });
  }

  return NextResponse.json({ share: result.payload });
}
