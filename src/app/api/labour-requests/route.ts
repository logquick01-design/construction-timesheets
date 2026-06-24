import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { canCreateLabourRequest, canReviewLabourRequests } from "@/lib/permissions";
import { uniqueDateStrings, stringsToDates } from "@/lib/labour-dates";
import { labourRequestInclude, serializeLabourRequest } from "@/lib/labour-requests";
import { prisma } from "@/lib/prisma";
import { endOfDay, parseDateInput, startOfDay } from "@/lib/utils";
import { isLabourRequestStatus } from "@/lib/labour-types";
import type { LabourRequestStatus } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  siteId: z.string().min(1),
  workerIds: z.array(z.string().min(1)).min(1),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  hoursPerDay: z.number().positive().max(24).optional(),
  notes: z.string().max(500).nullish(),
});

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const statusParam = searchParams.get("status");

    if (!fromStr || !toStr) {
      return NextResponse.json({ error: "from and to required" }, { status: 400 });
    }

    const from = startOfDay(parseDateInput(fromStr));
    const to = endOfDay(parseDateInput(toStr));

    if (siteId && !canAccessSite(session, siteId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!siteId && !canReviewLabourRequests(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const statuses: LabourRequestStatus[] = [];
    if (statusParam) {
      for (const part of statusParam.split(",")) {
        const status = part.trim();
        if (isLabourRequestStatus(status)) statuses.push(status);
      }
    }

    const requests = await prisma.labourRequest.findMany({
      where: {
        ...(siteId ? { siteId } : {}),
        ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
        days: {
          some: {
            date: { gte: from, lte: to },
          },
        },
      },
      include: labourRequestInclude,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      requests: requests.map(serializeLabourRequest),
    });
  } catch (error) {
    console.error("GET /api/labour-requests failed:", error);
    return NextResponse.json(
      { error: "Failed to load labour requests. Try restarting the dev server after pulling updates." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canCreateLabourRequest(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { siteId, workerIds, notes } = parsed.data;
    const dates = uniqueDateStrings(parsed.data.dates);
    const hoursPerDay = parsed.data.hoursPerDay ?? 8;

    if (!canAccessSite(session, siteId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const uniqueWorkerIds = [...new Set(workerIds)];
    const workerCount = await prisma.worker.count({
      where: { siteId, active: true, id: { in: uniqueWorkerIds } },
    });
    if (workerCount !== uniqueWorkerIds.length) {
      return NextResponse.json({ error: "One or more workers are invalid for this site" }, { status: 400 });
    }

    const dateValues = stringsToDates(dates);

    const created = await prisma.labourRequest.create({
      data: {
        siteId,
        requestedById: session.id,
        notes: notes?.trim() || null,
        days: {
          create: dateValues.map((date) => ({ date: startOfDay(date) })),
        },
        workers: {
          create: uniqueWorkerIds.map((workerId) => ({
            workerId,
            hoursPerDay,
          })),
        },
      },
      include: labourRequestInclude,
    });

    return NextResponse.json({ request: serializeLabourRequest(created) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/labour-requests failed:", error);
    return NextResponse.json({ error: "Failed to create labour request" }, { status: 500 });
  }
}
