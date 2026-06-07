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

  const categories = await prisma.costCodeCategory.findMany({
    where: { siteId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(categories);
}

const schema = z.object({
  id: z.string().optional(),
  siteId: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().optional(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { id, siteId, name, sortOrder, active } = parsed.data;
  if (!canManageSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (id) {
    const existing = await prisma.costCodeCategory.findUnique({ where: { id } });
    if (!existing || existing.siteId !== siteId) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    const cat = await prisma.costCodeCategory.update({
      where: { id },
      data: { name, sortOrder, active },
    });
    return NextResponse.json(cat);
  }

  const max = await prisma.costCodeCategory.aggregate({
    where: { siteId },
    _max: { sortOrder: true },
  });
  const cat = await prisma.costCodeCategory.create({
    data: {
      name,
      siteId,
      sortOrder: sortOrder ?? (max._max.sortOrder ?? 0) + 1,
      active: active ?? true,
    },
  });
  return NextResponse.json(cat);
}
