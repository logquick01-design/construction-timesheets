export type ExcelExportOptions = {
  category: boolean;
  task: boolean;
  reference: boolean;
  site: boolean;
  siteLocation: boolean;
  company: boolean;
  worker: boolean;
  trade: boolean;
  date: boolean;
  hours: boolean;
  comment: boolean;
  taskTotals: boolean;
};

export type PdfSummaryOptions = {
  company: boolean;
  staff: boolean;
  dailyBreakdown: boolean;
  totals: boolean;
  siteLocationHeader: boolean;
};

export type PdfExportOptions = {
  summary: PdfSummaryOptions;
  detail: ExcelExportOptions;
};

export type ExportSettings = {
  excel: ExcelExportOptions;
  pdf: PdfExportOptions;
};

export const DEFAULT_EXCEL_EXPORT_OPTIONS: ExcelExportOptions = {
  category: true,
  task: true,
  reference: true,
  site: true,
  siteLocation: false,
  company: false,
  worker: true,
  trade: false,
  date: true,
  hours: true,
  comment: true,
  taskTotals: true,
};

export const DEFAULT_PDF_SUMMARY_OPTIONS: PdfSummaryOptions = {
  company: true,
  staff: true,
  dailyBreakdown: true,
  totals: true,
  siteLocationHeader: true,
};

export const DEFAULT_PDF_DETAIL_OPTIONS: ExcelExportOptions = {
  category: false,
  task: false,
  reference: false,
  site: false,
  siteLocation: false,
  company: false,
  worker: false,
  trade: false,
  date: false,
  hours: false,
  comment: false,
  taskTotals: false,
};

export const DEFAULT_PDF_EXPORT_OPTIONS: PdfExportOptions = {
  summary: DEFAULT_PDF_SUMMARY_OPTIONS,
  detail: DEFAULT_PDF_DETAIL_OPTIONS,
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  excel: DEFAULT_EXCEL_EXPORT_OPTIONS,
  pdf: DEFAULT_PDF_EXPORT_OPTIONS,
};

export const EXCEL_EXPORT_OPTION_LABELS: Record<keyof ExcelExportOptions, string> = {
  category: "Category",
  task: "Task",
  reference: "Cost code ref",
  site: "Site name",
  siteLocation: "Site location",
  company: "Company",
  worker: "Worker name",
  trade: "Trade",
  date: "Date",
  hours: "Hours",
  comment: "Comment",
  taskTotals: "Task totals",
};

export const PDF_SUMMARY_OPTION_LABELS: Record<keyof PdfSummaryOptions, string> = {
  company: "Company column",
  staff: "Staff column",
  dailyBreakdown: "Daily hour columns",
  totals: "Total column",
  siteLocationHeader: "Site location in header",
};

export const PDF_DETAIL_OPTION_LABELS: Record<keyof ExcelExportOptions, string> = {
  ...EXCEL_EXPORT_OPTION_LABELS,
  taskTotals: "Task total rows",
};

const EXPORT_SETTINGS_STORAGE_KEY = "logq-export-settings";

function parseBoolParam(
  searchParams: URLSearchParams,
  key: string,
  defaultValue = true
): boolean {
  const value = searchParams.get(key);
  if (value === null) return defaultValue;
  return value === "1" || value === "true";
}

function detailOptionsToParams(prefix: "excel" | "pdfDetail", options: ExcelExportOptions) {
  return {
    [`${prefix}Category`]: options.category ? "1" : "0",
    [`${prefix}Task`]: options.task ? "1" : "0",
    [`${prefix}Reference`]: options.reference ? "1" : "0",
    [`${prefix}Site`]: options.site ? "1" : "0",
    [`${prefix}SiteLocation`]: options.siteLocation ? "1" : "0",
    [`${prefix}Company`]: options.company ? "1" : "0",
    [`${prefix}Worker`]: options.worker ? "1" : "0",
    [`${prefix}Trade`]: options.trade ? "1" : "0",
    [`${prefix}Date`]: options.date ? "1" : "0",
    [`${prefix}Hours`]: options.hours ? "1" : "0",
    [`${prefix}Comment`]: options.comment ? "1" : "0",
    [`${prefix}TaskTotals`]: options.taskTotals ? "1" : "0",
  } as Record<string, string>;
}

function parseDetailOptions(
  searchParams: URLSearchParams,
  prefix: "excel" | "pdfDetail",
  defaults: ExcelExportOptions
): ExcelExportOptions {
  return {
    category: parseBoolParam(searchParams, `${prefix}Category`, defaults.category),
    task: parseBoolParam(searchParams, `${prefix}Task`, defaults.task),
    reference: parseBoolParam(searchParams, `${prefix}Reference`, defaults.reference),
    site: parseBoolParam(searchParams, `${prefix}Site`, defaults.site),
    siteLocation: parseBoolParam(searchParams, `${prefix}SiteLocation`, defaults.siteLocation),
    company: parseBoolParam(searchParams, `${prefix}Company`, defaults.company),
    worker: parseBoolParam(searchParams, `${prefix}Worker`, defaults.worker),
    trade: parseBoolParam(searchParams, `${prefix}Trade`, defaults.trade),
    date: parseBoolParam(searchParams, `${prefix}Date`, defaults.date),
    hours: parseBoolParam(searchParams, `${prefix}Hours`, defaults.hours),
    comment: parseBoolParam(searchParams, `${prefix}Comment`, defaults.comment),
    taskTotals: parseBoolParam(searchParams, `${prefix}TaskTotals`, defaults.taskTotals),
  };
}

export function excelOptionsToParams(options: ExcelExportOptions): Record<string, string> {
  return detailOptionsToParams("excel", options);
}

export function pdfOptionsToParams(options: PdfExportOptions): Record<string, string> {
  return {
    pdfSumCompany: options.summary.company ? "1" : "0",
    pdfSumStaff: options.summary.staff ? "1" : "0",
    pdfSumDaily: options.summary.dailyBreakdown ? "1" : "0",
    pdfSumTotals: options.summary.totals ? "1" : "0",
    pdfSumSiteLocation: options.summary.siteLocationHeader ? "1" : "0",
    ...detailOptionsToParams("pdfDetail", options.detail),
  };
}

export function parseExcelOptions(searchParams: URLSearchParams): ExcelExportOptions {
  return parseDetailOptions(searchParams, "excel", DEFAULT_EXCEL_EXPORT_OPTIONS);
}

export function parsePdfOptions(searchParams: URLSearchParams): PdfExportOptions {
  return {
    summary: {
      company: parseBoolParam(searchParams, "pdfSumCompany"),
      staff: parseBoolParam(searchParams, "pdfSumStaff"),
      dailyBreakdown: parseBoolParam(searchParams, "pdfSumDaily"),
      totals: parseBoolParam(searchParams, "pdfSumTotals"),
      siteLocationHeader: parseBoolParam(searchParams, "pdfSumSiteLocation"),
    },
    detail: parseDetailOptions(searchParams, "pdfDetail", DEFAULT_PDF_DETAIL_OPTIONS),
  };
}

export function hasPdfSummaryContent(summary: PdfSummaryOptions): boolean {
  return summary.company || summary.staff || summary.dailyBreakdown || summary.totals;
}

export function hasPdfDetailContent(detail: ExcelExportOptions): boolean {
  return Object.values(detail).some(Boolean);
}

export function loadExportSettings(): ExportSettings {
  if (typeof window === "undefined") return DEFAULT_EXPORT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(EXPORT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPORT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<ExportSettings> & Partial<ExcelExportOptions>;

    if (parsed.pdf) {
      return {
        excel: { ...DEFAULT_EXCEL_EXPORT_OPTIONS, ...parsed.excel },
        pdf: {
          summary: { ...DEFAULT_PDF_SUMMARY_OPTIONS, ...parsed.pdf.summary },
          detail: { ...DEFAULT_PDF_DETAIL_OPTIONS, ...parsed.pdf.detail },
        },
      };
    }

    const excel =
      "excel" in parsed && parsed.excel ? parsed.excel : (parsed as Partial<ExcelExportOptions>);

    return {
      excel: { ...DEFAULT_EXCEL_EXPORT_OPTIONS, ...excel },
      pdf: DEFAULT_PDF_EXPORT_OPTIONS,
    };
  } catch {
    return DEFAULT_EXPORT_SETTINGS;
  }
}

export function saveExportSettings(settings: ExportSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXPORT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
