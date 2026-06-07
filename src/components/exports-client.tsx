"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Select } from "./ui";
import type { UserRole } from "@prisma/client";

type Site = { id: string; name: string };

export function ExportsClient({
  role,
  siteIds,
  defaultFrom,
  defaultTo,
  lockedSiteId,
}: {
  role: UserRole;
  siteIds: string[];
  defaultFrom: string;
  defaultTo: string;
  lockedSiteId?: string;
}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState(lockedSiteId ?? "");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const isManagerOnly = role === "SITE_MANAGER";

  useEffect(() => {
    if (lockedSiteId) return;
    fetch("/api/sites")
      .then((r) => r.json())
      .then((s: Site[]) => {
        setSites(s);
        if (s.length >= 1 && isManagerOnly) setSiteId(s[0].id);
      });
  }, [isManagerOnly, lockedSiteId]);

  function downloadCsv() {
    const params = new URLSearchParams({ from, to });
    if (siteId) params.set("siteId", siteId);
    if (isManagerOnly && !siteId) return;
    window.location.href = `/api/exports/csv?${params}`;
  }

  async function downloadPdf() {
    if (!siteId) return;
    const params = new URLSearchParams({ siteId, from, to });
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-1 font-semibold text-slate-850">Payroll CSV</h2>
        <p className="mb-4 text-sm text-slate-500">
          Worker, site, category, task, cost code ref, date, hours
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
                disabled={isManagerOnly && sites.length === 1}
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
            Download CSV
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-slate-850">Site PDF summary</h2>
        <p className="mb-4 text-sm text-slate-500">
          Weekly staff hours by company and day for the selected site
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
}
