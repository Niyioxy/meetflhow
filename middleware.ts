import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = ["/login", "/blog"];

// NextAuth's `database` session strategy can't be verified at the Edge
// (it requires a DB lookup), so middleware only does an optimistic check
// for the session cookie's presence. The dashboard layout (`auth()`,
// server-side) is what actually verifies and enforces the session.
const SESSION_COOKIE_NAMES = ["authjs.session-token", "__Secure-authjs.session-token"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic =
    pathname === "/" || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const hasSession = SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));

  if (!hasSession && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
