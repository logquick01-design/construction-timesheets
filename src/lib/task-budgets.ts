import { z } from "zod";

export type TaskBudgetEntry = {
  taskId: string;
  budgetHours: number;
};

export const taskBudgetEntrySchema = z.object({
  taskId: z.string().min(1),
  budgetHours: z.number().positive(),
});

export const taskBudgetsSchema = z.array(taskBudgetEntrySchema);

export function mergeTaskBudgets(stored: unknown): TaskBudgetEntry[] {
  if (!Array.isArray(stored)) return [];

  const entries: TaskBudgetEntry[] = [];
  const seen = new Set<string>();

  for (const item of stored) {
    const parsed = taskBudgetEntrySchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.taskId)) continue;
    seen.add(parsed.data.taskId);
    entries.push(parsed.data);
  }

  return entries;
}
