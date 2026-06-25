import type { Prisma } from "@prisma/client";

export function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function findOrCreatePersonByName(
  tx: Prisma.TransactionClient,
  name: string
): Promise<{ id: string; name: string }> {
  const trimmed = name.trim();
  const normalizedName = normalizePersonName(trimmed);
  const existing = await tx.person.findUnique({
    where: { normalizedName },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return tx.person.create({
    data: { name: trimmed, normalizedName },
    select: { id: true, name: true },
  });
}

export async function resolvePersonIdForWorker(
  tx: Prisma.TransactionClient,
  input: { personId?: string | null; name: string }
): Promise<string> {
  if (input.personId) {
    const person = await tx.person.findUnique({
      where: { id: input.personId },
      select: { id: true },
    });
    if (!person) throw new Error("Person not found");
    return person.id;
  }
  const person = await findOrCreatePersonByName(tx, input.name);
  return person.id;
}
