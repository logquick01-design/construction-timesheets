"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Label, Select } from "./ui";
import { TimeRangeInput } from "./time-range-input";
import {
  DEFAULT_FINISH_TIME,
  DEFAULT_START_TIME,
  calcHoursFromTimes,
  finishTimeFromHours,
} from "@/lib/time-utils";
import type { UserRole } from "@prisma/client";

type Site = { id: string; name: string };
type Worker = {
  id: string;
  name: string;
  trade: string;
  company: { id: string; name: string } | null;
};
type Task = {
  id: string;
  name: string;
  reference: string;
  categoryId: string;
};
type Category = {
  id: string;
  name: string;
  tasks: Task[];
};
type Entry = {
  workerId: string;
  taskId: string;
  hours: number;
  task: { categoryId: string };
};

type Row = {
  key: string;
  workerId: string;
  categoryId: string;
  taskId: string;
  startTime: string;
  finishTime: string;
};

export function TimesheetClient({
  role,
  siteIds,
  defaultDate,
  lockedSiteId,
}: {
  role: UserRole;
  siteIds: string[];
  defaultDate: string;
  lockedSiteId?: string;
}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState(lockedSiteId ?? "");
  const [date, setDate] = useState(defaultDate);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (lockedSiteId) return;
    fetch("/api/sites")
      .then((r) => r.json())
      .then((data: Site[]) => {
        setSites(data);
        if (data.length === 1) setSiteId(data[0].id);
        else if (role === "SITE_MANAGER" && siteIds[0]) {
          const match = data.find((s) => s.id === siteIds[0]);
          if (match) setSiteId(match.id);
        }
      });
  }, [role, siteIds, lockedSiteId]);

  const loadTimesheet = useCallback(async () => {
    if (!siteId || !date) return;
    setLoading(true);
    setMessage("");
    const res = await fetch(
      `/api/timesheet?siteId=${siteId}&date=${encodeURIComponent(date)}`
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Failed to load");
      return;
    }
    setWorkers(data.workers);
    setCategories(data.categories);
    const initial: Row[] = (data.entries as (Entry & { workerId: string; taskId: string; hours: number })[]).map(
      (e, i) => ({
        key: `existing-${i}`,
        workerId: e.workerId,
        categoryId: e.task.categoryId,
        taskId: e.taskId,
        startTime: DEFAULT_START_TIME,
        finishTime: finishTimeFromHours(DEFAULT_START_TIME, e.hours),
      })
    );
    setRows(initial);
  }, [siteId, date]);

  useEffect(() => {
    loadTimesheet();
  }, [loadTimesheet]);

  const tasksByCategory = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const c of categories) map[c.id] = c.tasks;
    return map;
  }, [categories]);

  function addRow(workerId: string) {
    const firstCat = categories[0];
    const firstTask = firstCat?.tasks[0];
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random()}`,
        workerId,
        categoryId: firstCat?.id ?? "",
        taskId: firstTask?.id ?? "",
        startTime: DEFAULT_START_TIME,
        finishTime: DEFAULT_FINISH_TIME,
      },
    ]);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.categoryId && patch.categoryId !== r.categoryId) {
          const tasks = tasksByCategory[patch.categoryId] ?? [];
          next.taskId = tasks[0]?.id ?? "";
        }
        return next;
      })
    );
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function save() {
    if (!siteId) return;
    const payload = rows
      .map((r) => ({
        ...r,
        hours: calcHoursFromTimes(r.startTime, r.finishTime),
      }))
      .filter((r) => r.taskId && r.hours != null && r.hours > 0)
      .map((r) => ({
        workerId: r.workerId,
        taskId: r.taskId,
        hours: r.hours!,
      }));

    setSaving(true);
    setMessage("");
    const res = await fetch("/api/timesheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, date, rows: payload }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }
    setMessage(`Saved ${data.count} entries`);
    loadTimesheet();
  }

  const rowsByWorker = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of rows) {
      if (!map[r.workerId]) map[r.workerId] = [];
      map[r.workerId].push(r);
    }
    return map;
  }, [rows]);

  const workersByCompany = useMemo(() => {
    const map = new Map<string, { name: string; workers: Worker[] }>();
    for (const w of workers) {
      const key = w.company?.id ?? "unassigned";
      const name = w.company?.name ?? "Unassigned";
      if (!map.has(key)) {
        map.set(key, { name, workers: [] });
      }
      map.get(key)!.workers.push(w);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [workers]);

  return (
    <div className="space-y-4">
      <div className="sticky top-[var(--app-header-height)] z-30 -mx-4 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-wrap items-end gap-3 sm:flex-1">
            <div className="min-w-[140px] flex-1">
              <Label htmlFor="ts-date">Date</Label>
              <Input
                id="ts-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {!lockedSiteId && (
              <div className="min-w-[160px] flex-[2]">
                <Label htmlFor="ts-site">Site</Label>
                <Select
                  id="ts-site"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  disabled={sites.length <= 1 && role === "SITE_MANAGER"}
                >
                  <option value="">Select site…</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          <Button
            size="lg"
            onClick={save}
            disabled={saving || !siteId || loading}
            className="w-full sm:ml-auto sm:w-auto sm:min-w-[120px]"
          >
            {saving ? "Saving…" : "Save all"}
          </Button>
        </div>
        {message && (
          <p className="mt-2 text-sm text-slate-700">{message}</p>
        )}
      </div>

      {loading && <p className="text-slate-500">Loading crew…</p>}

      {!loading && siteId && workers.length === 0 && (
        <p className="text-slate-500">No workers assigned to this site.</p>
      )}

      <div className="space-y-6">
        {workersByCompany.map((group) => (
          <section key={group.name}>
            <h2 className="mb-2 rounded-lg bg-slate-850 px-3 py-2 text-sm font-semibold text-white sm:sticky sm:top-[calc(var(--app-header-height)+5.5rem)] sm:z-20">
              {group.name}
              <span className="ml-2 font-normal text-slate-300">
                ({group.workers.length})
              </span>
            </h2>
            <div className="space-y-3">
              {group.workers.map((w) => (
                <div
                  key={w.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                    <div>
                      <span className="font-semibold text-slate-850">{w.name}</span>
                      <span className="ml-2 text-sm text-slate-500">{w.trade}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addRow(w.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                      aria-label={`Add task for ${w.name}`}
                    >
                      <Plus size={22} />
                    </button>
                  </div>

                  {(rowsByWorker[w.id] ?? []).length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Tap + to add hours</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {(rowsByWorker[w.id] ?? []).map((row) => (
                        <div
                          key={row.key}
                          className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[1fr_1fr_minmax(0,auto)_40px] sm:items-center"
                        >
                          <Select
                            value={row.categoryId}
                            onChange={(e) =>
                              updateRow(row.key, { categoryId: e.target.value })
                            }
                            aria-label="Category"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Select>
                          <Select
                            value={row.taskId}
                            onChange={(e) =>
                              updateRow(row.key, { taskId: e.target.value })
                            }
                            aria-label="Task"
                          >
                            {(tasksByCategory[row.categoryId] ?? []).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.reference})
                              </option>
                            ))}
                          </Select>
                          <TimeRangeInput
                            startTime={row.startTime}
                            finishTime={row.finishTime}
                            onStartChange={(startTime) =>
                              updateRow(row.key, { startTime })
                            }
                            onFinishChange={(finishTime) =>
                              updateRow(row.key, { finishTime })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => removeRow(row.key)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove row"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
