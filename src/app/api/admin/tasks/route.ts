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

  const tasks = await prisma.costCodeTask.findMany({
    where: { siteId },
    orderBy: { name: "asc" },
    include: { category: true },
  });
  return NextResponse.json(tasks);
}

const schema = z.object({
  id: z.string().optional(),
  siteId: z.string().min(1),
  name: z.string().min(1),
  reference: z.string().min(1),
  categoryId: z.string().min(1),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { id, siteId, name, reference, categoryId, active } = parsed.data;
  if (!canManageSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const category = await prisma.costCodeCategory.findUnique({ where: { id: categoryId } });
  if (!category || category.siteId !== siteId) {
    return NextResponse.json({ error: "Category not found for this site" }, { status: 400 });
  }

  if (id) {
    const existing = await prisma.costCodeTask.findUnique({ where: { id } });
    if (!existing || existing.siteId !== siteId) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const task = await prisma.costCodeTask.update({
      where: { id },
      data: { name, reference, categoryId, active },
      include: { category: true },
    });
    return NextResponse.json(task);
  }

  const task = await prisma.costCodeTask.create({
    data: { name, reference, siteId, categoryId, active: active ?? true },
    include: { category: true },
  });
  return NextResponse.json(task);
}
