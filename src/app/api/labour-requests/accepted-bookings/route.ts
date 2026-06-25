import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { labourRequestInclude, serializeLabourRequest } from "@/lib/labour-requests";
import { canCreateLabourRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { endOfDay, parseDateInput, startOfDay } from "@/lib/utils";
import { isSiteFeatureEnabled, loadSiteFeaturesMap, mergeSiteFeatures } from "@/lib/site-features";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canCreateLabourRequest(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    if (!fromStr || !toStr) {
      return NextResponse.json({ error: "from and to required" }, { status: 400 });
    }

    const from = startOfDay(parseDateInput(fromStr));
    const to = endOfDay(parseDateInput(toStr));

    const requests = await prisma.labourRequest.findMany({
      where: {
        status: "ACCEPTED",
        days: {
          some: {
            date: { gte: from, lte: to },
          },
        },
      },
      include: labourRequestInclude,
      orderBy: { createdAt: "desc" },
    });

    const siteIds = [...new Set(requests.map((r) => r.siteId))];
    const featuresBySite = await loadSiteFeaturesMap(siteIds);
    const filtered = requests.filter((r) =>
      isSiteFeatureEnabled(
        featuresBySite.get(r.siteId) ?? mergeSiteFeatures(null),
        "bookingCalendar"
      )
    );

    return NextResponse.json({
      requests: filtered.map(serializeLabourRequest),
    });
  } catch (error) {
    console.error("GET /api/labour-requests/accepted-bookings failed:", error);
    return NextResponse.json({ error: "Failed to load accepted bookings" }, { status: 500 });
  }
}
