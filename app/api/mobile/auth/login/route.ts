import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, extensionTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { signMobileToken } from "@/lib/mobile-auth";

// Public OAuth client IDs the mobile app signs in with (see mobile/app.json).
// Override with a comma-separated MOBILE_GOOGLE_CLIENT_IDS if they change.
const DEFAULT_MOBILE_CLIENT_IDS = [
  "837008785051-ddahv7kook9blsif2u2pa4m64lbdo9fb.apps.googleusercontent.com",
  "837008785051-d2065i04dpucdh79ujgbp34au8o5dq98.apps.googleusercontent.com",
];

function allowedAudiences(): Set<string> {
  const configured = process.env.MOBILE_GOOGLE_CLIENT_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
  const ids = configured?.length ? configured : DEFAULT_MOBILE_CLIENT_IDS;
  return new Set(ids);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { googleToken } = body as { googleToken?: string };

    if (!googleToken) {
      return NextResponse.json({ error: "googleToken is required" }, { status: 400 });
    }

    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${encodeURIComponent(googleToken)}`
    );
    if (!res.ok) {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }

    const info = await res.json() as {
      aud?: string;
      iss?: string;
      exp?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
    };

    // tokeninfo validates any Google ID token, including ones minted for other
    // apps — so the audience must be one of our own OAuth clients.
    if (!info.aud || !allowedAudiences().has(info.aud)) {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }
    if (info.iss !== "accounts.google.com" && info.iss !== "https://accounts.google.com") {
      return NextResponse.json({ error: "Invalid Google token" }, { status: 401 });
    }
    if (!info.exp || Number(info.exp) * 1000 <= Date.now()) {
      return NextResponse.json({ error: "Google token expired" }, { status: 401 });
    }
    if (!info.email) {
      return NextResponse.json({ error: "Could not retrieve email from token" }, { status: 401 });
    }
    if (info.email_verified !== true && info.email_verified !== "true") {
      return NextResponse.json({ error: "Google email is not verified" }, { status: 401 });
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
