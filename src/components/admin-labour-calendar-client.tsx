"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { SerializedLabourRequest } from "@/lib/labour-requests";
import { acceptBookingConflictMessage, rescheduleConflictMessage } from "@/lib/labour-conflicts";
import { formatDateRangeDisplay, rescheduleRequestDate } from "@/lib/labour-dates";
import { formatDate } from "@/lib/utils";
import { Button, Card, Input, Label, PageHeader, Select } from "./ui";
import { errorMessageFromBody, errorMessageFromResponse, readJsonResponse } from "@/lib/fetch-json";
import type { LabourRequestStatus } from "@/lib/labour-types";
import { LabourCalendarToolbar } from "./labour-calendar-toolbar";
import { LabourCalendarSettings } from "./labour-calendar-settings";
import { useAdminLabourColorEntities } from "./use-admin-labour-color-entities";
import { useLabourCalendarWeeks } from "./use-labour-calendar-weeks";
import { useLabourCalendarColors } from "./use-labour-calendar-colors";
import {
  addDays,
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

const DEFAULT_DENY_MESSAGE = "Declined from the company labour calendar.";

function BookingStatusModal({
  request,
  allRequests,
  onClose,
  onUpdated,
}: {
  request: SerializedLabourRequest;
  allRequests: SerializedLabourRequest[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const availableStatuses = STATUS_OPTIONS.filter((option) => option.value !== request.status);
  const [newStatus, setNewStatus] = useState<LabourRequestStatus>(
    availableStatuses[0]?.value ?? request.status
  );
  const [message, setMessage] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(request.workers[0]?.hoursPerDay ?? 8);
  const [saving, setSaving] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [hoursError, setHoursError] = useState("");

  const currentHours = request.workers[0]?.hoursPerDay ?? 8;
  const canEditHours = request.status === "PENDING" || request.status === "ACCEPTED";

  useEffect(() => {
    setHoursPerDay(currentHours);
  }, [request.id, currentHours]);

  async function applyStatus(
    status: LabourRequestStatus,
    statusMessage?: string,
    options?: { checkAcceptConflict?: boolean }
  ) {
    setStatusError("");

    if (status === "DENIED" && !statusMessage?.trim()) {
      setStatusError("A message is required when denying a request");
      return;
    }

    if (status === "ACCEPTED" && options?.checkAcceptConflict !== false) {
      setAcceptError("");
      const conflict = acceptBookingConflictMessage(allRequests, request);
      if (conflict) {
        setAcceptError(conflict);
        return;
      }
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
        const msg = errorMessageFromBody(json, "Failed to update status");
        if (status === "ACCEPTED") setAcceptError(msg);
        else setStatusError(msg);
        return;
      }
      onUpdated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function acceptRequest() {
    setAcceptError("");
    setStatusError("");
    await applyStatus("ACCEPTED", message, { checkAcceptConflict: true });
  }

  async function denyRequest() {
    setAcceptError("");
    setStatusError("");
    await applyStatus("DENIED", message.trim() || DEFAULT_DENY_MESSAGE, {
      checkAcceptConflict: false,
    });
  }

  async function cancelBooking() {
    setAcceptError("");
    setStatusError("");
    await applyStatus("CANCELLED", message, { checkAcceptConflict: false });
  }

  async function saveHours(e: React.FormEvent) {
    e.preventDefault();
    setHoursError("");

    if (hoursPerDay === currentHours) {
      setHoursError("Change hours before saving");
      return;
    }

    setHoursSaving(true);
    try {
      const res = await fetch(`/api/labour-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hoursPerDay }),
      });
      if (!res.ok) {
        const json = await readJsonResponse<{ error?: string }>(res);
        setHoursError(errorMessageFromBody(json, "Failed to update hours"));
        return;
      }
      onUpdated();
    } finally {
      setHoursSaving(false);
    }
  }

  async function updateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (newStatus === request.status) {
      setStatusError("Choose a different status to update this booking");
      return;
    }
    setAcceptError("");
    if (newStatus === "ACCEPTED") {
      await applyStatus("ACCEPTED", message, { checkAcceptConflict: true });
      return;
    }
    if (newStatus === "DENIED") {
      await applyStatus("DENIED", message.trim() || DEFAULT_DENY_MESSAGE, {
        checkAcceptConflict: false,
      });
      return;
    }
    await applyStatus(newStatus, message, { checkAcceptConflict: false });
  }

  const isPending = request.status === "PENDING";
  const isAccepted = request.status === "ACCEPTED";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:p-4 sm:items-center">
      <Card className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-b-xl sm:max-h-[90vh]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{request.siteName}</h2>
            <p className="text-sm text-muted">Current status: {STATUS_LABELS[request.status]}</p>
          </div>
          <button type="button" onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-fill">
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

        {canEditHours && (
          <form onSubmit={saveHours} className="mt-4 space-y-3 border-t border-border-light pt-4">
            <div>
              <Label>Hours per day</Label>
              <Input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-muted">
                Applies to all workers on this booking. The site manager will be notified when you save.
              </p>
            </div>
            {hoursError && <p className="text-sm text-red-600">{hoursError}</p>}
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="secondary"
                disabled={hoursSaving || hoursPerDay === currentHours}
              >
                {hoursSaving ? "Saving…" : "Save hours"}
              </Button>
            </div>
          </form>
        )}

        <form onSubmit={updateStatus} className="mt-4 space-y-3 border-t border-border-light pt-4">
          {isAccepted && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => void cancelBooking()}
              >
                Cancel booking
              </Button>
            </div>
          )}
          {isPending && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={saving} onClick={() => void acceptRequest()}>
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={saving}
                  onClick={() => void denyRequest()}
                >
                  Deny
                </Button>
              </div>
              {acceptError && <p className="text-sm text-red-600">{acceptError}</p>}
              <p className="text-xs text-muted">
                Deny and cancel are always available, even when another site has approved hours.
              </p>
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
              Message to site manager
              {newStatus === "DENIED" ? " (optional — used if provided)" : " (optional)"}
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
          {statusError && <p className="text-sm text-red-600">{statusError}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="ghost" className="min-h-11 w-full sm:w-auto" onClick={onClose}>
              Close
            </Button>
            {availableStatuses.length > 0 && (
              <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving || newStatus === request.status}>
                {saving ? "Updating…" : "Update status"}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

export function AdminLabourCalendarClient({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));
  const { weeks: weeksShown, setWeeks: setWeeksShown } = useLabourCalendarWeeks();
  const { colors, toggleCompanyColor, toggleWorkerColor } = useLabourCalendarColors();
  const { entities: colorEntities } = useAdminLabourColorEntities();
  const [requests, setRequests] = useState<SerializedLabourRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<SerializedLabourRequest | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const weekEnd = addDays(weekStart, weeksShown * 7 - 1);
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
          from,
          to,
          status: "PENDING,ACCEPTED",
        });

        const reqRes = await fetch(`/api/labour-requests?${params}`, {
          signal: controller.signal,
        });

        const reqJson = await readJsonResponse<{ requests?: SerializedLabourRequest[]; error?: string }>(reqRes);

        if (controller.signal.aborted) return;

        if (!reqRes.ok) {
          setLoadError(errorMessageFromResponse(reqRes, reqJson, "Failed to load labour requests"));
          setRequests([]);
        } else {
          setRequests(reqJson?.requests ?? []);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError("Failed to load labour calendar");
        setRequests([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [from, to, reloadKey, weeksShown]);

  async function handleReschedule(requestId: string, fromDate: string, toDate: string) {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    setLoadError("");

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
      setLoadError(errorMessageFromBody(json, "Failed to reschedule booking"));
      return;
    }

    reload();
  }

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <LabourCalendarSettings
            weeks={weeksShown}
            onWeeksChange={setWeeksShown}
            colorEntities={colorEntities}
            colors={colors}
            onCompanyColorToggle={toggleCompanyColor}
            onWorkerColorToggle={toggleWorkerColor}
          />
        }
      />

      <LabourCalendarToolbar
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
        weeksShown={weeksShown}
      />

      {loadError && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-900">{loadError}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={reload}>
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
        <span className="hidden sm:inline">
          Drag bookings to reschedule. Approval is blocked only when hours are already approved elsewhere.
        </span>
        <span className="sm:hidden">
          Tap a booking to review. Use Move below a booking to reschedule.
        </span>
      </div>

      {loading ? (
        <Card><p className="text-sm text-muted">Loading calendar…</p></Card>
      ) : (
        <WeekCalendarGrid
          weekStart={weekStart}
          weeksShown={weeksShown}
          requests={requests}
          colorPrefs={colors}
          variant="admin-pending"
          canDragRequest={(r) => r.status === "PENDING" || r.status === "ACCEPTED"}
          onReschedule={handleReschedule}
          onRequestClick={setSelected}
        />
      )}

      {selected && (
        <BookingStatusModal
          key={selected.id}
          request={requests.find((r) => r.id === selected.id) ?? selected}
          allRequests={requests}
          onClose={() => setSelected(null)}
          onUpdated={reload}
        />
      )}
    </div>
  );
}
