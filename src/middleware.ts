import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "site_hours_session";
const PUBLIC = ["/login"];

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? "dev-secret-change-in-production-32chars-min"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/health") ||
    (!pathname.startsWith("/api") && pathname.includes("."))
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await jwtVerify(token, getSecret());
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (PUBLIC.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
