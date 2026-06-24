import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canReviewLabourRequests } from "@/lib/permissions";
import {
  labourNotificationMeta,
  labourStatusNotificationContent,
} from "@/lib/labour-notifications";
import { labourRequestInclude, serializeLabourRequest } from "@/lib/labour-requests";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  action: z.enum(["accept", "deny"]),
  denialReason: z.string().max(500).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canReviewLabourRequests(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.labourRequest.findUnique({
    where: { id },
    include: labourRequestInclude,
  });

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action, denialReason } = parsed.data;
  const newStatus = action === "accept" ? "ACCEPTED" : "DENIED";

  if (existing.status === newStatus) {
    return NextResponse.json({ error: "Request already has this status" }, { status: 400 });
  }

  if (action === "deny" && !denialReason?.trim()) {
    return NextResponse.json({ error: "Denial reason is required" }, { status: 400 });
  }

  const dates = existing.days.map((d) => formatDate(d.date));
  const workerNames = existing.workers.map((w) => w.worker.name);
  const previousStatus = existing.status;
  const notification = labourStatusNotificationContent(
    newStatus,
    action === "deny" ? denialReason : undefined
  );

  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.labourRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedById: session.id,
        reviewedAt: new Date(),
        denialReason: action === "deny" ? denialReason!.trim() : null,
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

    return request;
  });

  return NextResponse.json({ request: serializeLabourRequest(updated) });
}
