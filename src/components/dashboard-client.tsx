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
import { Cog } from "lucide-react";
import { Button, Card, Input, Label, Select, Toggle } from "./ui";
import type { UserRole } from "@prisma/client";
import {
  DASHBOARD_WIDGET_LABELS,
  DEFAULT_DASHBOARD_WIDGETS,
  type DashboardWidgets,
} from "@/lib/dashboard-widgets";
import type { TaskBudgetEntry } from "@/lib/task-budgets";
import {
  TaskBudgetCharts,
  TaskBudgetSettingsPanel,
  type SiteTask,
} from "./task-budget-panel";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#0a0a0a", "#c4783b", "#7a7268", "#a86432"];

type Site = { id: string; name: string };
type SettingsView = "widgets" | "taskBudgetConfig";

export function DashboardClient({
  defaultFrom,
  defaultTo,
  role,
  siteIds,
  lockedSiteId,
  pageTitle,
  pageSubtitle,
}: {
  defaultFrom: string;
  defaultTo: string;
  role: UserRole;
  siteIds: string[];
  lockedSiteId?: string;
  pageTitle?: string;
  pageSubtitle?: string;
}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [siteId, setSiteId] = useState(lockedSiteId ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>("widgets");
  const [widgets, setWidgets] = useState<DashboardWidgets>(DEFAULT_DASHBOARD_WIDGETS);
  const [taskBudgets, setTaskBudgets] = useState<TaskBudgetEntry[]>([]);
  const [siteTasks, setSiteTasks] = useState<SiteTask[]>([]);
  const [widgetsLoaded, setWidgetsLoaded] = useState(!lockedSiteId);
  const [data, setData] = useState<{
    chartData: Record<string, string | number>[];
    workers: { name: string; hours: number }[];
    tasks: { taskId: string; name: string; reference: string; hours: number }[];
    grandTotal: number;
    totalBySite: Record<string, number>;
    allTimeHoursByTaskId?: Record<string, number>;
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

  useEffect(() => {
    if (!lockedSiteId) return;

    fetch(`/api/sites/${lockedSiteId}/dashboard/widgets`)
      .then((r) => r.json())
      .then((json: { widgets?: DashboardWidgets }) => {
        if (json.widgets) setWidgets(json.widgets);
      })
      .finally(() => setWidgetsLoaded(true));

    fetch(`/api/sites/${lockedSiteId}/dashboard/task-budgets`)
      .then((r) => r.json())
      .then((json: { taskBudgets?: TaskBudgetEntry[] }) => {
        if (json.taskBudgets) setTaskBudgets(json.taskBudgets);
      });

    fetch(`/api/sites/${lockedSiteId}/tasks`)
      .then((r) => r.json())
      .then((tasks: SiteTask[]) => {
        if (Array.isArray(tasks)) setSiteTasks(tasks);
      });
  }, [lockedSiteId]);

  const saveWidgets = useCallback(
    async (next: DashboardWidgets) => {
      if (!lockedSiteId) return true;

      const res = await fetch(`/api/sites/${lockedSiteId}/dashboard/widgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save widget settings" }));
        alert(err.error ?? "Failed to save widget settings");
        return false;
      }

      const json = (await res.json()) as { widgets: DashboardWidgets };
      setWidgets(json.widgets);
      return true;
    },
    [lockedSiteId]
  );

  const saveTaskBudgets = useCallback(
    async (next: TaskBudgetEntry[]) => {
      if (!lockedSiteId) return true;

      const res = await fetch(`/api/sites/${lockedSiteId}/dashboard/task-budgets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to save task budgets" }));
        alert(err.error ?? "Failed to save task budgets");
        return false;
      }

      const json = (await res.json()) as { taskBudgets: TaskBudgetEntry[] };
      setTaskBudgets(json.taskBudgets);
      return true;
    },
    [lockedSiteId]
  );

  async function updateWidget<K extends keyof DashboardWidgets>(key: K, value: boolean) {
    const next = { ...widgets, [key]: value };
    const saved = await saveWidgets(next);
    if (saved) setWidgets(next);
  }

  async function resetWidgets() {
    const saved = await saveWidgets(DEFAULT_DASHBOARD_WIDGETS);
    if (saved) setWidgets(DEFAULT_DASHBOARD_WIDGETS);
    setSettingsView("widgets");
  }

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
  const taskBudgetHoursByTaskId = data?.allTimeHoursByTaskId ?? {};

  const filtersCard = (
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
  );

  const dashboardContent = data && (
    <>
      {(widgets.totalHours || widgets.siteHours) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widgets.totalHours && (
            <Card>
              <p className="text-sm text-muted">Total hours (filtered)</p>
              <p className="text-3xl font-bold text-ink">{data.grandTotal.toFixed(1)}</p>
            </Card>
          )}
          {widgets.siteHours &&
            sites.map((s) => (
              <Card key={s.id}>
                <p className="text-sm text-muted">{s.name}</p>
                <p className="text-2xl font-bold text-accent">
                  {(data.totalBySite[s.id] ?? 0).toFixed(1)} hrs
                </p>
              </Card>
            ))}
        </div>
      )}

      {widgets.categoryChart && (
        <Card>
          <h2 className="mb-4 font-semibold text-ink">
            {lockedSiteId ? "Hours by category" : "Hours by category per site"}
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
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
      )}

      {(widgets.workersList || widgets.tasksList) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {widgets.workersList && (
            <Card>
              <h2 className="mb-3 font-semibold text-ink">Hours per worker</h2>
              <ul className="divide-y divide-border-light">
                {data.workers.length === 0 && (
                  <li className="py-2 text-sm text-muted-light">No data</li>
                )}
                {data.workers.map((w) => (
                  <li key={w.name} className="flex justify-between py-2 text-sm">
                    <span>{w.name}</span>
                    <span className="font-semibold">{w.hours.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {widgets.tasksList && (
            <Card>
              <h2 className="mb-3 font-semibold text-ink">Hours per task</h2>
              <ul className="divide-y divide-border-light">
                {data.tasks.length === 0 && (
                  <li className="py-2 text-sm text-muted-light">No data</li>
                )}
                {data.tasks.map((t) => (
                  <li key={t.taskId} className="flex justify-between gap-2 py-2 text-sm">
                    <span>
                      {t.name}{" "}
                      <span className="text-muted-light">({t.reference})</span>
                    </span>
                    <span className="shrink-0 font-semibold">{t.hours.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {lockedSiteId && (
        <TaskBudgetCharts
          taskBudgets={taskBudgets}
          siteTasks={siteTasks}
          hoursByTaskId={taskBudgetHoursByTaskId}
        />
      )}
    </>
  );

  const settingsContent =
    settingsView === "taskBudgetConfig" ? (
      <TaskBudgetSettingsPanel
        taskBudgets={taskBudgets}
        siteTasks={siteTasks}
        onSave={saveTaskBudgets}
        onBack={() => setSettingsView("widgets")}
      />
    ) : (
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={resetWidgets}>
            Reset all to defaults
          </Button>
        </div>

        <Card>
          <h2 className="font-semibold text-ink">Dashboard widgets</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Choose which sections appear on your dashboard. At least one widget must stay enabled.
          </p>
          <div className="space-y-2">
            {(Object.keys(DASHBOARD_WIDGET_LABELS) as Array<keyof DashboardWidgets>).map((key) => (
              <Toggle
                key={key}
                id={`widget-${key}`}
                checked={widgets[key]}
                onChange={(checked) => updateWidget(key, checked)}
                label={DASHBOARD_WIDGET_LABELS[key].label}
                description={DASHBOARD_WIDGET_LABELS[key].description}
              />
            ))}
          </div>

          <div className="mt-4 flex items-start justify-between gap-3 border-t border-border-light pt-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Task budget usage</p>
              <p className="mt-0.5 text-sm text-muted">
                Pie charts comparing logged hours against site budget totals. Use the show toggle on
                each task to control which appear on the dashboard.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 shrink-0 text-accent"
              onClick={() => setSettingsView("taskBudgetConfig")}
            >
              Configure
            </Button>
          </div>
        </Card>
      </div>
    );

  if (lockedSiteId) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{pageTitle ?? "Dashboard"}</h1>
            {pageSubtitle && <p className="mt-1 text-muted">{pageSubtitle}</p>}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Widget settings"
            aria-pressed={showSettings}
            onClick={() => {
              setShowSettings((open) => {
                if (open) setSettingsView("widgets");
                return !open;
              });
            }}
            className={cn(
              "mt-1 shrink-0 p-2",
              showSettings && "bg-fill text-accent"
            )}
          >
            <Cog className="h-4 w-4" />
          </Button>
        </div>

        {showSettings ? (
          settingsContent
        ) : (
          <div className="space-y-6">
            {filtersCard}
            {widgetsLoaded && dashboardContent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {filtersCard}
      {dashboardContent}
    </div>
  );
}
