import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findWorkerBookingConflict } from "@/lib/labour-conflicts";
import { canReviewLabourRequests } from "@/lib/permissions";
import {
  labourNotificationMeta,
  labourStatusNotificationContent,
} from "@/lib/labour-notifications";
import { labourRequestInclude, serializeLabourRequest } from "@/lib/labour-requests";
import { isLabourRequestStatus } from "@/lib/labour-types";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const statusSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "DENIED", "CANCELLED"]),
  message: z.string().max(500).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canReviewLabourRequests(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const existing = await prisma.labourRequest.findUnique({
      where: { id },
      include: labourRequestInclude,
    });

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { status: newStatus, message } = parsed.data;
    const previousStatus = existing.status;

    if (!isLabourRequestStatus(previousStatus)) {
      return NextResponse.json({ error: "Invalid current status" }, { status: 400 });
    }

    if (newStatus === previousStatus) {
      return NextResponse.json({ error: "Status is already set to this value" }, { status: 400 });
    }

    if (newStatus === "DENIED" && !message?.trim()) {
      return NextResponse.json({ error: "A message is required when denying a request" }, { status: 400 });
    }

    const dates = existing.days.map((d) => formatDate(d.date));
    const workerNames = existing.workers.map((w) => w.worker.name);
    const notification = labourStatusNotificationContent(newStatus, message);

    if (newStatus === "ACCEPTED") {
      const conflict = await findWorkerBookingConflict(prisma, {
        workerIds: existing.workers.map((w) => w.workerId),
        dates,
        excludeRequestId: id,
      });
      if (conflict) {
        return NextResponse.json({ error: conflict }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const labourRequest = await tx.labourRequest.update({
        where: { id },
        data: {
          status: newStatus,
          reviewedById: session.id,
          reviewedAt: new Date(),
          denialReason: newStatus === "DENIED" ? message!.trim() : null,
        },
        include: labourRequestInclude,
      });

      await tx.siteNotification.create({
        data: {
          siteId: existing.siteId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          meta: labourNotificationMeta({
            labourRequestId: id,
            workerNames,
            dates,
            previousStatus,
            newStatus,
          }),
        },
      });

      return labourRequest;
    });

    return NextResponse.json({ request: serializeLabourRequest(updated) });
  } catch (error) {
    console.error("POST /api/labour-requests/[id]/status failed:", error);
    return NextResponse.json({ error: "Failed to update booking status" }, { status: 500 });
  }
}
