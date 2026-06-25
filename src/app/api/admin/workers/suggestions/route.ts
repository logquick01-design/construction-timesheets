import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManageSite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function normalizeCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const companyId = searchParams.get("companyId");
  if (!siteId || !companyId) {
    return NextResponse.json({ error: "siteId and companyId required" }, { status: 400 });
  }
  if (!canManageSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, siteId: true },
  });
  if (!company || company.siteId !== siteId) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const normalizedName = normalizeCompanyName(company.name);

  const siblingCompanies = await prisma.company.findMany({
    where: { siteId: { not: siteId }, active: true },
    select: { id: true, name: true },
  });
  const siblingCompanyIds = siblingCompanies
    .filter((c) => normalizeCompanyName(c.name) === normalizedName)
    .map((c) => c.id);

  if (siblingCompanyIds.length === 0) {
    return NextResponse.json([]);
  }

  const workers = await prisma.worker.findMany({
    where: {
      companyId: { in: siblingCompanyIds },
      active: true,
    },
    include: {
      person: { select: { id: true, name: true } },
      company: { select: { name: true } },
      site: { select: { name: true } },
    },
    orderBy: [{ site: { name: "asc" } }, { name: "asc" }],
  });

  const existingPersonIds = new Set(
    (
      await prisma.worker.findMany({
        where: { siteId, companyId, personId: { not: null } },
        select: { personId: true },
      })
    )
      .map((w) => w.personId)
      .filter(Boolean) as string[]
  );

  const seen = new Set<string>();
  const suggestions = [];

  for (const worker of workers) {
    const personId = worker.personId;
    if (personId && existingPersonIds.has(personId)) continue;

    const key = personId ?? `${worker.name.toLowerCase()}|${worker.trade.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      name: worker.name,
      trade: worker.trade,
      personId: worker.personId,
      personName: worker.person?.name ?? worker.name,
      siteName: worker.site.name,
      companyName: worker.company?.name ?? company.name,
    });
  }

  return NextResponse.json(suggestions);
}
