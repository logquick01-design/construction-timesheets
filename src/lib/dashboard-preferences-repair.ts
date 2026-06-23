import type { PrismaClient } from "@prisma/client";
import { mergeTaskBudgets } from "@/lib/task-budgets";

export async function repairCorruptSiteTaskBudgets(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    UPDATE Site
    SET taskBudgetWidget = '[]'
    WHERE taskBudgetWidget IS NULL
       OR trim(CAST(taskBudgetWidget AS TEXT)) = ''
       OR json_valid(CAST(taskBudgetWidget AS TEXT)) = 0
  `);
}

export async function migrateUserTaskBudgetsToSite(prisma: PrismaClient) {
  const prefColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info(UserSiteDashboardPreference)`
  );
  const hasUserBudgets = prefColumns.some((column) => column.name === "taskBudgets");
  if (!hasUserBudgets) return;

  const sites = await prisma.site.findMany({ select: { id: true, taskBudgetWidget: true } });

  for (const site of sites) {
    if (mergeTaskBudgets(site.taskBudgetWidget).length > 0) continue;

    const rows = await prisma.$queryRawUnsafe<Array<{ taskBudgets: string | null }>>(
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

    await prisma.site.update({
      where: { id: site.id },
      data: { taskBudgetWidget: budgets },
    });
  }
}
