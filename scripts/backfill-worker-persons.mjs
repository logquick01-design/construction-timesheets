import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizePersonName(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

async function findOrCreatePersonByName(name) {
  const trimmed = name.trim();
  const normalizedName = normalizePersonName(trimmed);
  const existing = await prisma.person.findUnique({ where: { normalizedName } });
  if (existing) return existing;
  return prisma.person.create({ data: { name: trimmed, normalizedName } });
}

async function main() {
  const workers = await prisma.worker.findMany({
    where: { personId: null },
    orderBy: { createdAt: "asc" },
  });

  let linked = 0;
  for (const worker of workers) {
    const person = await findOrCreatePersonByName(worker.name);
    await prisma.worker.update({
      where: { id: worker.id },
      data: { personId: person.id },
    });
    linked += 1;
  }

  console.log(`Linked ${linked} worker(s) to Person records.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
