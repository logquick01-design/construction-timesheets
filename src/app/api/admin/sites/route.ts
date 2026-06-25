import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { canManageData } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORY_NAMES } from "@/lib/site-defaults";
import { mergeSiteFeatures, siteFeaturesSchema } from "@/lib/site-features";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session || !canManageData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(
    sites.map((site) => ({
      ...site,
      features: mergeSiteFeatures(site.features),
    }))
  );
}

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  location: z.string().min(1),
  active: z.boolean().optional(),
});

const featuresSchema = z.object({
  id: z.string(),
  features: siteFeaturesSchema,
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !canManageData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = featuresSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feature settings" }, { status: 400 });
  }

  const { id, features } = parsed.data;
  const existing = await prisma.site.findUnique({
    where: { id },
    select: { id: true, features: true },
  });

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const merged = siteFeaturesSchema.parse({
    ...mergeSiteFeatures(existing.features),
    ...features,
  });

  const site = await prisma.site.update({
    where: { id },
    data: { features: merged },
  });

  revalidatePath(`/sites/${id}`, "layout");

  return NextResponse.json({
    ...site,
    features: mergeSiteFeatures(site.features),
  });
}

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
    return NextResponse.json({
      ...site,
      features: mergeSiteFeatures(site.features),
    });
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
  return NextResponse.json({
    ...site,
    features: mergeSiteFeatures(site.features),
  });
}
