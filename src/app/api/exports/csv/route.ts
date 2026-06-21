import { NextResponse } from "next/server";
import { canExportSite, getSession, getAccessibleSiteIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfDay, formatDate, parseDateInput, startOfDay } from "@/lib/utils";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from and to dates required" }, { status: 400 });
  }

  if (siteId && !canExportSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const access = await getAccessibleSiteIds(session);
  if (access !== "all" && !siteId) {
    return NextResponse.json(
      { error: "Site managers must select a site for export" },
      { status: 400 }
    );
  }

  const from = startOfDay(parseDateInput(fromStr));
  const to = endOfDay(parseDateInput(toStr));

  let siteFilter: { siteId?: string | { in: string[] } } = {};
  if (siteId) siteFilter = { siteId };
  else if (access !== "all") siteFilter = { siteId: { in: access } };

  const entries = await prisma.timesheetEntry.findMany({
    where: { ...siteFilter, date: { gte: from, lte: to } },
    include: {
      worker: true,
      site: true,
      task: { include: { category: true } },
    },
    orderBy: [{ date: "asc" }, { worker: { name: "asc" } }],
  });

  const header =
    "Worker Name,Site,Category,Task,Cost Code Ref,Date,Hours,Comment";
  const rows = entries.map((e) => {
    const date = formatDate(e.date);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      esc(e.worker.name),
      esc(e.site.name),
      esc(e.task.category.name),
      esc(e.task.name),
      esc(e.task.reference),
      date,
      e.hours.toString(),
      esc(e.comment ?? ""),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `payroll-${fromStr}-to-${toStr}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
