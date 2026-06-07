import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManageData } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORY_NAMES } from "@/lib/site-defaults";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session || !canManageData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(sites);
}

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  location: z.string().min(1),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !canManageData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { id, name, location, active } = parsed.data;
  if (id) {
    const site = await prisma.site.update({
      where: { id },
      data: { name, location, active: active ?? true },
    });
    return NextResponse.json(site);
  }
  const site = await prisma.$transaction(async (tx) => {
    const created = await tx.site.create({
      data: { name, location, active: active ?? true },
    });
    await tx.costCodeCategory.createMany({
      data: DEFAULT_CATEGORY_NAMES.map((catName, i) => ({
        name: catName,
        sortOrder: i,
        siteId: created.id,
      })),
    });
    return created;
  });
  return NextResponse.json(site);
}
