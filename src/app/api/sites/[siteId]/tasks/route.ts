import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await context.params;
  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await prisma.costCodeTask.findMany({
    where: { siteId, active: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      reference: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(tasks);
}
