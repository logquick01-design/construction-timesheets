"use client";

import type { SerializedLabourRequest } from "@/lib/labour-requests";
import type { LabourRequestStatus } from "@/lib/labour-types";
import { cn, formatDate, parseDateInput } from "@/lib/utils";

export type WorkerOption = {
  id: string;
  name: string;
  trade: string;
  company: { id: string; name: string } | null;
};

export const STATUS_LABELS: Record<LabourRequestStatus, string> = {
  PENDING: "Pending approval",
  ACCEPTED: "Accepted",
  DENIED: "Denied",
  CANCELLED: "Cancelled",
};

export function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export function getMondayOfWeek(reference: Date): Date {
  const day = reference.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function requestsForDate(requests: SerializedLabourRequest[], dateStr: string) {
  return requests.filter((r) => r.dates.includes(dateStr));
}

export function LabourRequestCard({
  request,
  variant = "site",
  onClick,
}: {
  request: SerializedLabourRequest;
  variant?: "site" | "admin-pending" | "admin-accepted";
  onClick?: () => void;
}) {
  const workerLabel =
    request.workers.length === 0
      ? "No workers"
      : request.workers.length === 1
        ? request.workers[0].name
        : `${request.workers.length} workers`;

  const styles = {
    site: {
      PENDING: "border-amber-400 bg-amber-50 text-amber-950",
      ACCEPTED: "border-accent bg-accent/15 text-ink",
      DENIED: "border-red-300 bg-red-50 text-red-900",
      CANCELLED: "border-border bg-fill text-muted",
    },
    "admin-pending": {
      PENDING: "border-border bg-neutral-100/80 text-neutral-500 opacity-70",
      ACCEPTED: "border-accent bg-accent/10 text-ink",
      DENIED: "border-red-200 bg-red-50 text-red-800",
      CANCELLED: "border-border bg-fill text-muted",
    },
    "admin-accepted": {
      PENDING: "border-amber-300 bg-amber-50 text-amber-950",
      ACCEPTED: "border-accent bg-accent/15 text-ink",
      DENIED: "border-red-200 bg-red-50 text-red-800",
      CANCELLED: "border-border bg-fill text-muted",
    },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-2 py-1.5 text-left text-xs transition hover:ring-2 hover:ring-accent/30",
        styles[request.status]
      )}
    >
      {variant !== "site" && (
        <p className="mb-0.5 truncate font-semibold">{request.siteName}</p>
      )}
      <p className="truncate font-medium">{workerLabel}</p>
      <p className="truncate text-[11px] opacity-80">{STATUS_LABELS[request.status]}</p>
    </button>
  );
}

export function WeekCalendarGrid({
  weekStart,
  requests,
  variant = "site",
  onDayClick,
  onRequestClick,
  canCreate,
}: {
  weekStart: Date;
  requests: SerializedLabourRequest[];
  variant?: "site" | "admin-pending" | "admin-accepted";
  onDayClick?: (dateStr: string) => void;
  onRequestClick?: (request: SerializedLabourRequest) => void;
  canCreate?: boolean;
}) {
  const days = getWeekDays(weekStart);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const dateStr = formatDate(day);
        const dayRequests = requestsForDate(requests, dateStr);
        const isWeekend = i >= 5;

        return (
          <div
            key={dateStr}
            className={cn(
              "min-h-32 rounded-xl border border-border bg-surface p-2",
              isWeekend && "bg-fill/40"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <div>
                <p className="text-xs font-semibold uppercase text-muted">{dayNames[i]}</p>
                <p className="text-sm font-medium text-ink">
                  {String(day.getDate()).padStart(2, "0")}/
                  {String(day.getMonth() + 1).padStart(2, "0")}
                </p>
              </div>
              {canCreate && onDayClick && (
                <button
                  type="button"
                  onClick={() => onDayClick(dateStr)}
                  className="rounded-md px-1.5 py-0.5 text-lg leading-none text-accent hover:bg-accent/10"
                  aria-label={`Add request for ${dateStr}`}
                >
                  +
                </button>
              )}
            </div>
            <div className="space-y-1">
              {dayRequests.map((r) => (
                <LabourRequestCard
                  key={`${r.id}-${dateStr}`}
                  request={r}
                  variant={variant}
                  onClick={() => onRequestClick?.(r)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export { parseDateInput };
