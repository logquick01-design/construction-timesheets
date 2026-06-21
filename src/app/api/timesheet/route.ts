import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { canLogHours } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { endOfDay, parseDateInput, startOfDay } from "@/lib/utils";
import { z } from "zod";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const dateStr = searchParams.get("date");

  if (!siteId || !dateStr) {
    return NextResponse.json({ error: "siteId and date required" }, { status: 400 });
  }

  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const date = parseDateInput(dateStr);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [workers, entries, categories] = await Promise.all([
    prisma.worker.findMany({
      where: {
        active: true,
        siteId,
      },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
      include: { company: true },
    }),
    prisma.timesheetEntry.findMany({
      where: { siteId, date: { gte: dayStart, lte: dayEnd } },
      include: {
        task: { include: { category: true } },
      },
    }),
    prisma.costCodeCategory.findMany({
      where: { active: true, siteId },
      orderBy: { sortOrder: "asc" },
      include: {
        tasks: {
          where: { active: true },
          orderBy: { name: "asc" },
        },
      },
    }),
  ]);

  return NextResponse.json({ workers, entries, categories });
}

const rowSchema = z.object({
  workerId: z.string(),
  taskId: z.string(),
  hours: z.number().positive().max(24),
  comment: z.string().max(200).nullish(),
});

const saveSchema = z.object({
  siteId: z.string(),
  date: z.string(),
  rows: z.array(rowSchema),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canLogHours(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { siteId, date: dateStr, rows } = parsed.data;
  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const date = parseDateInput(dateStr);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const workerIds = [...new Set(rows.map((r) => r.workerId))];
  const assigned = await prisma.worker.count({
    where: { siteId, id: { in: workerIds } },
  });
  if (assigned !== workerIds.length) {
    return NextResponse.json({ error: "Worker not assigned to site" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.timesheetEntry.deleteMany({
        where: { siteId, date: { gte: dayStart, lte: dayEnd } },
      });
      if (rows.length > 0) {
        await tx.timesheetEntry.createMany({
          data: rows.map((r) => {
            const comment = r.comment?.trim();
            return {
              workerId: r.workerId,
              siteId,
              taskId: r.taskId,
              date: dayStart,
              hours: r.hours,
              ...(comment ? { comment } : {}),
            };
          }),
        });
      }
    });

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error("Timesheet save failed:", err);
    const message =
      err instanceof Error && err.message.includes("Unknown argument `comment`")
        ? "Database schema is out of date — restart the app after running npm run db:push"
        : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
