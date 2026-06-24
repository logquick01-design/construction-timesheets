import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId: string; id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId, id } = await context.params;
  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const notification = await prisma.siteNotification.findFirst({
    where: { id, siteId },
  });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.siteNotification.update({
    where: { id },
    data: { read: true },
  });

  return NextResponse.json({
    notification: {
      id: updated.id,
      read: updated.read,
    },
  });
}
