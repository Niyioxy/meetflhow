import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, extensionTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { signMobileToken } from "@/lib/mobile-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { googleToken } = body as { googleToken?: string };

    if (!googleToken) {
      return NextResponse.json({ error: "googleToken is required" }, { status: 400 });
    }

    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${googleToken}`
    );
    if (!res.ok) {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }

    const info = await res.json() as { email?: string; name?: string; picture?: string };
    if (!info.email) {
      return NextResponse.json({ error: "Could not retrieve email from token" }, { status: 401 });
    }

    let user = await db.query.users.findFirst({ where: eq(users.email, info.email) });

    if (!user) {
      const [created] = await db
        .insert(users)
        .values({ email: info.email, name: info.name ?? info.email, image: info.picture })
        .returning();
      user = created;
    }

    const token = await signMobileToken(user.id);

    const existing = await db.query.extensionTokens.findFirst({
      where: and(eq(extensionTokens.userId, user.id), eq(extensionTokens.name, "Mobile App")),
    });

    if (existing) {
      await db
        .update(extensionTokens)
        .set({ token, lastUsedAt: new Date() })
        .where(eq(extensionTokens.id, existing.id));
    } else {
      await db.insert(extensionTokens).values({
        userId: user.id,
        token,
        name: "Mobile App",
        lastUsedAt: new Date(),
      });
    }

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[mobile/auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
