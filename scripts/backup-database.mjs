#!/usr/bin/env node
/**
 * Create a consistent SQLite backup using VACUUM INTO (safe while the app is running).
 * Intended for Railway cron or manual runs against the /data volume.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const DEFAULT_MOUNT = "/data";
const DEFAULT_DB = "prod.db";
const DEFAULT_BACKUP_DIR = "backups";
const DEFAULT_KEEP = 14;

function resolveDatabasePath() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    return url.slice("file:".length);
  }

  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? DEFAULT_MOUNT;
  return path.join(mount, DEFAULT_DB);
}

function resolveBackupDir(dbPath) {
  const configured = process.env.BACKUP_DIR;
  if (configured) return configured;
  return path.join(path.dirname(dbPath), DEFAULT_BACKUP_DIR);
}

function listBackups(backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  return fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(".db"))
    .map((name) => ({
      name,
      fullPath: path.join(backupDir, name),
      mtimeMs: fs.statSync(path.join(backupDir, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function rotateBackups(backupDir, keep) {
  const backups = listBackups(backupDir);
  for (const old of backups.slice(keep)) {
    fs.unlinkSync(old.fullPath);
    console.log(`Removed old backup: ${old.name}`);
  }
}

async function main() {
  const dbPath = resolveDatabasePath();
  const backupDir = resolveBackupDir(dbPath);
  const keep = Number(process.env.BACKUP_KEEP ?? DEFAULT_KEEP);

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `prod-${stamp}.db`);

  process.env.DATABASE_URL = `file:${dbPath}`;
  const prisma = new PrismaClient();

  try {
    // VACUUM INTO creates a consistent online backup for SQLite.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    const sizeKb = Math.round(fs.statSync(backupPath).size / 1024);
    console.log(`Backup created: ${backupPath} (${sizeKb} KB)`);
  } finally {
    await prisma.$disconnect();
  }

  rotateBackups(backupDir, keep);
  console.log(`Keeping the latest ${keep} backups in ${backupDir}`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
