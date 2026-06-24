import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import {
  datesFromRecords,
  describeDateChange,
  describeHoursChange,
  findWorkerBookingConflict,
} from "@/lib/labour-conflicts";
import { uniqueDateStrings, stringsToDates } from "@/lib/labour-dates";
import {
  labourNotificationMeta,
  labourUpdateNotificationContent,
} from "@/lib/labour-notifications";
import { labourRequestInclude, serializeLabourRequest } from "@/lib/labour-requests";
import { canCreateLabourRequest, canReviewLabourRequests } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "@/lib/utils";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  workerIds: z.array(z.string().min(1)).min(1).optional(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).optional(),
  hoursPerDay: z.number().positive().max(24).optional(),
  notes: z.string().max(500).nullish(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canCreateLabourRequest(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.labourRequest.findUnique({
    where: { id },
    include: labourRequestInclude,
  });

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessSite(session, existing.siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { workerIds, dates, hoursPerDay, notes } = parsed.data;
  const isAdmin = canReviewLabourRequests(session);
  const isPending = existing.status === "PENDING";
  const isAccepted = existing.status === "ACCEPTED";

  const dateOnlyUpdate =
    dates !== undefined &&
    workerIds === undefined &&
    hoursPerDay === undefined &&
    notes === undefined;
  const hoursOnlyUpdate =
    hoursPerDay !== undefined &&
    workerIds === undefined &&
    dates === undefined &&
    notes === undefined;
  const adminAcceptedUpdate =
    isAdmin && isAccepted && (dateOnlyUpdate || hoursOnlyUpdate);

  if (!isPending && !adminAcceptedUpdate) {
    return NextResponse.json({ error: "Only pending requests can be edited" }, { status: 400 });
  }

  if (workerIds) {
    const uniqueWorkerIds = [...new Set(workerIds)];
    const workerCount = await prisma.worker.count({
      where: { siteId: existing.siteId, active: true, id: { in: uniqueWorkerIds } },
    });
    if (workerCount !== uniqueWorkerIds.length) {
      return NextResponse.json({ error: "One or more workers are invalid for this site" }, { status: 400 });
    }
  }

  const previousDates = datesFromRecords(existing.days);
  const previousHours = existing.workers[0]?.hoursPerDay ?? 8;
  const workerIdsForConflict = existing.workers.map((w) => w.workerId);

  if (dates) {
    const nextDates = uniqueDateStrings(dates);
    const conflict = await findWorkerBookingConflict(prisma, {
      siteId: existing.siteId,
      workerIds: workerIdsForConflict,
      dates: nextDates,
      excludeRequestId: id,
    });
    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (dates) {
        await tx.labourRequestDay.deleteMany({ where: { labourRequestId: id } });
        const dateValues = stringsToDates(uniqueDateStrings(dates));
        await tx.labourRequestDay.createMany({
          data: dateValues.map((date) => ({
            labourRequestId: id,
            date: startOfDay(date),
          })),
        });
      }

      if (workerIds) {
        await tx.labourRequestWorker.deleteMany({ where: { labourRequestId: id } });
        const uniqueWorkerIds = [...new Set(workerIds)];
        await tx.labourRequestWorker.createMany({
          data: uniqueWorkerIds.map((workerId) => ({
            labourRequestId: id,
            workerId,
            hoursPerDay: hoursPerDay ?? existing.workers[0]?.hoursPerDay ?? 8,
          })),
        });
      } else if (hoursPerDay !== undefined) {
        await tx.labourRequestWorker.updateMany({
          where: { labourRequestId: id },
          data: { hoursPerDay },
        });
      }

      const labourRequest = await tx.labourRequest.update({
        where: { id },
        data: {
          ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
        },
        include: labourRequestInclude,
      });

      if (isAdmin) {
        const newDates = datesFromRecords(labourRequest.days);
        const newHours = labourRequest.workers[0]?.hoursPerDay ?? 8;
        const workerNames = labourRequest.workers.map((w) => w.worker.name);
        const changes: string[] = [];

        if (dates && previousDates.join(",") !== newDates.join(",")) {
          changes.push(describeDateChange(previousDates, newDates));
        }
        if (hoursPerDay !== undefined && previousHours !== newHours) {
          changes.push(describeHoursChange(previousHours, newHours));
        }

        if (changes.length > 0) {
          const notification = labourUpdateNotificationContent(changes);
          await tx.siteNotification.create({
            data: {
              siteId: existing.siteId,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              meta: labourNotificationMeta({
                labourRequestId: id,
                workerNames,
                dates: newDates,
                previousDates,
                previousHours:
                  hoursPerDay !== undefined && previousHours !== newHours
                    ? previousHours
                    : undefined,
                newHours:
                  hoursPerDay !== undefined && previousHours !== newHours ? newHours : undefined,
              }),
            },
          });
        }
      }

      return labourRequest;
    });

    return NextResponse.json({ request: serializeLabourRequest(updated) });
  } catch (error) {
    console.error("PATCH /api/labour-requests/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update labour request" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canCreateLabourRequest(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.labourRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessSite(session, existing.siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending requests can be cancelled" }, { status: 400 });
  }

  await prisma.labourRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ ok: true });
}
