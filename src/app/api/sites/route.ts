import { NextResponse } from "next/server";
import { getSession, getAccessibleSiteIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleSiteIds(session);
  const sites = await prisma.site.findMany({
    where: {
      active: true,
      ...(access === "all" ? {} : { id: { in: access } }),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(sites);
}
