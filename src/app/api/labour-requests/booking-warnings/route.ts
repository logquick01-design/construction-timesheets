import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { findWorkerBookingWarning } from "@/lib/labour-conflicts";
import { uniqueDateStrings } from "@/lib/labour-dates";
import { canCreateLabourRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  siteId: z.string().min(1),
  workerIds: z.array(z.string().min(1)).min(1),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  excludeRequestId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canCreateLabourRequest(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { siteId, workerIds, excludeRequestId } = parsed.data;
    const dates = uniqueDateStrings(parsed.data.dates);

    if (!canAccessSite(session, siteId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const warning = await findWorkerBookingWarning(prisma, {
      siteId,
      workerIds,
      dates,
      excludeRequestId,
    });

    return NextResponse.json({ warning });
  } catch (error) {
    console.error("POST /api/labour-requests/booking-warnings failed:", error);
    return NextResponse.json({ error: "Failed to check booking warnings" }, { status: 500 });
  }
}
