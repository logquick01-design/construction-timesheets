import type { Prisma } from "@prisma/client";
import type { SerializedLabourRequest } from "./labour-requests";
import { formatDateRangeDisplay, rescheduleRequestDate, uniqueDateStrings } from "./labour-dates";
import { formatDate, parseDateInput, startOfDay } from "./utils";

const ACTIVE_STATUSES = ["PENDING", "ACCEPTED"] as const;

export function workerBookingConflictOnDate(
  requests: SerializedLabourRequest[],
  targetDate: string,
  workerIds: string[],
  excludeRequestId: string
): string | null {
  for (const req of requests) {
    if (req.id === excludeRequestId) continue;
    if (!ACTIVE_STATUSES.includes(req.status as (typeof ACTIVE_STATUSES)[number])) continue;
    if (!Array.isArray(req.dates) || !req.dates.includes(targetDate)) continue;

    for (const worker of req.workers) {
      if (workerIds.includes(worker.workerId)) {
        return `${worker.name} is already booked on ${targetDate}`;
      }
    }
  }
  return null;
}

export function rescheduleConflictMessage(
  requests: SerializedLabourRequest[],
  request: SerializedLabourRequest,
  fromDate: string,
  toDate: string
): string | null {
  const newDates = rescheduleRequestDate(request.dates, fromDate, toDate);
  if (!newDates) return null;

  const workerIds = request.workers.map((w) => w.workerId);
  return workerBookingConflictOnDate(requests, toDate, workerIds, request.id);
}

export async function findWorkerBookingConflict(
  tx: Prisma.TransactionClient,
  input: {
    siteId: string;
    workerIds: string[];
    dates: string[];
    excludeRequestId?: string;
  }
): Promise<string | null> {
  const { siteId, workerIds, dates, excludeRequestId } = input;
  const uniqueDates = uniqueDateStrings(dates);

  for (const dateStr of uniqueDates) {
    const day = startOfDay(parseDateInput(dateStr));

    for (const workerId of workerIds) {
      const conflict = await tx.labourRequestWorker.findFirst({
        where: {
          workerId,
          labourRequest: {
            siteId,
            status: { in: [...ACTIVE_STATUSES] },
            ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            days: { some: { date: day } },
          },
        },
        include: { worker: { select: { name: true } } },
      });

      if (conflict) {
        return `${conflict.worker.name} is already booked on ${dateStr}`;
      }
    }
  }

  return null;
}

export function describeDateChange(previousDates: string[], newDates: string[]): string {
  return `Dates changed from ${formatDateRangeDisplay(previousDates)} to ${formatDateRangeDisplay(newDates)}`;
}

export function describeHoursChange(previousHours: number, newHours: number): string {
  return `Hours changed from ${previousHours}h/day to ${newHours}h/day`;
}

export function datesFromRecords(days: { date: Date }[]): string[] {
  return uniqueDateStrings(days.map((d) => formatDate(d.date)));
}
