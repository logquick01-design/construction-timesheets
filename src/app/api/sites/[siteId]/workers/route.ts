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

  const workers = await prisma.worker.findMany({
    where: { siteId, active: true },
    include: {
      company: { select: { id: true, name: true } },
      person: { select: { id: true } },
    },
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
  });

  return NextResponse.json(
    workers.map((w) => ({
      id: w.id,
      name: w.name,
      trade: w.trade,
      personId: w.personId,
      company: w.company,
    }))
  );
}
