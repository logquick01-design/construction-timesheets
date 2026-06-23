import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import {
  dashboardWidgetsSchema,
  hasEnabledWidget,
  mergeDashboardWidgets,
} from "@/lib/dashboard-widgets";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siteId } = await context.params;
  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const preference = await prisma.userSiteDashboardPreference.findUnique({
    where: { userId_siteId: { userId: session.id, siteId } },
    select: { widgets: true },
  });

  return NextResponse.json({
    widgets: mergeDashboardWidgets(preference?.widgets),
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

  const parsed = dashboardWidgetsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid widget settings" }, { status: 400 });
  }

  if (!hasEnabledWidget(parsed.data)) {
    return NextResponse.json(
      { error: "At least one widget must remain enabled" },
      { status: 400 }
    );
  }

  const preference = await prisma.userSiteDashboardPreference.upsert({
    where: { userId_siteId: { userId: session.id, siteId } },
    create: {
      userId: session.id,
      siteId,
      widgets: parsed.data,
    },
    update: {
      widgets: parsed.data,
    },
    select: { widgets: true },
  });

  return NextResponse.json({
    widgets: mergeDashboardWidgets(preference.widgets),
  });
}
