"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button, Card, Input, Label, Select } from "./ui";
import type { TaskBudgetEntry } from "@/lib/task-budgets";

export type SiteTask = {
  id: string;
  name: string;
  reference: string;
  category: { name: string };
};

const PIE_COLORS = {
  used: "#c4783b",
  remaining: "#e5e5e5",
  over: "#dc2626",
};

function getPieSlices(used: number, budget: number) {
  if (budget <= 0) return [];

  if (used >= budget) {
    return [
      { name: "Budget used", value: budget, color: PIE_COLORS.used },
      { name: "Over budget", value: used - budget, color: PIE_COLORS.over },
    ];
  }

  return [
    { name: "Used", value: used, color: PIE_COLORS.used },
    { name: "Remaining", value: budget - used, color: PIE_COLORS.remaining },
  ];
}

export function TaskBudgetCharts({
  taskBudgets,
  siteTasks,
  hoursByTaskId,
}: {
  taskBudgets: TaskBudgetEntry[];
  siteTasks: SiteTask[];
  hoursByTaskId: Record<string, number>;
}) {
  const taskMap = new Map(siteTasks.map((task) => [task.id, task]));

  if (taskBudgets.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 font-semibold text-ink">Task budget usage</h2>
        <p className="text-sm text-muted">
          Open widget settings and configure site task budgets. Turn on the widget to see charts
          on your dashboard.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-ink">Task budget usage</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {taskBudgets.map((entry) => {
          const task = taskMap.get(entry.taskId);
          if (!task) return null;

          const used = hoursByTaskId[entry.taskId] ?? 0;
          const budget = entry.budgetHours;
          const pct = budget > 0 ? (used / budget) * 100 : 0;
          const slices = getPieSlices(used, budget);

          return (
            <Card key={entry.taskId}>
              <div className="mb-1 text-sm font-medium text-ink">{task.name}</div>
              <div className="mb-3 text-xs text-muted">
                {task.reference} · {task.category.name}
              </div>
              <div className="relative h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={slices.length > 1 ? 2 : 0}
                    >
                      {slices.map((slice) => (
                        <Cell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value.toFixed(1)} hrs`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-ink">{pct.toFixed(0)}%</span>
                  <span className="text-xs text-muted">of budget</span>
                </div>
              </div>
              <p className="mt-2 text-center text-sm text-muted">
                {used.toFixed(1)} / {budget.toFixed(1)} hrs
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function TaskBudgetSettingsPanel({
  taskBudgets,
  siteTasks,
  onSave,
  onBack,
}: {
  taskBudgets: TaskBudgetEntry[];
  siteTasks: SiteTask[];
  onSave: (next: TaskBudgetEntry[]) => Promise<boolean>;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(taskBudgets);
  const [newTaskId, setNewTaskId] = useState("");
  const [newBudgetHours, setNewBudgetHours] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(taskBudgets);
  }, [taskBudgets]);

  const configuredIds = new Set(draft.map((entry) => entry.taskId));
  const availableTasks = siteTasks.filter((task) => !configuredIds.has(task.id));
  const taskMap = new Map(siteTasks.map((task) => [task.id, task]));

  async function persist(next: TaskBudgetEntry[]) {
    setSaving(true);
    const saved = await onSave(next);
    if (saved) setDraft(next);
    setSaving(false);
    return saved;
  }

  async function updateBudget(taskId: string, budgetHours: number) {
    const next = draft.map((entry) =>
      entry.taskId === taskId ? { ...entry, budgetHours } : entry
    );
    await persist(next);
  }

  async function removeTask(taskId: string) {
    await persist(draft.filter((entry) => entry.taskId !== taskId));
  }

  async function addTask() {
    const budgetHours = Number(newBudgetHours);
    if (!newTaskId || !Number.isFinite(budgetHours) || budgetHours <= 0) return;

    const next = [...draft, { taskId: newTaskId, budgetHours }];
    const saved = await persist(next);
    if (saved) {
      setNewTaskId("");
      setNewBudgetHours("");
    }
  }

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Widget settings
      </Button>

      <Card>
        <h2 className="font-semibold text-ink">Task budget usage</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Set budget hour totals for individual tasks on this site. These pre-configured budgets
          are shared with everyone on the project — each person chooses whether to show the widget
          on their own dashboard.
        </p>

        {draft.length > 0 && (
          <ul className="mb-6 divide-y divide-border-light">
            {draft.map((entry) => {
              const task = taskMap.get(entry.taskId);
              if (!task) return null;

              return (
                <li key={entry.taskId} className="flex flex-wrap items-end gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{task.name}</p>
                    <p className="text-xs text-muted">
                      {task.reference} · {task.category.name}
                    </p>
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`budget-${entry.taskId}`}>Budget hrs</Label>
                    <Input
                      id={`budget-${entry.taskId}`}
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={entry.budgetHours}
                      disabled={saving}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setDraft((current) =>
                          current.map((item) =>
                            item.taskId === entry.taskId ? { ...item, budgetHours: value } : item
                          )
                        );
                      }}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value) && value > 0) {
                          void updateBudget(entry.taskId, value);
                        } else {
                          setDraft(taskBudgets);
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${task.name}`}
                    disabled={saving}
                    onClick={() => void removeTask(entry.taskId)}
                    className="mb-0.5 p-2 text-muted hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {availableTasks.length > 0 ? (
          <div className="border-t border-border-light pt-4">
            <h3 className="mb-3 text-sm font-medium text-ink">Add a task</h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
              <div>
                <Label>Task</Label>
                <Select
                  value={newTaskId}
                  disabled={saving}
                  onChange={(e) => setNewTaskId(e.target.value)}
                >
                  <option value="">Select task…</option>
                  {availableTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name} ({task.reference})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Budget hrs</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.5"
                  placeholder="e.g. 100"
                  value={newBudgetHours}
                  disabled={saving}
                  onChange={(e) => setNewBudgetHours(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={saving || !newTaskId || !(Number(newBudgetHours) > 0)}
                onClick={() => void addTask()}
              >
                Add
              </Button>
            </div>
          </div>
        ) : (
          draft.length === 0 && (
            <p className="text-sm text-muted">No tasks available on this site yet.</p>
          )
        )}
      </Card>
    </div>
  );
}