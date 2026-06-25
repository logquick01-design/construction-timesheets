import type { Prisma } from "@prisma/client";
import type { SerializedLabourRequest } from "./labour-requests";
import { formatDateRangeDisplay, rescheduleRequestDate, uniqueDateStrings } from "./labour-dates";
import { formatDate, parseDateInput, startOfDay } from "./utils";

const ACTIVE_STATUSES = ["PENDING", "ACCEPTED"] as const;
const APPROVED_STATUSES = ["ACCEPTED"] as const;

export type BookingWorkerRef = {
  workerId: string;
  personId: string | null;
  name: string;
  hoursPerDay: number;
};

function hoursLabel(hoursPerDay: number): string {
  return hoursPerDay % 1 === 0 ? `${hoursPerDay}h/day` : `${hoursPerDay}h/day`;
}

function conflictMessage(
  workerName: string,
  dateStr: string,
  hoursPerDay: number,
  siteName?: string
): string {
  const sitePart = siteName ? ` at ${siteName}` : "";
  return `${workerName} is already booked${sitePart} on ${dateStr} (${hoursLabel(hoursPerDay)})`;
}

export function bookingWarningMessage(
  workerName: string,
  dateStr: string,
  hoursPerDay: number,
  siteName?: string
): string {
  const sitePart = siteName ? ` at ${siteName}` : "";
  return `${workerName} is currently booked${sitePart} on ${dateStr} (${hoursLabel(hoursPerDay)})`;
}

export function workerBookingConflictOnDate(
  requests: SerializedLabourRequest[],
  targetDate: string,
  workers: BookingWorkerRef[],
  excludeRequestId: string,
  options?: {
    statuses?: readonly string[];
    excludeSiteId?: string;
  }
): string | null {
  const statuses = options?.statuses ?? ACTIVE_STATUSES;
  const personIds = new Set(workers.map((w) => w.personId).filter(Boolean) as string[]);
  const workerIds = new Set(workers.map((w) => w.workerId));

  for (const req of requests) {
    if (req.id === excludeRequestId) continue;
    if (options?.excludeSiteId && req.siteId === options.excludeSiteId) continue;
    if (!statuses.includes(req.status)) continue;
    if (!Array.isArray(req.dates) || !req.dates.includes(targetDate)) continue;

    for (const worker of req.workers) {
      const matchesPerson = worker.personId != null && personIds.has(worker.personId);
      const matchesWorkerId = workerIds.has(worker.workerId);
      if (!matchesPerson && !matchesWorkerId) continue;

      return conflictMessage(
        worker.name,
        targetDate,
        worker.hoursPerDay,
        req.siteName
      );
    }
  }
  return null;
}

export function workerBookingWarningOnDate(
  acceptedRequests: SerializedLabourRequest[],
  targetDate: string,
  workers: BookingWorkerRef[],
  excludeRequestId: string,
  currentSiteId: string
): string | null {
  const personIds = new Set(workers.map((w) => w.personId).filter(Boolean) as string[]);

  for (const req of acceptedRequests) {
    if (req.id === excludeRequestId) continue;
    if (req.siteId === currentSiteId) continue;
    if (req.status !== "ACCEPTED") continue;
    if (!req.dates.includes(targetDate)) continue;

    for (const worker of req.workers) {
      const matchesPerson = worker.personId != null && personIds.has(worker.personId);
      if (!matchesPerson) continue;

      return bookingWarningMessage(
        worker.name,
        targetDate,
        worker.hoursPerDay,
        req.siteName
      );
    }
  }

  return null;
}

export function formBookingConflictMessage(
  requests: SerializedLabourRequest[],
  dates: string[],
  workers: BookingWorkerRef[],
  excludeRequestId?: string
): string | null {
  for (const date of uniqueDateStrings(dates)) {
    const conflict = workerBookingConflictOnDate(
      requests,
      date,
      workers,
      excludeRequestId ?? ""
    );
    if (conflict) return conflict;
  }
  return null;
}

export function formBookingWarningMessage(
  acceptedRequests: SerializedLabourRequest[],
  dates: string[],
  workers: BookingWorkerRef[],
  currentSiteId: string,
  excludeRequestId?: string
): string | null {
  for (const date of uniqueDateStrings(dates)) {
    const warning = workerBookingWarningOnDate(
      acceptedRequests,
      date,
      workers,
      excludeRequestId ?? "",
      currentSiteId
    );
    if (warning) return warning;
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

  const workers: BookingWorkerRef[] = request.workers.map((w) => ({
    workerId: w.workerId,
    personId: w.personId,
    name: w.name,
    hoursPerDay: w.hoursPerDay,
  }));
  return workerBookingConflictOnDate(requests, toDate, workers, request.id, {
    statuses: APPROVED_STATUSES,
  });
}

export function rescheduleWarningMessage(
  acceptedRequests: SerializedLabourRequest[],
  request: SerializedLabourRequest,
  fromDate: string,
  toDate: string,
  currentSiteId: string
): string | null {
  const newDates = rescheduleRequestDate(request.dates, fromDate, toDate);
  if (!newDates) return null;

  const workers: BookingWorkerRef[] = request.workers.map((w) => ({
    workerId: w.workerId,
    personId: w.personId,
    name: w.name,
    hoursPerDay: w.hoursPerDay,
  }));
  return workerBookingWarningOnDate(
    acceptedRequests,
    toDate,
    workers,
    request.id,
    currentSiteId
  );
}

export async function findWorkerBookingWarning(
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
  const uniqueWorkerIds = [...new Set(workerIds)];

  if (uniqueWorkerIds.length === 0 || uniqueDates.length === 0) return null;

  const workers = await tx.worker.findMany({
    where: { id: { in: uniqueWorkerIds }, siteId },
    select: { id: true, name: true, personId: true },
  });

  if (workers.length !== uniqueWorkerIds.length) return null;

  const personIds = new Set<string>();
  for (const worker of workers) {
    if (worker.personId) {
      personIds.add(worker.personId);
      continue;
    }

    const linkedElsewhere = await tx.worker.findMany({
      where: {
        name: worker.name,
        siteId: { not: siteId },
        personId: { not: null },
      },
      select: { personId: true },
    });
    for (const match of linkedElsewhere) {
      if (match.personId) personIds.add(match.personId);
    }
  }

  for (const dateStr of uniqueDates) {
    const day = startOfDay(parseDateInput(dateStr));

    for (const personId of personIds) {
      const conflict = await tx.labourRequestWorker.findFirst({
        where: {
          worker: { personId },
          labourRequest: {
            siteId: { not: siteId },
            status: "ACCEPTED",
            ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            days: { some: { date: day } },
          },
        },
        include: {
          worker: { select: { name: true } },
          labourRequest: { include: { site: { select: { name: true } } } },
        },
      });

      if (conflict) {
        return bookingWarningMessage(
          conflict.worker.name,
          dateStr,
          conflict.hoursPerDay,
          conflict.labourRequest.site.name
        );
      }
    }

    for (const worker of workers.filter((w) => !w.personId)) {
      const conflict = await tx.labourRequestWorker.findFirst({
        where: {
          worker: { name: worker.name },
          labourRequest: {
            siteId: { not: siteId },
            status: "ACCEPTED",
            ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            days: { some: { date: day } },
          },
        },
        include: {
          worker: { select: { name: true } },
          labourRequest: { include: { site: { select: { name: true } } } },
        },
      });

      if (conflict) {
        return bookingWarningMessage(
          conflict.worker.name,
          dateStr,
          conflict.hoursPerDay,
          conflict.labourRequest.site.name
        );
      }
    }
  }

  return null;
}

export function acceptBookingConflictMessage(
  requests: SerializedLabourRequest[],
  request: SerializedLabourRequest
): string | null {
  const workers: BookingWorkerRef[] = request.workers.map((w) => ({
    workerId: w.workerId,
    personId: w.personId,
    name: w.name,
    hoursPerDay: w.hoursPerDay,
  }));

  for (const date of uniqueDateStrings(request.dates)) {
    const conflict = workerBookingConflictOnDate(requests, date, workers, request.id, {
      statuses: APPROVED_STATUSES,
    });
    if (conflict) return conflict;
  }
  return null;
}

export async function findWorkerBookingConflict(
  tx: Prisma.TransactionClient,
  input: {
    workerIds: string[];
    dates: string[];
    excludeRequestId?: string;
  }
): Promise<string | null> {
  const { workerIds, dates, excludeRequestId } = input;
  const uniqueDates = uniqueDateStrings(dates);
  const uniqueWorkerIds = [...new Set(workerIds)];

  if (uniqueWorkerIds.length === 0 || uniqueDates.length === 0) return null;

  const workers = await tx.worker.findMany({
    where: { id: { in: uniqueWorkerIds } },
    select: { id: true, name: true, personId: true },
  });

  if (workers.length !== uniqueWorkerIds.length) {
    return "One or more workers are invalid";
  }

  const personIds = new Set<string>();
  for (const worker of workers) {
    if (worker.personId) {
      personIds.add(worker.personId);
      continue;
    }

    const linkedElsewhere = await tx.worker.findMany({
      where: {
        name: worker.name,
        personId: { not: null },
        ...(worker.id ? { id: { not: worker.id } } : {}),
      },
      select: { personId: true },
    });
    for (const match of linkedElsewhere) {
      if (match.personId) personIds.add(match.personId);
    }
  }

  for (const dateStr of uniqueDates) {
    const day = startOfDay(parseDateInput(dateStr));

    for (const personId of personIds) {
      const conflict = await tx.labourRequestWorker.findFirst({
        where: {
          worker: { personId },
          labourRequest: {
            status: "ACCEPTED",
            ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            days: { some: { date: day } },
          },
        },
        include: {
          worker: { select: { name: true } },
          labourRequest: { include: { site: { select: { name: true } } } },
        },
      });

      if (conflict) {
        return conflictMessage(
          conflict.worker.name,
          dateStr,
          conflict.hoursPerDay,
          conflict.labourRequest.site.name
        );
      }
    }

    for (const worker of workers.filter((w) => !w.personId)) {
      const conflict = await tx.labourRequestWorker.findFirst({
        where: {
          worker: { name: worker.name },
          labourRequest: {
            status: "ACCEPTED",
            ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            days: { some: { date: day } },
          },
        },
        include: {
          worker: { select: { name: true } },
          labourRequest: { include: { site: { select: { name: true } } } },
        },
      });

      if (conflict) {
        return conflictMessage(
          conflict.worker.name,
          dateStr,
          conflict.hoursPerDay,
          conflict.labourRequest.site.name
        );
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

export function bookingWorkersFromIds(
  workerIds: string[],
  workersById: Map<
    string,
    { id: string; name: string; personId: string | null; hoursPerDay?: number }
  >,
  hoursPerDay: number
): BookingWorkerRef[] {
  return workerIds.map((workerId) => {
    const worker = workersById.get(workerId);
    return {
      workerId,
      personId: worker?.personId ?? null,
      name: worker?.name ?? "Worker",
      hoursPerDay: worker?.hoursPerDay ?? hoursPerDay,
    };
  });
}
