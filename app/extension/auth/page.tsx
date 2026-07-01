import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { extensionTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { ExtensionAuthClient } from "@/components/extension/extension-auth-client";

export default async function ExtensionAuthPage({
  searchParams,
}: {
  searchParams: { ext?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    const callbackUrl = `/extension/auth${searchParams.ext ? `?ext=${searchParams.ext}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const userId = session.user.id;

  let row = await db.query.extensionTokens.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.userId, userId),
  });

  if (!row) {
    const [created] = await db
      .insert(extensionTokens)
      .values({ userId, token: crypto.randomBytes(32).toString("hex"), lastUsedAt: new Date() })
      .returning();
    row = created;
  } else {
    await db.update(extensionTokens).set({ lastUsedAt: new Date() }).where(eq(extensionTokens.userId, userId));
  }

  return (
    <ExtensionAuthClient
      token={row.token}
      extensionId={searchParams.ext ?? null}
      userEmail={session.user.email ?? ""}
    />
  );
}
