import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { canExportSite, getSession, getAccessibleSiteIds } from "@/lib/auth";
import { parseExcelOptions } from "@/lib/export-options";
import { prisma } from "@/lib/prisma";
import { endOfDay, formatDate, parseDateInput, startOfDay } from "@/lib/utils";

const TASK_TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
};

type ExcelColumnKey =
  | "category"
  | "task"
  | "reference"
  | "site"
  | "siteLocation"
  | "company"
  | "worker"
  | "trade"
  | "date"
  | "hours"
  | "comment";

const COLUMN_DEFS: Array<{
  key: ExcelColumnKey;
  header: string;
  width: number;
  option: keyof ReturnType<typeof parseExcelOptions>;
}> = [
  { key: "category", header: "Category", width: 22, option: "category" },
  { key: "task", header: "Task", width: 28, option: "task" },
  { key: "reference", header: "Cost Code Ref", width: 16, option: "reference" },
  { key: "site", header: "Site", width: 22, option: "site" },
  { key: "siteLocation", header: "Site Location", width: 22, option: "siteLocation" },
  { key: "company", header: "Company", width: 22, option: "company" },
  { key: "worker", header: "Worker Name", width: 24, option: "worker" },
  { key: "trade", header: "Trade", width: 18, option: "trade" },
  { key: "date", header: "Date", width: 14, option: "date" },
  { key: "hours", header: "Hours", width: 10, option: "hours" },
  { key: "comment", header: "Comment", width: 32, option: "comment" },
];

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const options = parseExcelOptions(searchParams);

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from and to dates required" }, { status: 400 });
  }

  const activeColumns = COLUMN_DEFS.filter((column) => options[column.option]);
  if (activeColumns.length === 0) {
    return NextResponse.json({ error: "Select at least one Excel column to export" }, { status: 400 });
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
      worker: { include: { company: true } },
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
  sheet.columns = activeColumns.map(({ key, header, width }) => ({ header, key, width }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };

  function buildRow(
    group: TaskGroup,
    entry: Entry | null,
    taskTotal?: number
  ): Partial<Record<ExcelColumnKey, string | number>> {
    const row: Partial<Record<ExcelColumnKey, string | number>> = {};

    if (options.category) row.category = group.task.category.name;
    if (options.task) row.task = group.task.name;
    if (options.reference) row.reference = group.task.reference;
    if (options.site) row.site = group.site.name;
    if (options.siteLocation) row.siteLocation = group.site.location;

    if (entry) {
      if (options.company) row.company = entry.worker.company?.name ?? "Unassigned";
      if (options.worker) row.worker = entry.worker.name;
      if (options.trade) row.trade = entry.worker.trade;
      if (options.date) row.date = formatDate(entry.date);
      if (options.hours) row.hours = entry.hours;
      if (options.comment) row.comment = entry.comment ?? "";
    } else if (taskTotal != null) {
      if (options.worker) row.worker = "Task Total";
      if (options.hours) row.hours = taskTotal;
    }

    return row;
  }

  for (const group of sortedTasks) {
    const sortedEntries = [...group.entries].sort((a, b) => {
      const byWorker = a.worker.name.localeCompare(b.worker.name);
      if (byWorker !== 0) return byWorker;
      return a.date.getTime() - b.date.getTime();
    });

    let taskTotal = 0;
    for (const e of sortedEntries) {
      taskTotal += e.hours;
      sheet.addRow(buildRow(group, e));
    }

    if (options.taskTotals) {
      const totalRow = sheet.addRow(buildRow(group, null, taskTotal));
      totalRow.font = { bold: true };
      totalRow.eachCell((cell) => {
        cell.fill = TASK_TOTAL_FILL;
      });
    }
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
