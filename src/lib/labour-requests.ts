import type { Prisma } from "@prisma/client";
import { formatDate } from "./utils";
import type { LabourRequestStatus } from "./labour-types";

export const labourRequestInclude = {
  site: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  days: { orderBy: { date: "asc" as const } },
  workers: {
    include: {
      worker: {
        include: { company: { select: { id: true, name: true } } },
      },
    },
  },
} satisfies Prisma.LabourRequestInclude;

export type LabourRequestRecord = Prisma.LabourRequestGetPayload<{
  include: typeof labourRequestInclude;
}>;

export function serializeLabourRequest(r: LabourRequestRecord) {
  return {
    id: r.id,
    siteId: r.siteId,
    siteName: r.site.name,
    status: r.status as LabourRequestStatus,
    notes: r.notes,
    requestedBy: r.requestedBy,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    denialReason: r.denialReason,
    createdAt: r.createdAt.toISOString(),
    dates: r.days.map((d) => formatDate(d.date)),
    workers: r.workers.map((w) => ({
      id: w.id,
      workerId: w.workerId,
      name: w.worker.name,
      trade: w.worker.trade,
      hoursPerDay: w.hoursPerDay,
      companyId: w.worker.company?.id ?? null,
      companyName: w.worker.company?.name ?? null,
    })),
  };
}

export type SerializedLabourRequest = ReturnType<typeof serializeLabourRequest>;
