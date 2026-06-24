"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { SerializedLabourRequest } from "@/lib/labour-requests";
import { rescheduleConflictMessage } from "@/lib/labour-conflicts";
import {
  datesToStrings,
  nextWeekWeekdays,
  rescheduleRequestDate,
  thisWeekWeekdays,
  uniqueDateStrings,
} from "@/lib/labour-dates";
import { formatDate } from "@/lib/utils";
import { Button, Card, Input, Label } from "./ui";
import { asWorkerList, errorMessageFromBody, errorMessageFromResponse, readJsonResponse } from "@/lib/fetch-json";
import {
  addDays,
  formatWeekLabel,
  getMondayOfWeek,
  STATUS_LABELS,
  WeekCalendarGrid,
  type WorkerOption,
} from "./labour-calendar-shared";

type FormMode = "create" | "edit" | "view";

function RequestFormModal({
  siteId,
  workers,
  mode,
  initial,
  seedDate,
  onClose,
  onSaved,
}: {
  siteId: string;
  workers: WorkerOption[];
  mode: FormMode;
  initial?: SerializedLabourRequest;
  seedDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const readOnly = mode === "view";
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>(
    initial?.workers.map((w) => w.workerId) ?? []
  );
  const [dates, setDates] = useState<string[]>(
    initial?.dates ?? (seedDate ? [seedDate] : [])
  );
  const [hoursPerDay, setHoursPerDay] = useState(initial?.workers[0]?.hoursPerDay ?? 8);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [extraDate, setExtraDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const workersByCompany = useMemo(() => {
    const map = new Map<string, WorkerOption[]>();
    for (const w of workers) {
      const key = w.company?.name ?? "No company";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [workers]);

  function toggleWorker(id: string) {
    if (readOnly) return;
    setSelectedWorkers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addWeekdays(getDays: (ref?: Date) => Date[]) {
    setDates((prev) => uniqueDateStrings([...prev, ...datesToStrings(getDays())]));
  }

  function removeDate(date: string) {
    setDates((prev) => prev.filter((d) => d !== date));
  }

  function addExtraDate() {
    if (!extraDate) return;
    setDates((prev) => uniqueDateStrings([...prev, extraDate]));
    setExtraDate("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError("");
    setSaving(true);

    try {
      const payload = {
        siteId,
        workerIds: selectedWorkers,
        dates,
        hoursPerDay,
        notes: notes.trim() || null,
      };

      const res =
        mode === "edit" && initial
          ? await fetch(`/api/labour-requests/${initial.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/labour-requests", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      if (!res.ok) {
        const json = await readJsonResponse<{ error?: string }>(res);
        setError(errorMessageFromBody(json, "Save failed"));
        return;
      }

      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!initial || mode !== "edit") return;
    if (!confirm("Cancel this pending request?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/labour-requests/${initial.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await readJsonResponse<{ error?: string }>(res);
        setError(errorMessageFromBody(json, "Cancel failed"));
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {mode === "create" && "Request labour"}
              {mode === "edit" && "Edit request"}
              {mode === "view" && "Request details"}
            </h2>
            {initial && (
              <p className="text-sm text-muted">{STATUS_LABELS[initial.status]}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-fill">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Workers</Label>
            <div className="max-h-40 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
              {workersByCompany.map(([company, list]) => (
                <div key={company}>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted">{company}</p>
                  <div className="space-y-1">
                    {list.map((w) => (
                      <label
                        key={w.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-fill"
                      >
                        <input
                          type="checkbox"
                          checked={selectedWorkers.includes(w.id)}
                          onChange={() => toggleWorker(w.id)}
                          disabled={readOnly}
                        />
                        <span className="text-sm">
                          {w.name}{" "}
                          <span className="text-muted">({w.trade})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {workers.length === 0 && (
                <p className="text-sm text-muted">No active workers on this site.</p>
              )}
            </div>
          </div>

          <div>
            <Label>Dates</Label>
            {!readOnly && (
              <div className="mb-2 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => addWeekdays(thisWeekWeekdays)}>
                  This week (Mon–Fri)
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => addWeekdays(nextWeekWeekdays)}>
                  Next week (Mon–Fri)
                </Button>
              </div>
            )}
            <div className="mb-2 flex flex-wrap gap-1">
              {dates.length === 0 && <span className="text-sm text-muted">No dates selected</span>}
              {dates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-xs"
                >
                  {d}
                  {!readOnly && (
                    <button type="button" onClick={() => removeDate(d)} className="text-muted hover:text-ink">
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={extraDate}
                  onChange={(e) => setExtraDate(e.target.value)}
                  aria-label="Add date"
                />
                <Button type="button" variant="secondary" onClick={addExtraDate}>
                  Add day
                </Button>
              </div>
            )}
            {!readOnly && (
              <p className="mt-1 text-xs text-muted">
                Mon–Fri shortcuts skip weekends. Add Saturday or Sunday manually.
              </p>
            )}
          </div>

          <div>
            <Label>Hours per day</Label>
            <Input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
              disabled={readOnly}
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context for the admin reviewer"
              disabled={readOnly}
            />
          </div>

          {initial?.denialReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              <p className="font-medium">Denial reason</p>
              <p>{initial.denialReason}</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2">
            {mode === "edit" && initial?.status === "PENDING" && (
              <Button type="button" variant="danger" onClick={handleCancel} disabled={saving}>
                Cancel request
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={saving || selectedWorkers.length === 0 || dates.length === 0}>
                {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Submit request"}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

export function LookAheadClient({
  siteId,
  canCreate,
}: {
  siteId: string;
  canCreate: boolean;
}) {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [requests, setRequests] = useState<SerializedLabourRequest[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState<
    | { mode: "create"; seedDate?: string }
    | { mode: "edit" | "view"; request: SerializedLabourRequest }
    | null
  >(null);
  const [reloadKey, setReloadKey] = useState(0);

  const weekEnd = addDays(weekStart, 6);
  const from = formatDate(weekStart);
  const to = formatDate(weekEnd);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({
          siteId,
          from,
          to,
          status: "PENDING,ACCEPTED",
        });
        const [reqRes, workerRes] = await Promise.all([
          fetch(`/api/labour-requests?${params}`, { signal: controller.signal }),
          fetch(`/api/sites/${siteId}/workers`, { signal: controller.signal }),
        ]);

        const reqJson = await readJsonResponse<{ requests?: SerializedLabourRequest[]; error?: string }>(reqRes);
        const workerJson = await readJsonResponse<unknown>(workerRes);

        if (controller.signal.aborted) return;

        if (!reqRes.ok) {
          setLoadError(errorMessageFromResponse(reqRes, reqJson, "Failed to load labour requests"));
          setRequests([]);
        } else {
          setRequests(reqJson?.requests ?? []);
        }

        if (!workerRes.ok) {
          setLoadError((prev) => prev || errorMessageFromResponse(workerRes, workerJson, "Failed to load workers"));
          setWorkers([]);
        } else if (asWorkerList(workerJson)) {
          setWorkers(workerJson);
        } else {
          setWorkers([]);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError("Failed to load calendar data");
        setRequests([]);
        setWorkers([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [siteId, from, to, reloadKey]);

  function openRequest(request: SerializedLabourRequest) {
    if (canCreate && request.status === "PENDING") {
      setModal({ mode: "edit", request });
    } else {
      setModal({ mode: "view", request });
    }
  }

  async function handleReschedule(requestId: string, fromDate: string, toDate: string) {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    const conflict = rescheduleConflictMessage(requests, request, fromDate, toDate);
    if (conflict) {
      setLoadError(conflict);
      return;
    }

    const newDates = rescheduleRequestDate(request.dates, fromDate, toDate);
    if (!newDates) return;

    const previous = requests;
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, dates: newDates } : r))
    );

    const res = await fetch(`/api/labour-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: newDates }),
    });

    if (!res.ok) {
      setRequests(previous);
      const json = await readJsonResponse<{ error?: string }>(res);
      setLoadError(errorMessageFromBody(json, "Failed to reschedule request"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium">{formatWeekLabel(weekStart)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setWeekStart(getMondayOfWeek(new Date()))}>
            Today
          </Button>
        </div>
        {canCreate && (
          <Button type="button" onClick={() => setModal({ mode: "create" })}>
            New request
          </Button>
        )}
      </div>

      {loadError && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-900">{loadError}</p>
          <p className="mt-1 text-xs text-red-800">
            If this persists after pulling updates, run{" "}
            <code className="rounded bg-red-100 px-1">npm run db:push</code> and restart{" "}
            <code className="rounded bg-red-100 px-1">npm run dev</code>.
          </p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={reload}>
            Retry
          </Button>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-amber-400 bg-amber-50" /> Pending
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-accent bg-accent/15" /> Accepted
        </span>
        {canCreate && (
          <span>Drag pending requests to another day to reschedule (same worker cannot be double-booked)</span>
        )}
      </div>

      {loading ? (
        <Card><p className="text-sm text-muted">Loading calendar…</p></Card>
      ) : (
        <WeekCalendarGrid
          weekStart={weekStart}
          requests={requests}
          variant="site"
          canCreate={canCreate}
          canDragRequest={(r) => canCreate && r.status === "PENDING"}
          onReschedule={canCreate ? handleReschedule : undefined}
          onDayClick={(dateStr) => setModal({ mode: "create", seedDate: dateStr })}
          onRequestClick={openRequest}
        />
      )}

      {modal && (
        <RequestFormModal
          siteId={siteId}
          workers={workers}
          mode={modal.mode}
          initial={"request" in modal ? modal.request : undefined}
          seedDate={"seedDate" in modal ? modal.seedDate : undefined}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
