"use client";

import { useEffect, useState } from "react";
import { Cog } from "lucide-react";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Toggle,
} from "./ui";
import type { UserRole } from "@prisma/client";
import {
  DEFAULT_EXPORT_SETTINGS,
  EXCEL_EXPORT_OPTION_LABELS,
  PDF_DETAIL_OPTION_LABELS,
  PDF_SUMMARY_OPTION_LABELS,
  excelOptionsToParams,
  loadExportSettings,
  pdfOptionsToParams,
  saveExportSettings,
  type ExcelExportOptions,
  type ExportSettings,
  type PdfSummaryOptions,
} from "@/lib/export-options";
import { cn } from "@/lib/utils";

type Site = { id: string; name: string };

export function ExportsClient({
  role,
  siteIds,
  defaultFrom,
  defaultTo,
  lockedSiteId,
  pageTitle = "Exports",
  pageSubtitle,
}: {
  role: UserRole;
  siteIds: string[];
  defaultFrom: string;
  defaultTo: string;
  lockedSiteId?: string;
  pageTitle?: string;
  pageSubtitle?: string;
}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState(lockedSiteId ?? "");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [showSettings, setShowSettings] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const isManagerOnly = role === "SITE_MANAGER";

  useEffect(() => {
    setExportSettings(loadExportSettings());
    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    saveExportSettings(exportSettings);
  }, [exportSettings, settingsLoaded]);

  useEffect(() => {
    if (lockedSiteId) return;
    fetch("/api/sites")
      .then((r) => r.json())
      .then((s: Site[]) => {
        setSites(s);
        if (s.length >= 1 && isManagerOnly) setSiteId(s[0].id);
      });
  }, [isManagerOnly, lockedSiteId]);

  function updateExcelOption<K extends keyof ExcelExportOptions>(key: K, value: boolean) {
    setExportSettings((current) => ({
      ...current,
      excel: { ...current.excel, [key]: value },
    }));
  }

  function updatePdfSummaryOption<K extends keyof PdfSummaryOptions>(key: K, value: boolean) {
    setExportSettings((current) => ({
      ...current,
      pdf: {
        ...current.pdf,
        summary: { ...current.pdf.summary, [key]: value },
      },
    }));
  }

  function updatePdfDetailOption<K extends keyof ExcelExportOptions>(key: K, value: boolean) {
    setExportSettings((current) => ({
      ...current,
      pdf: {
        ...current.pdf,
        detail: { ...current.pdf.detail, [key]: value },
      },
    }));
  }

  function resetExportSettings() {
    setExportSettings(DEFAULT_EXPORT_SETTINGS);
  }

  async function downloadCsv() {
    const params = new URLSearchParams({ from, to, ...excelOptionsToParams(exportSettings.excel) });
    if (siteId) params.set("siteId", siteId);
    if (isManagerOnly && !siteId) return;

    const res = await fetch(`/api/exports/csv?${params}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Export failed" }));
      alert(err.error ?? "Export failed");
      return;
    }

    const blob = new Blob([await res.arrayBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-${from}-to-${to}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    if (!siteId) return;
    const params = new URLSearchParams({
      siteId,
      from,
      to,
      ...pdfOptionsToParams(exportSettings.pdf),
    });
    const res = await fetch(`/api/exports/pdf?${params}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "PDF export failed" }));
      alert(err.error ?? "PDF export failed");
      return;
    }

    const blob = new Blob([await res.arrayBuffer()], { type: "application/pdf" });
    const siteName = sites.find((s) => s.id === siteId)?.name ?? "site";
    const filename = `site-report-${siteName.replace(/[^\w.-]+/g, "-")}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const settingsContent = (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={resetExportSettings}>
          Reset all to defaults
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <h2 className="font-semibold text-ink">Excel columns</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Fields included in payroll Excel downloads.
          </p>
          <div className="space-y-2">
            {(Object.keys(EXCEL_EXPORT_OPTION_LABELS) as Array<keyof ExcelExportOptions>).map(
              (key) => (
                <Toggle
                  key={key}
                  id={`excel-${key}`}
                  checked={exportSettings.excel[key]}
                  onChange={(checked) => updateExcelOption(key, checked)}
                  label={EXCEL_EXPORT_OPTION_LABELS[key]}
                />
              )
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-ink">PDF summary</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Weekly hours grid by company, staff, and day.
          </p>
          <div className="space-y-2">
            {(Object.keys(PDF_SUMMARY_OPTION_LABELS) as Array<keyof PdfSummaryOptions>).map(
              (key) => (
                <Toggle
                  key={key}
                  id={`pdf-summary-${key}`}
                  checked={exportSettings.pdf.summary[key]}
                  onChange={(checked) => updatePdfSummaryOption(key, checked)}
                  label={PDF_SUMMARY_OPTION_LABELS[key]}
                />
              )
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-ink">PDF payroll detail</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Line-by-line payroll data added below the summary in the PDF.
          </p>
          <div className="space-y-2">
            {(Object.keys(PDF_DETAIL_OPTION_LABELS) as Array<keyof ExcelExportOptions>).map(
              (key) => (
                <Toggle
                  key={key}
                  id={`pdf-detail-${key}`}
                  checked={exportSettings.pdf.detail[key]}
                  onChange={(checked) => updatePdfDetailOption(key, checked)}
                  label={PDF_DETAIL_OPTION_LABELS[key]}
                />
              )
            )}
          </div>
        </Card>
      </div>
    </div>
  );

  const downloadContent = (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-1 font-semibold text-ink">Payroll export</h2>
        <p className="mb-4 text-sm text-muted">
          Excel file grouped by category and task. Use the settings gear to choose columns.
        </p>
        <div className="space-y-3">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {!lockedSiteId && (
            <div>
              <Label>Site {isManagerOnly ? "(required)" : "(optional)"}</Label>
              <Select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                disabled={isManagerOnly && (siteIds.length === 1 || sites.length === 1)}
              >
                {!isManagerOnly && <option value="">All sites</option>}
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button onClick={downloadCsv} className="w-full">
            Download Excel
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-ink">Site PDF report</h2>
        <p className="mb-4 text-sm text-muted">
          PDF summary and/or payroll detail tables. Use the settings gear to choose what to
          include.
        </p>
        <div className="space-y-3">
          {!lockedSiteId && (
            <div>
              <Label>Site</Label>
              <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">Select site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={downloadPdf} disabled={!siteId} className="w-full">
            Download PDF
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{pageTitle}</h1>
          {pageSubtitle && <p className="mt-1 text-muted">{pageSubtitle}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Export settings"
          aria-pressed={showSettings}
          onClick={() => setShowSettings((open) => !open)}
          className={cn("mt-1 shrink-0 p-2", showSettings && "bg-fill text-accent")}
        >
          <Cog className="h-4 w-4" />
        </Button>
      </div>

      {showSettings ? settingsContent : downloadContent}
    </div>
  );
}
