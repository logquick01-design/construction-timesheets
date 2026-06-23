import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { repairCorruptSiteTaskBudgets } from "@/lib/dashboard-preferences-repair";
import { mergeTaskBudgets, taskBudgetsSchema } from "@/lib/task-budgets";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await context.params;
  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await repairCorruptSiteTaskBudgets(prisma);

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { taskBudgetWidget: true },
  });

  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  return NextResponse.json({
    taskBudgets: mergeTaskBudgets(site.taskBudgetWidget),
  });
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await context.params;
  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = taskBudgetsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task budget settings" }, { status: 400 });
  }

  const taskIds = parsed.data.map((entry) => entry.taskId);
  if (taskIds.length > 0) {
    const validTasks = await prisma.costCodeTask.count({
      where: { siteId, active: true, id: { in: taskIds } },
    });
    if (validTasks !== taskIds.length) {
      return NextResponse.json(
        { error: "One or more tasks are invalid for this site" },
        { status: 400 }
      );
    }
  }

  const site = await prisma.site.update({
    where: { id: siteId },
    data: { taskBudgetWidget: parsed.data },
    select: { taskBudgetWidget: true },
  });

  return NextResponse.json({
    taskBudgets: mergeTaskBudgets(site.taskBudgetWidget),
  });
}
