import { z } from "zod";

export type DashboardWidgets = {
  totalHours: boolean;
  siteHours: boolean;
  categoryChart: boolean;
  workersList: boolean;
  tasksList: boolean;
  labourNotifications: boolean;
};

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgets = {
  totalHours: true,
  siteHours: true,
  categoryChart: true,
  workersList: true,
  tasksList: true,
  labourNotifications: true,
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
  labourNotifications: {
    label: "Labour notifications",
    description: "Alerts when labour look-ahead requests are denied.",
  },
};

export const dashboardWidgetsSchema = z.object({
  totalHours: z.boolean(),
  siteHours: z.boolean(),
  categoryChart: z.boolean(),
  workersList: z.boolean(),
  tasksList: z.boolean(),
  labourNotifications: z.boolean(),
});

export function mergeDashboardWidgets(stored: unknown): DashboardWidgets {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_DASHBOARD_WIDGETS };

  const rest = { ...(stored as Record<string, unknown>) };
  delete rest.taskBudgetChart;

  const parsed = dashboardWidgetsSchema.safeParse({
    ...DEFAULT_DASHBOARD_WIDGETS,
    ...rest,
  });

  return parsed.success ? parsed.data : { ...DEFAULT_DASHBOARD_WIDGETS };
}

export function hasEnabledWidget(widgets: DashboardWidgets): boolean {
  return Object.values(widgets).some(Boolean);
}
