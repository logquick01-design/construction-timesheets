import { PrismaClient } from "@prisma/client";
import { PRISMA_SCHEMA_FINGERPRINT } from "./prisma-fingerprint";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const cached = globalForPrisma.prisma;
const stale =
  cached && globalForPrisma.prismaSchemaFingerprint !== PRISMA_SCHEMA_FINGERPRINT;

if (stale) {
  void cached.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaFingerprint = PRISMA_SCHEMA_FINGERPRINT;
}
