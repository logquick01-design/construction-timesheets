import { NextResponse } from "next/server";
import { canExportSite, getSession } from "@/lib/auth";
import {
  hasPdfDetailContent,
  hasPdfSummaryContent,
  parsePdfOptions,
  type ExcelExportOptions,
  type PdfSummaryOptions,
} from "@/lib/export-options";
import { prisma } from "@/lib/prisma";
import {
  eachDayInRange,
  endOfDay,
  formatDate,
  formatDisplayDate,
  parseDateInput,
  startOfDay,
} from "@/lib/utils";
import { jsPDF } from "jspdf";
import autoTable, { type CellDef } from "jspdf-autotable";

const REPORT_TITLE = "LogQ hours summary";
const ORGANISATION_HEADER = "INC Group";
const DETAIL_SECTION_TITLE = "Payroll detail";
const STATIC_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MARGIN = 14;
const COMPANY_COL_WIDTH = 72;
const STAFF_COL_WIDTH = 80;
const TOTAL_COL_WIDTH = 48;
const TASK_TOTAL_FILL: [number, number, number] = [255, 255, 0];

type WorkerHours = {
  workerName: string;
  companyName: string;
  hoursByDate: Map<string, number>;
};

type DetailEntry = {
  taskId: string;
  worker: { name: string; trade: string; company: { name: string } | null };
  site: { name: string; location: string };
  task: { name: string; reference: string; category: { name: string } };
  date: Date;
  hours: number;
  comment: string | null;
};

const DETAIL_COLUMN_DEFS: Array<{
  key: keyof ExcelExportOptions;
  header: string;
  getValue: (
    group: { task: DetailEntry["task"]; site: DetailEntry["site"] },
    entry: DetailEntry | null,
    taskTotal?: number
  ) => string | number;
}> = [
  {
    key: "category",
    header: "Category",
    getValue: (group) => group.task.category.name,
  },
  {
    key: "task",
    header: "Task",
    getValue: (group) => group.task.name,
  },
  {
    key: "reference",
    header: "Cost Code Ref",
    getValue: (group) => group.task.reference,
  },
  {
    key: "site",
    header: "Site",
    getValue: (group) => group.site.name,
  },
  {
    key: "siteLocation",
    header: "Site Location",
    getValue: (group) => group.site.location,
  },
  {
    key: "company",
    header: "Company",
    getValue: (_group, entry) => entry?.worker.company?.name ?? "Unassigned",
  },
  {
    key: "worker",
    header: "Worker",
    getValue: (_group, entry, taskTotal) =>
      entry ? entry.worker.name : taskTotal != null ? "Task Total" : "",
  },
  {
    key: "trade",
    header: "Trade",
    getValue: (_group, entry) => entry?.worker.trade ?? "",
  },
  {
    key: "date",
    header: "Date",
    getValue: (_group, entry) => (entry ? formatDate(entry.date) : ""),
  },
  {
    key: "hours",
    header: "Hours",
    getValue: (_group, entry, taskTotal) =>
      entry ? entry.hours : taskTotal != null ? taskTotal : "",
  },
  {
    key: "comment",
    header: "Comment",
    getValue: (_group, entry) => entry?.comment ?? "",
  },
];

function formatHours(hours: number): string {
  return hours.toFixed(1).replace(/\.0$/, "");
}

function workerTotal(worker: WorkerHours, dateKeys: string[]): number {
  return dateKeys.reduce((sum, dateKey) => sum + (worker.hoursByDate.get(dateKey) ?? 0), 0);
}

function addPageNumbers(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `-- ${i} of ${pageCount} --`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 12,
      { align: "center" }
    );
  }
}

function renderSummaryTable(
  doc: jsPDF,
  startY: number,
  summary: PdfSummaryOptions,
  workers: WorkerHours[],
  days: Date[],
  dateKeys: string[]
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = pageWidth - MARGIN * 2;
  const fixedWidth =
    (summary.company ? COMPANY_COL_WIDTH : 0) +
    (summary.staff ? STAFF_COL_WIDTH : 0) +
    (summary.totals ? TOTAL_COL_WIDTH : 0);
  const dayColWidth =
    summary.dailyBreakdown && days.length > 0 ? (tableWidth - fixedWidth) / days.length : 0;

  const headerRowSpan = summary.dailyBreakdown ? 2 : 1;
  const dateRow: CellDef[] = [];

  if (summary.company) {
    dateRow.push({ content: "company", rowSpan: headerRowSpan, styles: { valign: "middle" } });
  }
  if (summary.staff) {
    dateRow.push({ content: "Staff", rowSpan: headerRowSpan, styles: { valign: "middle" } });
  }
  if (summary.dailyBreakdown) {
    dateRow.push(
      ...days.map((d) => ({
        content: formatDisplayDate(d),
        styles: { halign: "center" as const, fontStyle: "bold" as const },
      }))
    );
  }
  if (summary.totals) {
    dateRow.push({
      content: "Total",
      rowSpan: headerRowSpan,
      styles: { halign: "center" as const, fontStyle: "bold" as const, valign: "middle" },
    });
  }

  const dayRow: CellDef[] = summary.dailyBreakdown
    ? STATIC_DAY_NAMES.slice(0, days.length).map((name) => ({
        content: name,
        styles: { halign: "center" as const, fontStyle: "bold" as const },
      }))
    : [];

  const body = workers.map((worker) => {
    const total = workerTotal(worker, dateKeys);
    const row: string[] = [];

    if (summary.company) row.push(worker.companyName);
    if (summary.staff) row.push(worker.workerName);
    if (summary.dailyBreakdown) {
      row.push(
        ...dateKeys.map((dateKey) => {
          const hours = worker.hoursByDate.get(dateKey);
          return hours != null ? formatHours(hours) : "";
        })
      );
    }
    if (summary.totals) row.push(total > 0 ? formatHours(total) : "");

    return row;
  });

  const columnStyles: Record<number, { cellWidth: number; halign?: "left" | "center" }> = {};
  let columnIndex = 0;

  if (summary.company) {
    columnStyles[columnIndex] = { cellWidth: COMPANY_COL_WIDTH, halign: "left" };
    columnIndex += 1;
  }
  if (summary.staff) {
    columnStyles[columnIndex] = { cellWidth: STAFF_COL_WIDTH, halign: "left" };
    columnIndex += 1;
  }
  if (summary.dailyBreakdown) {
    for (let i = 0; i < days.length; i++) {
      columnStyles[columnIndex + i] = { cellWidth: dayColWidth, halign: "center" };
    }
    columnIndex += days.length;
  }
  if (summary.totals) {
    columnStyles[columnIndex] = { cellWidth: TOTAL_COL_WIDTH, halign: "center" };
  }

  let tableEndY = startY;

  autoTable(doc, {
    startY,
    head: summary.dailyBreakdown ? [dateRow, dayRow] : [dateRow],
    body,
    theme: "grid",
    tableWidth,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      textColor: [0, 0, 0],
      font: "helvetica",
      fontSize: 10,
      cellPadding: 5,
      overflow: "linebreak",
      lineColor: [120, 120, 120],
      lineWidth: 0.5,
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: {
      minCellHeight: 22,
    },
    columnStyles,
    didDrawPage: (data) => {
      if (data.cursor) {
        tableEndY = data.cursor.y;
      }
    },
  });

  return tableEndY;
}

function renderDetailTable(
  doc: jsPDF,
  startY: number,
  detail: ExcelExportOptions,
  entries: DetailEntry[]
) {
  const activeColumns = DETAIL_COLUMN_DEFS.filter((column) => detail[column.key]);
  if (activeColumns.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = pageWidth - MARGIN * 2;
  const columnWidth = tableWidth / activeColumns.length;

  type TaskGroup = {
    task: DetailEntry["task"];
    site: DetailEntry["site"];
    entries: DetailEntry[];
  };

  const taskGroups = new Map<string, TaskGroup>();
  for (const entry of entries) {
    let group = taskGroups.get(entry.taskId);
    if (!group) {
      group = { task: entry.task, site: entry.site, entries: [] };
      taskGroups.set(entry.taskId, group);
    }
    group.entries.push(entry);
  }

  const sortedGroups = [...taskGroups.values()].sort((a, b) => {
    const catA = a.task.category;
    const catB = b.task.category;
    const byCategory = catA.name.localeCompare(catB.name);
    if (byCategory !== 0) return byCategory;
    return a.task.name.localeCompare(b.task.name);
  });

  const head = [activeColumns.map((column) => column.header)];
  const body: string[][] = [];

  for (const group of sortedGroups) {
    const sortedEntries = [...group.entries].sort((a, b) => {
      const byWorker = a.worker.name.localeCompare(b.worker.name);
      if (byWorker !== 0) return byWorker;
      return a.date.getTime() - b.date.getTime();
    });

    let taskTotal = 0;
    for (const entry of sortedEntries) {
      taskTotal += entry.hours;
      body.push(
        activeColumns.map((column) => String(column.getValue(group, entry)))
      );
    }

    if (detail.taskTotals) {
      body.push(
        activeColumns.map((column) =>
          String(column.getValue(group, null, taskTotal))
        )
      );
    }
  }

  let tableEndY = startY;

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    tableWidth,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      textColor: [0, 0, 0],
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
      lineColor: [120, 120, 120],
      lineWidth: 0.5,
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      minCellHeight: 18,
    },
    columnStyles: Object.fromEntries(
      activeColumns.map((_, index) => [index, { cellWidth: columnWidth }])
    ),
    didParseCell(data) {
      if (!detail.taskTotals || data.section !== "body") return;
      const row = body[data.row.index];
      if (!row) return;
      const workerIndex = activeColumns.findIndex((column) => column.key === "worker");
      if (workerIndex >= 0 && row[workerIndex] === "Task Total") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = TASK_TOTAL_FILL;
      }
    },
    didDrawPage: (data) => {
      if (data.cursor) {
        tableEndY = data.cursor.y;
      }
    },
  });

  return tableEndY;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const options = parsePdfOptions(searchParams);

  if (!siteId || !fromStr || !toStr) {
    return NextResponse.json({ error: "siteId, from, to required" }, { status: 400 });
  }

  const includeSummary = hasPdfSummaryContent(options.summary);
  const includeDetail = hasPdfDetailContent(options.detail);

  if (!includeSummary && !includeDetail) {
    return NextResponse.json(
      { error: "Select at least one PDF summary or payroll detail field to export" },
      { status: 400 }
    );
  }

  if (includeDetail) {
    const activeDetailColumns = DETAIL_COLUMN_DEFS.filter((column) => options.detail[column.key]);
    if (activeDetailColumns.length === 0) {
      return NextResponse.json(
        { error: "Select at least one payroll detail column to export" },
        { status: 400 }
      );
    }
  }

  if (!canExportSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const from = startOfDay(parseDateInput(fromStr));
  const to = endOfDay(parseDateInput(toStr));
  const days = eachDayInRange(from, to);
  const dateKeys = days.map((d) => formatDate(d));

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text(REPORT_TITLE, MARGIN, 28);

  doc.setFontSize(12);
  doc.text(ORGANISATION_HEADER, MARGIN, 46);

  doc.setFontSize(11);
  const siteLine = options.summary.siteLocationHeader
    ? `Site: ${site.name} ( ${site.location} )`
    : `Site: ${site.name}`;
  doc.text(siteLine, MARGIN, 62);

  let nextY = 76;

  if (includeSummary) {
    const siteWorkers = await prisma.worker.findMany({
      where: { siteId, active: true },
      include: { company: true },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    });

    const summaryEntries = await prisma.timesheetEntry.findMany({
      where: { siteId, date: { gte: from, lte: to } },
      select: { workerId: true, date: true, hours: true },
    });

    const hoursByWorkerDate = new Map<string, number>();
    for (const entry of summaryEntries) {
      const key = `${entry.workerId}:${formatDate(entry.date)}`;
      hoursByWorkerDate.set(key, (hoursByWorkerDate.get(key) ?? 0) + entry.hours);
    }

    const workerRows: WorkerHours[] = siteWorkers.map((worker) => {
      const hoursByDate = new Map<string, number>();
      for (const dateKey of dateKeys) {
        const hours = hoursByWorkerDate.get(`${worker.id}:${dateKey}`);
        if (hours) hoursByDate.set(dateKey, hours);
      }
      return {
        workerName: worker.name,
        companyName: worker.company?.name ?? "Unassigned",
        hoursByDate,
      };
    });

    const workers =
      workerRows.filter((w) => w.hoursByDate.size > 0).length > 0
        ? workerRows.filter((w) => w.hoursByDate.size > 0)
        : workerRows;

    nextY = renderSummaryTable(doc, nextY, options.summary, workers, days, dateKeys) + 24;
  }

  if (includeDetail) {
    if (includeSummary) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(DETAIL_SECTION_TITLE, MARGIN, nextY);
      nextY += 16;
    }

    const detailEntries = await prisma.timesheetEntry.findMany({
      where: { siteId, date: { gte: from, lte: to } },
      include: {
        worker: { include: { company: true } },
        site: true,
        task: { include: { category: true } },
      },
    });

    renderDetailTable(doc, nextY, options.detail, detailEntries);
  }

  addPageNumbers(doc);

  const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
  const filename = `site-report-${site.name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "site"}.pdf`;

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
      "Cache-Control": "no-store",
    },
  });
}
