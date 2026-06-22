import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { canExportSite, getSession, getAccessibleSiteIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endOfDay, formatDate, parseDateInput, startOfDay } from "@/lib/utils";

const TASK_TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
};

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
  });

  type Entry = (typeof entries)[number];
  type TaskGroup = {
    task: Entry["task"];
    site: Entry["site"];
    entries: Entry[];
  };

  const taskGroups = new Map<string, TaskGroup>();
  for (const e of entries) {
    let group = taskGroups.get(e.taskId);
    if (!group) {
      group = { task: e.task, site: e.site, entries: [] };
      taskGroups.set(e.taskId, group);
    }
    group.entries.push(e);
  }

  const sortedTasks = [...taskGroups.values()].sort((a, b) => {
    const catA = a.task.category;
    const catB = b.task.category;
    if (catA.sortOrder !== catB.sortOrder) return catA.sortOrder - catB.sortOrder;
    const byCategory = catA.name.localeCompare(catB.name);
    if (byCategory !== 0) return byCategory;
    return a.task.name.localeCompare(b.task.name);
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Payroll");
  sheet.columns = [
    { header: "Category", key: "category", width: 22 },
    { header: "Task", key: "task", width: 28 },
    { header: "Cost Code Ref", key: "reference", width: 16 },
    { header: "Site", key: "site", width: 22 },
    { header: "Worker Name", key: "worker", width: 24 },
    { header: "Date", key: "date", width: 14 },
    { header: "Hours", key: "hours", width: 10 },
    { header: "Comment", key: "comment", width: 32 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  for (const group of sortedTasks) {
    const sortedEntries = [...group.entries].sort((a, b) => {
      const byWorker = a.worker.name.localeCompare(b.worker.name);
      if (byWorker !== 0) return byWorker;
      return a.date.getTime() - b.date.getTime();
    });

    let taskTotal = 0;
    for (const e of sortedEntries) {
      taskTotal += e.hours;
      sheet.addRow({
        category: group.task.category.name,
        task: group.task.name,
        reference: group.task.reference,
        site: group.site.name,
        worker: e.worker.name,
        date: formatDate(e.date),
        hours: e.hours,
        comment: e.comment ?? "",
      });
    }

    const totalRow = sheet.addRow({
      category: group.task.category.name,
      task: group.task.name,
      reference: group.task.reference,
      site: group.site.name,
      worker: "Task Total",
      date: "",
      hours: taskTotal,
      comment: "",
    });
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = TASK_TOTAL_FILL;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `payroll-${fromStr}-to-${toStr}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
