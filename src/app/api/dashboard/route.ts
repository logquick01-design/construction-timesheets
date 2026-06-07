import { NextResponse } from "next/server";
import { getSession, getAccessibleSiteIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfDay, parseDateInput, startOfDay } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const categoryId = searchParams.get("categoryId");

  const access = await getAccessibleSiteIds(session);
  let siteFilter: { siteId?: string | { in: string[] } } = {};

  if (access !== "all") {
    if (siteId && !access.includes(siteId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    siteFilter = { siteId: siteId ?? { in: access } };
  } else if (siteId) {
    siteFilter = { siteId };
  }

  const now = new Date();
  const from = fromStr ? startOfDay(parseDateInput(fromStr)) : startOfDay(now);
  const to = toStr ? endOfDay(parseDateInput(toStr)) : endOfDay(now);

  let categoryFilter: { task?: { categoryId?: string; category?: { name: string } } } = {};
  if (categoryId) {
    const cat = await prisma.costCodeCategory.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });
    if (cat) {
      // When viewing all sites, filter by category name so every site's matching category is included.
      categoryFilter = siteId
        ? { task: { categoryId } }
        : { task: { category: { name: cat.name } } };
    }
  }

  const entries = await prisma.timesheetEntry.findMany({
    where: {
      ...siteFilter,
      date: { gte: from, lte: to },
      ...categoryFilter,
    },
    include: {
      worker: true,
      site: true,
      task: { include: { category: true } },
    },
  });

  const sites = await prisma.site.findMany({
    where: {
      active: true,
      ...(siteId
        ? { id: siteId }
        : access === "all"
          ? {}
          : { id: { in: access } }),
    },
    orderBy: { name: "asc" },
  });

  const categorySiteFilter =
    siteId ? { siteId } : access === "all" ? {} : { siteId: { in: access } };

  const categoryRecords = await prisma.costCodeCategory.findMany({
    where: { active: true, ...categorySiteFilter },
    orderBy: { sortOrder: "asc" },
  });

  // Categories are site-scoped, so the same name can appear on multiple sites.
  // Collapse to distinct names for the cross-site chart series.
  const seenCategoryNames = new Set<string>();
  const categories: { id: string; name: string }[] = [];
  for (const c of categoryRecords) {
    if (seenCategoryNames.has(c.name)) continue;
    seenCategoryNames.add(c.name);
    categories.push({ id: c.id, name: c.name });
  }

  const totalBySite: Record<string, number> = {};
  const categoryBySite: Record<string, Record<string, number>> = {};
  const byWorker: Record<string, { name: string; hours: number }> = {};
  const byTask: Record<string, { name: string; reference: string; hours: number }> = {};

  for (const e of entries) {
    totalBySite[e.siteId] = (totalBySite[e.siteId] ?? 0) + e.hours;

    if (!categoryBySite[e.siteId]) categoryBySite[e.siteId] = {};
    const catName = e.task.category.name;
    categoryBySite[e.siteId][catName] =
      (categoryBySite[e.siteId][catName] ?? 0) + e.hours;

    byWorker[e.workerId] = {
      name: e.worker.name,
      hours: (byWorker[e.workerId]?.hours ?? 0) + e.hours,
    };

    byTask[e.taskId] = {
      name: e.task.name,
      reference: e.task.reference,
      hours: (byTask[e.taskId]?.hours ?? 0) + e.hours,
    };
  }

  const chartData = sites.map((s) => {
    const row: Record<string, string | number> = { site: s.name, siteId: s.id };
    for (const c of categories) {
      row[c.name] = categoryBySite[s.id]?.[c.name] ?? 0;
    }
    row.total = totalBySite[s.id] ?? 0;
    return row;
  });

  return NextResponse.json({
    sites,
    categories,
    totalBySite,
    chartData,
    workers: Object.values(byWorker).sort((a, b) => b.hours - a.hours),
    tasks: Object.values(byTask).sort((a, b) => b.hours - a.hours),
    grandTotal: entries.reduce((s, e) => s + e.hours, 0),
  });
}
