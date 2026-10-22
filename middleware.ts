import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// /share/[token] links are meant for people without an account (they carry
// their own password/expiry gate), and /privacy + /terms must be readable
// before signing up. /about and /contact are the trust pages a first-time
// visitor checks before creating an account.
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/blog",
  "/book",
  "/share",
  "/privacy",
  "/terms",
  "/about",
  "/contact",
  // Public marketing pages for each use case and integration.
  "/solutions",
  "/features",
];

// NextAuth's `database` session strategy can't be verified at the Edge
// (it requires a DB lookup), so middleware only does an optimistic check
// for the session cookie's presence. The dashboard layout (`auth()`,
// server-side) is what actually verifies and enforces the session.
const SESSION_COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/" ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const hasSession = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  // No "signed-in users skip /login" redirect here: the cookie may belong to
  // an expired session, and bouncing it to /dashboard (which verifies it and
  // sends it back to /login) loops forever. The login page does that check
  // itself with a verified session.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
