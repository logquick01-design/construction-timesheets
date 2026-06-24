"use client";

import { useRef, useState } from "react";
import type { SerializedLabourRequest } from "@/lib/labour-requests";
import type { LabourRequestStatus } from "@/lib/labour-types";
import { DEFAULT_LABOUR_CALENDAR_WEEKS } from "@/lib/labour-calendar-preferences";
import {
  cardBookingColorTags,
  type LabourCalendarColorPrefs,
} from "@/lib/labour-calendar-colors";
import { cn, formatDate, parseDateInput } from "@/lib/utils";
import { LabourBookingColorTags } from "./labour-color-dot";

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

type DragPayload = {
  requestId: string;
  sourceDate: string;
};

const DRAG_MIME = "application/x-labour-request";

export function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export function getCalendarDays(rangeStart: Date, weeks = DEFAULT_LABOUR_CALENDAR_WEEKS): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(rangeStart);
    d.setDate(rangeStart.getDate() + i);
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
  return requests.filter((r) => Array.isArray(r.dates) && r.dates.includes(dateStr));
}

function parseDragPayload(dataTransfer: DataTransfer): DragPayload | null {
  const raw = dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (parsed.requestId && parsed.sourceDate) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function LabourRequestCard({
  request,
  dateStr,
  variant = "site",
  draggable = false,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging = false,
  colorPrefs,
}: {
  request: SerializedLabourRequest;
  dateStr: string;
  variant?: "site" | "admin-pending" | "admin-accepted";
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  colorPrefs?: LabourCalendarColorPrefs;
}) {
  const skipClickRef = useRef(false);

  const workerLabel =
    request.workers.length === 0
      ? "No workers"
      : request.workers.length === 1
        ? request.workers[0].name
        : `${request.workers.length} workers`;

  const bookingTags = colorPrefs
    ? cardBookingColorTags(
        request.workers.map((w) => ({ workerId: w.workerId, companyId: w.companyId })),
        colorPrefs
      )
    : { companyTags: [], workerTags: [] };

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
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        skipClickRef.current = true;
        e.dataTransfer.setData(
          DRAG_MIME,
          JSON.stringify({ requestId: request.id, sourceDate: dateStr })
        );
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => {
        requestAnimationFrame(() => {
          skipClickRef.current = false;
        });
        onDragEnd?.();
      }}
      onClick={() => {
        if (skipClickRef.current) return;
        onClick?.();
      }}
      className={cn(
        "w-full rounded-lg border px-2 py-1.5 text-left text-xs transition hover:ring-2 hover:ring-accent/30",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        styles[request.status]
      )}
    >
      {variant !== "site" && (
        <p className="mb-0.5 truncate font-semibold">{request.siteName}</p>
      )}
      <p className="flex items-center gap-1 truncate text-[11px] font-medium leading-tight">
        <LabourBookingColorTags
          companyTags={bookingTags.companyTags}
          workerTags={bookingTags.workerTags}
          size="xs"
        />
        <span className="truncate">{workerLabel}</span>
      </p>
      <p className="truncate text-[10px] opacity-80">{STATUS_LABELS[request.status]}</p>
    </button>
  );
}

export function WeekCalendarGrid({
  weekStart,
  weeksShown,
  requests,
  variant = "site",
  onDayClick,
  onRequestClick,
  canCreate,
  canDragRequest,
  onReschedule,
  colorPrefs,
}: {
  weekStart: Date;
  weeksShown: number;
  requests: SerializedLabourRequest[];
  variant?: "site" | "admin-pending" | "admin-accepted";
  onDayClick?: (dateStr: string) => void;
  onRequestClick?: (request: SerializedLabourRequest) => void;
  canCreate?: boolean;
  canDragRequest?: (request: SerializedLabourRequest) => boolean;
  onReschedule?: (requestId: string, fromDate: string, toDate: string) => void;
  colorPrefs?: LabourCalendarColorPrefs;
}) {
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const weeks: Date[][] = [];
  const allDays = getCalendarDays(weekStart, weeksShown);
  for (let w = 0; w < weeksShown; w++) {
    weeks.push(allDays.slice(w * 7, w * 7 + 7));
  }

  function handleDrop(targetDate: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverDate(null);
    const payload = parseDragPayload(e.dataTransfer);
    if (!payload || payload.sourceDate === targetDate) return;
    onReschedule?.(payload.requestId, payload.sourceDate, targetDate);
  }

  return (
    <div className="overflow-x-auto space-y-4">
      {weeks.map((weekDays, weekIndex) => (
        <div key={weekIndex}>
          {weeksShown > 1 && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {formatWeekLabel(addDays(weekStart, weekIndex * 7), 1)}
            </p>
          )}
          <div className="min-w-[640px] grid grid-cols-7 gap-2">
            {weekDays.map((day, i) => {
        const dateStr = formatDate(day);
        const dayRequests = requestsForDate(requests, dateStr);
        const isWeekend = i >= 5;
        const isDropTarget = dragOverDate === dateStr;

        return (
          <div
            key={dateStr}
            onDragOver={(e) => {
              if (!onReschedule) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverDate(dateStr);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDragOverDate((current) => (current === dateStr ? null : current));
            }}
            onDrop={(e) => handleDrop(dateStr, e)}
            className={cn(
              "min-h-32 rounded-xl border border-border bg-surface p-2 transition-colors",
              isWeekend && "bg-fill/40",
              isDropTarget && "border-accent bg-accent/5 ring-2 ring-accent/25"
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
                  dateStr={dateStr}
                  variant={variant}
                  draggable={Boolean(canDragRequest?.(r) && onReschedule)}
                  isDragging={draggingKey === `${r.id}-${dateStr}`}
                  colorPrefs={colorPrefs}
                  onClick={() => onRequestClick?.(r)}
                  onDragStart={() => setDraggingKey(`${r.id}-${dateStr}`)}
                  onDragEnd={() => setDraggingKey(null)}
                />
              ))}
              {dayRequests.length === 0 && isDropTarget && (
                <p className="py-2 text-center text-[11px] text-muted">Drop here</p>
              )}
            </div>
          </div>
        );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function formatWeekLabel(weekStart: Date, weeks = DEFAULT_LABOUR_CALENDAR_WEEKS): string {
  const end = addDays(weekStart, weeks * 7 - 1);
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
