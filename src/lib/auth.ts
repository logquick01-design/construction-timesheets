import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { UserRole } from "@prisma/client";

const COOKIE_NAME = "site_hours_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  siteIds: string[];
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = payload.sub;
    if (!userId) return null;

    const user = await prisma.user.findFirst({
      where: { id: userId, active: true },
      include: { siteAssignments: true },
    });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      siteIds: user.siteAssignments.map((a) => a.siteId),
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function canAccessSite(session: SessionUser, siteId: string): boolean {
  if (session.role === "ADMIN" || session.role === "QS") return true;
  return session.siteIds.includes(siteId);
}

export function canExportSite(session: SessionUser, siteId: string | null): boolean {
  if (session.role === "ADMIN" || session.role === "QS") return true;
  if (!siteId) return false;
  return session.siteIds.includes(siteId);
}

export async function getAccessibleSiteIds(session: SessionUser): Promise<string[] | "all"> {
  if (session.role === "ADMIN" || session.role === "QS") return "all";
  return session.siteIds;
}

export async function getAccessibleSites(session: SessionUser) {
  const access = await getAccessibleSiteIds(session);
  return prisma.site.findMany({
    where: {
      active: true,
      ...(access === "all" ? {} : { id: { in: access } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, location: true },
  });
}
