"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { SerializedLabourRequest } from "@/lib/labour-requests";
import { formatDateRangeDisplay } from "@/lib/labour-dates";
import { formatDate } from "@/lib/utils";
import { Button, Card, Input, Label, Select } from "./ui";
import { errorMessageFromBody, readJsonResponse } from "@/lib/fetch-json";
import type { LabourRequestStatus } from "@/lib/labour-types";
import {
  addDays,
  formatWeekLabel,
  getMondayOfWeek,
  STATUS_LABELS,
  WeekCalendarGrid,
} from "./labour-calendar-shared";

const STATUS_OPTIONS: { value: LabourRequestStatus; label: string }[] = [
  { value: "PENDING", label: "Pending approval" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DENIED", label: "Denied" },
  { value: "CANCELLED", label: "Cancelled" },
];

function BookingStatusModal({
  request,
  onClose,
  onUpdated,
}: {
  request: SerializedLabourRequest;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const availableStatuses = STATUS_OPTIONS.filter((option) => option.value !== request.status);
  const [newStatus, setNewStatus] = useState<LabourRequestStatus>(
    availableStatuses[0]?.value ?? request.status
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function applyStatus(status: LabourRequestStatus, statusMessage?: string) {
    setError("");

    if (status === "DENIED" && !statusMessage?.trim()) {
      setError("A message is required when denying a request");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/labour-requests/${request.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          message: statusMessage?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const json = await readJsonResponse<{ error?: string }>(res);
        setError(errorMessageFromBody(json, "Failed to update status"));
        return;
      }
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (newStatus === request.status) {
      setError("Choose a different status to update this booking");
      return;
    }
    await applyStatus(newStatus, message);
  }

  const isPending = request.status === "PENDING";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{request.siteName}</h2>
            <p className="text-sm text-muted">Current status: {STATUS_LABELS[request.status]}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-fill">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <p>
            <span className="font-medium text-ink">Dates:</span>{" "}
            {formatDateRangeDisplay(request.dates)}
          </p>
          <p>
            <span className="font-medium text-ink">Requested by:</span> {request.requestedBy.name}
          </p>
          {request.notes && (
            <p>
              <span className="font-medium text-ink">Notes:</span> {request.notes}
            </p>
          )}
          <div>
            <p className="font-medium text-ink">Workers</p>
            <ul className="mt-1 list-inside list-disc text-muted">
              {request.workers.map((w) => (
                <li key={w.id}>
                  {w.name} ({w.trade}) — {w.hoursPerDay}h/day
                  {w.companyName ? ` · ${w.companyName}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <form onSubmit={updateStatus} className="mt-4 space-y-3 border-t border-border-light pt-4">
          {isPending && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={saving}
                onClick={() => applyStatus("ACCEPTED", message)}
              >
                Accept
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={saving || !message.trim()}
                onClick={() => applyStatus("DENIED", message)}
              >
                Deny
              </Button>
            </div>
          )}
          <div>
            <Label>Change status to</Label>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as LabourRequestStatus)}
            >
              {availableStatuses.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>
              Message to site manager{newStatus === "DENIED" ? " (required)" : " (optional)"}
            </Label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                newStatus === "DENIED"
                  ? "Explain why this request was denied"
                  : "Optional note about this status change"
              }
            />
          </div>
          <p className="text-xs text-muted">
            The site manager will see this update on the site dashboard notifications widget.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
            {availableStatuses.length > 0 && (
              <Button type="submit" disabled={saving || newStatus === request.status}>
                {saving ? "Updating…" : "Update status"}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

export function AdminLabourCalendarClient() {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const [requests, setRequests] = useState<SerializedLabourRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<SerializedLabourRequest | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const from = formatDate(weekStart);
  const to = formatDate(weekEnd);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({
        from,
        to,
        status: "PENDING,ACCEPTED",
      });

      const reqRes = await fetch(`/api/labour-requests?${params}`);

      const reqJson = await readJsonResponse<{ requests?: SerializedLabourRequest[]; error?: string }>(reqRes);

      if (!reqRes.ok) {
        setLoadError(errorMessageFromBody(reqJson, "Failed to load labour requests"));
        setRequests([]);
      } else {
        setRequests(reqJson?.requests ?? []);
      }
    } catch {
      setLoadError("Failed to load labour calendar");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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

      {loadError && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-900">{loadError}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={load}>
            Retry
          </Button>
        </Card>
      )}

      {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-950">
            {pendingCount} pending request{pendingCount === 1 ? "" : "s"} this week — click a booking to review or change its status.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-border bg-neutral-100 opacity-70" /> Pending (faded)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-accent bg-accent/15" /> Accepted
        </span>
      </div>

      {loading ? (
        <Card><p className="text-sm text-muted">Loading calendar…</p></Card>
      ) : (
        <WeekCalendarGrid
          weekStart={weekStart}
          requests={requests}
          variant="admin-pending"
          onRequestClick={setSelected}
        />
      )}

      {selected && (
        <BookingStatusModal
          key={selected.id}
          request={selected}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
