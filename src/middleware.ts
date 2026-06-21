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
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      try {
        await jwtVerify(token, getSecret());
        return NextResponse.redirect(new URL("/", request.url));
      } catch {
        /* stay on login */
      }
    }
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
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
