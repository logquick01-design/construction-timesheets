"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Input, Label, Select } from "./ui";
import { TimeRangeInput } from "./time-range-input";
import {
  DEFAULT_FINISH_TIME,
  DEFAULT_START_TIME,
  calcHoursFromTimes,
  finishTimeFromHours,
  formatHours,
  minutesToTime,
  timeToMinutes,
} from "@/lib/time-utils";
import { cn } from "@/lib/utils";
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
  comment: string | null;
  task: { categoryId: string };
};

type Row = {
  key: string;
  workerId: string;
  categoryId: string;
  taskId: string;
  comment: string;
  startTime: string;
  finishTime: string;
};

function buildPayload(rows: Row[]) {
  return rows
    .map((r) => ({
      ...r,
      hours: calcHoursFromTimes(r.startTime, r.finishTime),
    }))
    .filter((r) => r.taskId && r.hours != null && r.hours > 0)
    .map((r) => ({
      workerId: r.workerId,
      taskId: r.taskId,
      hours: r.hours!,
      comment: (r.comment ?? "").trim() || undefined,
    }));
}

function isRowComplete(row: Row): boolean {
  const hours = calcHoursFromTimes(row.startTime, row.finishTime);
  return Boolean(row.categoryId && row.taskId && hours != null && hours > 0);
}

function suggestedStartForWorker(rows: Row[], workerId: string): string {
  let latestFinish = -1;
  for (const r of rows) {
    if (r.workerId !== workerId || !isRowComplete(r)) continue;
    const finishM = timeToMinutes(r.finishTime);
    if (finishM > latestFinish) latestFinish = finishM;
  }
  return latestFinish >= 0 ? minutesToTime(latestFinish) : DEFAULT_START_TIME;
}

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
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const skipAutoSaveRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersionRef = useRef(0);
  const rowsRef = useRef(rows);
  const saveQueueRef = useRef(Promise.resolve());

  rowsRef.current = rows;

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
    setLoadError("");
    skipAutoSaveRef.current = true;
    const res = await fetch(
      `/api/timesheet?siteId=${siteId}&date=${encodeURIComponent(date)}`
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setLoadError(data.error ?? "Failed to load");
      return;
    }
    setWorkers(data.workers);
    setCategories(data.categories);
    const nextStartByWorker = new Map<string, string>();
    const initial: Row[] = (data.entries as Entry[]).map((e, i) => {
      const startTime = nextStartByWorker.get(e.workerId) ?? DEFAULT_START_TIME;
      const finishTime = finishTimeFromHours(startTime, e.hours);
      nextStartByWorker.set(e.workerId, finishTime);
      return {
        key: `existing-${i}`,
        workerId: e.workerId,
        categoryId: e.task.categoryId,
        taskId: e.taskId,
        comment: e.comment ?? "",
        startTime,
        finishTime,
      };
    });
    setRows(initial);
    setExpandedRows(new Set());
    setSaveError("");
  }, [siteId, date]);

  useEffect(() => {
    loadTimesheet();
  }, [loadTimesheet]);

  const tasksByCategory = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const c of categories) map[c.id] = c.tasks;
    return map;
  }, [categories]);

  const tasksById = useMemo(() => {
    const map: Record<string, Task> = {};
    for (const c of categories) {
      for (const t of c.tasks) map[t.id] = t;
    }
    return map;
  }, [categories]);

  const categoriesById = useMemo(() => {
    const map: Record<string, Category> = {};
    for (const c of categories) map[c.id] = c;
    return map;
  }, [categories]);

  function addRow(workerId: string) {
    const key = `new-${Date.now()}-${Math.random()}`;
    setRows((prev) => {
      const startTime = suggestedStartForWorker(prev, workerId);
      return [
        ...prev,
        {
          key,
          workerId,
          categoryId: "",
          taskId: "",
          comment: "",
          startTime,
          finishTime: DEFAULT_FINISH_TIME,
        },
      ];
    });
    setExpandedRows((prev) => {
      const next = new Set(prev);
      for (const r of rowsRef.current) {
        if (r.workerId === workerId && isRowComplete(r)) {
          next.delete(r.key);
        }
      }
      next.add(key);
      return next;
    });
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.categoryId !== undefined && patch.categoryId !== r.categoryId) {
          next.taskId = "";
        }
        return next;
      })
    );
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setExpandedRows((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function expandRow(key: string) {
    setExpandedRows((prev) => new Set(prev).add(key));
  }

  function collapseRow(key: string) {
    setExpandedRows((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  const runSave = useCallback(async () => {
    if (!siteId) return;

    const version = ++saveVersionRef.current;
    const payload = buildPayload(rowsRef.current);

    setSaveError("");

    try {
      const res = await fetch("/api/timesheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, date, rows: payload }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (version !== saveVersionRef.current) return;

      if (!res.ok) {
        setSaveError(data.error ?? "Save failed");
        return;
      }

      setSaveError("");
    } catch {
      if (version === saveVersionRef.current) {
        setSaveError("Network error");
      }
    }
  }, [siteId, date]);

  const enqueueSave = useCallback(() => {
    saveQueueRef.current = saveQueueRef.current.then(runSave).catch(() => {
      // runSave already updates saveError on failure
    });
  }, [runSave]);

  useEffect(() => {
    if (!siteId || !date || loading) return;

    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      enqueueSave();
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [rows, siteId, date, loading, enqueueSave]);

  const rowsByWorker = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of rows) {
      if (!map[r.workerId]) map[r.workerId] = [];
      map[r.workerId].push(r);
    }
    return map;
  }, [rows]);

  const hoursByWorker = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (!isRowComplete(r)) continue;
      const hours = calcHoursFromTimes(r.startTime, r.finishTime);
      if (hours == null || hours <= 0) continue;
      map[r.workerId] = Math.round(((map[r.workerId] ?? 0) + hours) * 100) / 100;
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
      <div className="sticky top-[var(--app-header-height)] z-30 -mx-4 border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-end gap-3">
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
          {siteId && !loading && saveError && (
            <p className="ml-auto text-sm text-red-600" aria-live="polite">
              {saveError || "Couldn't save — try again"}
            </p>
          )}
        </div>
        {loadError && (
          <p className="mt-2 text-sm text-red-600">{loadError}</p>
        )}
      </div>

      {loading && <p className="text-muted">Loading crew…</p>}

      {!loading && siteId && workers.length === 0 && (
        <p className="text-muted">No workers assigned to this site.</p>
      )}

      <div className="space-y-6">
        {workersByCompany.map((group) => (
          <section key={group.name}>
            <h2 className="mb-2 rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white sm:sticky sm:top-[calc(var(--app-header-height)+5.5rem)] sm:z-20">
              {group.name}
              <span className="ml-2 font-normal text-accent-soft">
                ({group.workers.length})
              </span>
            </h2>
            <div className="space-y-3">
              {group.workers.map((w) => {
                const workerRows = rowsByWorker[w.id] ?? [];
                const workerTotal = hoursByWorker[w.id] ?? 0;

                return (
                <div
                  key={w.id}
                  className="overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <div className="flex items-center justify-between gap-2 bg-fill px-3 py-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-ink">{w.name}</span>
                      <span className="ml-2 text-sm text-muted">{w.trade}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {workerRows.length > 0 && (
                        <span
                          className="text-sm font-semibold tabular-nums text-ink"
                          aria-label={`${workerTotal} hours logged today`}
                        >
                          {workerTotal > 0 ? formatHours(workerTotal) : "0 hrs"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => addRow(w.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-black hover:bg-accent-hover"
                        aria-label={`Add task for ${w.name}`}
                      >
                        <Plus size={22} />
                      </button>
                    </div>
                  </div>

                  {(rowsByWorker[w.id] ?? []).length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-light">Tap + to add hours</p>
                  ) : (
                    <div className="divide-y divide-border-light">
                      {(rowsByWorker[w.id] ?? []).map((row, rowIndex) => {
                        const compact = rowIndex > 0;
                        const complete = isRowComplete(row);
                        const isExpanded = expandedRows.has(row.key) || !complete;
                        const categoryName =
                          categoriesById[row.categoryId]?.name ?? "Category";
                        const task = tasksById[row.taskId];
                        const taskLabel = task
                          ? `${task.name} (${task.reference})`
                          : "Task";
                        const hours = calcHoursFromTimes(row.startTime, row.finishTime);
                        const hasComment = row.comment.trim().length > 0;

                        if (!isExpanded && complete) {
                          return (
                            <div
                              key={row.key}
                              className="flex items-center gap-1 px-2 py-1.5 sm:px-3"
                            >
                              <button
                                type="button"
                                onClick={() => expandRow(row.key)}
                                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left text-sm hover:bg-fill"
                                aria-label={`Edit ${taskLabel}`}
                              >
                                <ChevronRight
                                  size={16}
                                  className="shrink-0 text-muted-light"
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate">
                                  <span className="text-muted">{categoryName}</span>
                                  <span className="mx-1 text-accent-soft" aria-hidden>
                                    ·
                                  </span>
                                  <span className="font-medium text-ink">
                                    {task?.name ?? "Task"}
                                  </span>
                                </span>
                                <span className="hidden shrink-0 text-muted sm:inline">
                                  {row.startTime}–{row.finishTime}
                                </span>
                                <span className="shrink-0 font-semibold text-ink">
                                  {formatHours(hours)}
                                </span>
                                {hasComment && (
                                  <MessageSquare
                                    size={14}
                                    className="shrink-0 text-muted-light"
                                    aria-label="Has note"
                                  />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(row.key)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-light hover:bg-red-50 hover:text-red-600"
                                aria-label="Remove row"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={row.key}
                            className={cn(
                              compact && "bg-fill/60",
                              compact ? "px-2 py-1.5 sm:px-3" : "p-3"
                            )}
                          >
                            {complete && (
                              <div className="mb-1.5 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => collapseRow(row.key)}
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted hover:bg-fill-hover hover:text-ink"
                                >
                                  <ChevronDown size={14} aria-hidden />
                                  Done
                                </button>
                              </div>
                            )}
                            <div
                              className={cn(
                                "grid grid-cols-1 sm:items-center",
                                compact
                                  ? "gap-1 sm:grid-cols-[1fr_1fr_minmax(0,auto)_32px]"
                                  : "gap-2 sm:grid-cols-[1fr_1fr_1.25fr_minmax(0,auto)_40px]"
                              )}
                            >
                              <Select
                                value={row.categoryId}
                                onChange={(e) =>
                                  updateRow(row.key, { categoryId: e.target.value })
                                }
                                aria-label="Category"
                                className={compact ? "px-2 py-1 text-sm" : undefined}
                              >
                                <option value="">Select category…</option>
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
                                disabled={!row.categoryId}
                                className={compact ? "px-2 py-1 text-sm" : undefined}
                              >
                                <option value="">
                                  {row.categoryId ? "Select task…" : "Select category first"}
                                </option>
                                {(tasksByCategory[row.categoryId] ?? []).map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.reference})
                                  </option>
                                ))}
                              </Select>
                              {!compact && (
                                <Input
                                  value={row.comment}
                                  onChange={(e) =>
                                    updateRow(row.key, { comment: e.target.value })
                                  }
                                  placeholder="Brief description (optional)"
                                  maxLength={200}
                                  aria-label="Comment"
                                />
                              )}
                              <TimeRangeInput
                                compact={compact}
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
                                className={cn(
                                  "flex items-center justify-center rounded-lg text-muted-light hover:bg-red-50 hover:text-red-600",
                                  compact ? "h-8 w-8" : "h-10 w-10"
                                )}
                                aria-label="Remove row"
                              >
                                <Trash2 size={compact ? 16 : 18} />
                              </button>
                            </div>
                            {compact && (
                              <div className="mt-1">
                                <Input
                                  value={row.comment}
                                  onChange={(e) =>
                                    updateRow(row.key, { comment: e.target.value })
                                  }
                                  placeholder="Brief description (optional)"
                                  maxLength={200}
                                  aria-label="Comment"
                                  className="px-2 py-1 text-sm"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
