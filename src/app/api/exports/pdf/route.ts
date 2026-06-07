import { NextResponse } from "next/server";
import { canExportSite, getSession } from "@/lib/auth";
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

type WorkerHours = {
  workerName: string;
  companyName: string;
  hoursByDate: Map<string, number>;
};

function formatHours(hours: number): string {
  return hours.toFixed(1).replace(/\.0$/, "");
}

function workerTotal(worker: WorkerHours, dateKeys: string[]): number {
  return dateKeys.reduce((sum, dateKey) => sum + (worker.hoursByDate.get(dateKey) ?? 0), 0);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  if (!siteId || !fromStr || !toStr) {
    return NextResponse.json({ error: "siteId, from, to required" }, { status: 400 });
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

  const siteWorkers = await prisma.worker.findMany({
    where: { siteId, active: true },
    include: { company: true },
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
  });

  const entries = await prisma.timesheetEntry.findMany({
    where: { siteId, date: { gte: from, lte: to } },
    select: { workerId: true, date: true, hours: true },
  });

  const hoursByWorkerDate = new Map<string, number>();
  for (const entry of entries) {
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

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const tableWidth = pageWidth - MARGIN * 2;
  const dayColWidth =
    (tableWidth - COMPANY_COL_WIDTH - STAFF_COL_WIDTH - TOTAL_COL_WIDTH) / days.length;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text(REPORT_TITLE, MARGIN, 28);

  doc.setFontSize(12);
  doc.text(ORGANISATION_HEADER, MARGIN, 46);

  doc.setFontSize(11);
  doc.text(`Site: ${site.name} ( ${site.location} )`, MARGIN, 62);

  const dateRow: CellDef[] = [
    { content: "company", rowSpan: 2, styles: { valign: "middle" } },
    { content: "Staff", rowSpan: 2, styles: { valign: "middle" } },
    ...days.map((d) => ({
      content: formatDisplayDate(d),
      styles: { halign: "center" as const, fontStyle: "bold" as const },
    })),
    {
      content: "Total",
      rowSpan: 2,
      styles: { halign: "center" as const, fontStyle: "bold" as const, valign: "middle" },
    },
  ];

  const dayRow: CellDef[] = STATIC_DAY_NAMES.slice(0, days.length).map((name) => ({
    content: name,
    styles: { halign: "center" as const, fontStyle: "bold" as const },
  }));

  const body = workers.map((worker) => {
    const total = workerTotal(worker, dateKeys);
    return [
      worker.companyName,
      worker.workerName,
      ...dateKeys.map((dateKey) => {
        const hours = worker.hoursByDate.get(dateKey);
        return hours != null ? formatHours(hours) : "";
      }),
      total > 0 ? formatHours(total) : "",
    ];
  });

  const columnStyles: Record<number, { cellWidth: number; halign?: "left" | "center" }> = {
    0: { cellWidth: COMPANY_COL_WIDTH, halign: "left" },
    1: { cellWidth: STAFF_COL_WIDTH, halign: "left" },
  };
  for (let i = 0; i < days.length; i++) {
    columnStyles[i + 2] = { cellWidth: dayColWidth, halign: "center" };
  }
  columnStyles[days.length + 2] = { cellWidth: TOTAL_COL_WIDTH, halign: "center" };

  autoTable(doc, {
    startY: 76,
    head: [dateRow, dayRow],
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
  });

  const pageCount = doc.getNumberOfPages();
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
