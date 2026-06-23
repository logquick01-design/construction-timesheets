import { z } from "zod";

export type DashboardWidgets = {
  totalHours: boolean;
  siteHours: boolean;
  categoryChart: boolean;
  workersList: boolean;
  tasksList: boolean;
  taskBudgetChart: boolean;
};

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgets = {
  totalHours: true,
  siteHours: true,
  categoryChart: true,
  workersList: true,
  tasksList: true,
  taskBudgetChart: false,
};

export const DASHBOARD_WIDGET_LABELS: Record<
  keyof DashboardWidgets,
  { label: string; description: string }
> = {
  totalHours: {
    label: "Total hours",
    description: "Summary card showing total filtered hours.",
  },
  siteHours: {
    label: "Site hours",
    description: "Per-site hour cards for the selected period.",
  },
  categoryChart: {
    label: "Hours by category",
    description: "Stacked bar chart of hours broken down by cost-code category.",
  },
  workersList: {
    label: "Hours per worker",
    description: "Ranked list of workers and their logged hours.",
  },
  tasksList: {
    label: "Hours per task",
    description: "Ranked list of tasks and their logged hours.",
  },
  taskBudgetChart: {
    label: "Task budget usage",
    description:
      "Pie charts comparing logged hours against site budget totals. Enable for yourself — task budgets are shared pre-configuration for the site.",
  },
};

export const dashboardWidgetsSchema = z.object({
  totalHours: z.boolean(),
  siteHours: z.boolean(),
  categoryChart: z.boolean(),
  workersList: z.boolean(),
  tasksList: z.boolean(),
  taskBudgetChart: z.boolean(),
});

export function mergeDashboardWidgets(stored: unknown): DashboardWidgets {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_DASHBOARD_WIDGETS };

  const parsed = dashboardWidgetsSchema.safeParse({
    ...DEFAULT_DASHBOARD_WIDGETS,
    ...stored,
  });

  return parsed.success ? parsed.data : { ...DEFAULT_DASHBOARD_WIDGETS };
}

export function hasEnabledWidget(widgets: DashboardWidgets): boolean {
  return Object.values(widgets).some(Boolean);
}
