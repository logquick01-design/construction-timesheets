import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function mergeTaskBudgets(stored) {
  if (!stored) return [];
  let parsed = stored;
  if (typeof stored === "string") {
    try {
      parsed = JSON.parse(stored);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const entries = [];
  const seen = new Set();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const taskId = item.taskId;
    const budgetHours = Number(item.budgetHours);
    if (!taskId || !Number.isFinite(budgetHours) || budgetHours <= 0 || seen.has(taskId)) continue;
    seen.add(taskId);
    entries.push({ taskId, budgetHours });
  }
  return entries;
}

async function ensureSiteTaskBudgetColumn() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(Site)`);
  const hasColumn = columns.some((column) => column.name === "taskBudgetWidget");
  if (!hasColumn) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE Site ADD COLUMN taskBudgetWidget JSONB NOT NULL DEFAULT '[]'`
    );
  }
}

async function repairCorruptSiteTaskBudgets() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(Site)`);
  const hasColumn = columns.some((column) => column.name === "taskBudgetWidget");
  if (!hasColumn) return;

  await prisma.$executeRawUnsafe(`
    UPDATE Site
    SET taskBudgetWidget = '[]'
    WHERE taskBudgetWidget IS NULL
       OR length(CAST(taskBudgetWidget AS TEXT)) = 0
  `);
}

async function migrateUserTaskBudgetsToSite() {
  const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(Site)`);
  const hasColumn = columns.some((column) => column.name === "taskBudgetWidget");
  if (!hasColumn) return;

  const prefColumns = await prisma.$queryRawUnsafe(`PRAGMA table_info(UserSiteDashboardPreference)`);
  const hasUserBudgets = prefColumns.some((column) => column.name === "taskBudgets");
  if (!hasUserBudgets) return;

  const sites = await prisma.$queryRawUnsafe(`SELECT id, taskBudgetWidget FROM Site`);

  for (const site of sites) {
    if (mergeTaskBudgets(site.taskBudgetWidget).length > 0) continue;

    const rows = await prisma.$queryRawUnsafe(
      `SELECT taskBudgets FROM UserSiteDashboardPreference
       WHERE siteId = ?
         AND taskBudgets IS NOT NULL
         AND length(CAST(taskBudgets AS TEXT)) > 0
       ORDER BY updatedAt DESC
       LIMIT 1`,
      site.id
    );

    const budgets = mergeTaskBudgets(rows[0]?.taskBudgets);
    if (budgets.length === 0) continue;

    await prisma.$executeRawUnsafe(
      `UPDATE Site SET taskBudgetWidget = ? WHERE id = ?`,
      JSON.stringify(budgets),
      site.id
    );
  }
}

async function main() {
  await ensureSiteTaskBudgetColumn();
  await migrateUserTaskBudgetsToSite();
  await repairCorruptSiteTaskBudgets();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
