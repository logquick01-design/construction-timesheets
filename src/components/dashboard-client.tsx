"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, Input, Label, Select } from "./ui";
import type { UserRole } from "@prisma/client";

const CHART_COLORS = ["#2a3544", "#c4783b", "#6b7c93", "#8b9aab"];

type Site = { id: string; name: string };

export function DashboardClient({
  defaultFrom,
  defaultTo,
  role,
  siteIds,
  lockedSiteId,
}: {
  defaultFrom: string;
  defaultTo: string;
  role: UserRole;
  siteIds: string[];
  lockedSiteId?: string;
}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [siteId, setSiteId] = useState(lockedSiteId ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<{
    chartData: Record<string, string | number>[];
    workers: { name: string; hours: number }[];
    tasks: { name: string; reference: string; hours: number }[];
    grandTotal: number;
    totalBySite: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    if (lockedSiteId) return;
    fetch("/api/sites")
      .then((r) => r.json())
      .then((s: Site[]) => {
        setSites(s);
        if (s.length === 1) setSiteId(s[0].id);
      });
  }, [lockedSiteId]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ from, to });
    if (siteId) params.set("siteId", siteId);
    if (categoryId) params.set("categoryId", categoryId);
    const res = await fetch(`/api/dashboard?${params}`);
    const json = await res.json();
    if (res.ok) {
      setData(json);
      setCategories(json.categories ?? []);
      if (json.sites?.length) setSites(json.sites);
    }
  }, [from, to, siteId, categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  const catNames = categories.map((c) => c.name);

  return (
    <div className="space-y-6">
      <Card className={`grid gap-4 sm:grid-cols-2 ${lockedSiteId ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
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
            <Label>Site</Label>
            <Select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              disabled={role === "SITE_MANAGER" && siteIds.length === 1}
            >
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <p className="text-sm text-slate-500">Total hours (filtered)</p>
              <p className="text-3xl font-bold text-slate-850">
                {data.grandTotal.toFixed(1)}
              </p>
            </Card>
            {sites.map((s) => (
              <Card key={s.id}>
                <p className="text-sm text-slate-500">{s.name}</p>
                <p className="text-2xl font-bold text-[var(--color-accent)]">
                  {(data.totalBySite[s.id] ?? 0).toFixed(1)} hrs
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <h2 className="mb-4 font-semibold text-slate-850">
              {lockedSiteId ? "Hours by category" : "Hours by category per site"}
            </h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="site" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {catNames.map((name, i) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="a"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 font-semibold text-slate-850">Hours per worker</h2>
              <ul className="divide-y divide-slate-100">
                {data.workers.length === 0 && (
                  <li className="py-2 text-sm text-slate-400">No data</li>
                )}
                {data.workers.map((w) => (
                  <li key={w.name} className="flex justify-between py-2 text-sm">
                    <span>{w.name}</span>
                    <span className="font-semibold">{w.hours.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold text-slate-850">Hours per task</h2>
              <ul className="divide-y divide-slate-100">
                {data.tasks.length === 0 && (
                  <li className="py-2 text-sm text-slate-400">No data</li>
                )}
                {data.tasks.map((t) => (
                  <li key={t.reference} className="flex justify-between gap-2 py-2 text-sm">
                    <span>
                      {t.name}{" "}
                      <span className="text-slate-400">({t.reference})</span>
                    </span>
                    <span className="shrink-0 font-semibold">{t.hours.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
