/**
 * Background backup scheduler for Railway production.
 * Runs only when a persistent volume is mounted.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_SCRIPT = path.join(__dirname, "backup-database.mjs");
const DEFAULT_INTERVAL_HOURS = 6;

function runBackup(label) {
  console.log(`[backup-scheduler] ${label}`);
  const child = spawn(process.execPath, [BACKUP_SCRIPT], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    if (code === 0) {
      console.log("[backup-scheduler] Backup finished successfully.");
    } else {
      console.error(`[backup-scheduler] Backup exited with code ${code ?? "unknown"}.`);
    }
  });
}

const intervalHours = Number(process.env.BACKUP_INTERVAL_HOURS ?? DEFAULT_INTERVAL_HOURS);
const intervalMs = intervalHours * 60 * 60 * 1000;

console.log(
  `[backup-scheduler] Started — backing up every ${intervalHours} hour(s) to /data/backups/`
);

setInterval(() => runBackup("Scheduled backup starting..."), intervalMs);

// Keep process alive.
process.stdin.resume();
