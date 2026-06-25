import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canManageSite } from "@/lib/permissions";
import { resolvePersonIdForWorker } from "@/lib/person";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const workerInclude = {
  company: true,
  person: { select: { id: true, name: true } },
} as const;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 400 });
  if (!canManageSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workers = await prisma.worker.findMany({
    where: { siteId },
    include: workerInclude,
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(workers);
}

const schema = z.object({
  id: z.string().optional(),
  siteId: z.string().min(1),
  name: z.string().min(1),
  trade: z.string().min(1),
  companyId: z.string().min(1),
  personId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid data";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { id, siteId, name, trade, companyId, personId, active } = parsed.data;
  if (!canManageSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.siteId !== siteId) {
    return NextResponse.json({ error: "Company not found for this site" }, { status: 400 });
  }

  try {
    if (id) {
      const existing = await prisma.worker.findUnique({ where: { id } });
      if (!existing || existing.siteId !== siteId) {
        return NextResponse.json({ error: "Worker not found" }, { status: 404 });
      }

      const worker = await prisma.$transaction(async (tx) => {
        const resolvedPersonId = await resolvePersonIdForWorker(tx, { personId, name });
        return tx.worker.update({
          where: { id },
          data: {
            name,
            trade,
            companyId,
            personId: resolvedPersonId,
            active: active ?? true,
          },
          include: workerInclude,
        });
      });
      return NextResponse.json(worker);
    }

    const worker = await prisma.$transaction(async (tx) => {
      const resolvedPersonId = await resolvePersonIdForWorker(tx, { personId, name });
      return tx.worker.create({
        data: {
          name,
          trade,
          siteId,
          companyId,
          personId: resolvedPersonId,
          active: active ?? true,
        },
        include: workerInclude,
      });
    });
    return NextResponse.json(worker);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save worker";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
