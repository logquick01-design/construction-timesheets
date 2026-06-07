import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManageSite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 });
  if (!canManageSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    where: { siteId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(companies);
}

const schema = z.object({
  id: z.string().optional(),
  siteId: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { id, siteId, name, active } = parsed.data;
  if (!canManageSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (id) {
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing || existing.siteId !== siteId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    const company = await prisma.company.update({
      where: { id },
      data: { name, active: active ?? true },
    });
    return NextResponse.json(company);
  }

  const company = await prisma.company.create({
    data: { name, siteId, active: active ?? true },
  }).catch(() => null);
  if (!company) {
    return NextResponse.json({ error: "A company with that name already exists on this site." }, { status: 400 });
  }
  return NextResponse.json(company);
}
