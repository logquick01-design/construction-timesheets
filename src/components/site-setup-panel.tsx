"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button, Card, Input, Label } from "./ui";

type Tab = "companies" | "categories";

export function SiteSetupPanel({ siteId }: { siteId: string }) {
  const [tab, setTab] = useState<Tab>("companies");

  const tabs: { id: Tab; label: string }[] = [
    { id: "companies", label: "Companies / workers" },
    { id: "categories", label: "Preset Cost codes" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "bg-black text-white"
                : "bg-surface text-ink ring-1 ring-border hover:bg-fill"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "companies" && <CompaniesAdmin siteId={siteId} />}
      {tab === "categories" && <CategoriesAdmin siteId={siteId} />}
    </div>
  );
}

type Company = { id: string; name: string; active: boolean };

type WorkerItem = {
  id: string;
  name: string;
  trade: string;
  active: boolean;
  personId: string | null;
  companyId: string | null;
  company: { id: string; name: string } | null;
  person: { id: string; name: string } | null;
};

type PersonOption = { id: string; name: string };

type WorkerSuggestion = {
  name: string;
  trade: string;
  personId: string | null;
  personName: string;
  siteName: string;
  companyName: string;
};

function CompaniesAdmin({ siteId }: { siteId: string }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [workerSuggestions, setWorkerSuggestions] = useState<Record<string, WorkerSuggestion[]>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState<Record<string, boolean>>({});
  const [companyForm, setCompanyForm] = useState({ id: "", name: "", active: true });
  const [companyError, setCompanyError] = useState("");
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [workerForms, setWorkerForms] = useState<
    Record<
      string,
      { id: string; name: string; trade: string; active: boolean; personId: string | null }
    >
  >({});
  const [workerErrors, setWorkerErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/admin/companies?siteId=${siteId}`).then((r) => r.json()),
      fetch(`/api/admin/workers?siteId=${siteId}`).then((r) => r.json()),
      fetch("/api/admin/persons").then((r) => r.json()),
    ]).then(([c, w, p]) => {
      setCompanies(c);
      setWorkers(w);
      setPersons(Array.isArray(p) ? p : []);
    });
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  const workersByCompany = useMemo(() => {
    const map = new Map<string, WorkerItem[]>();
    for (const w of workers) {
      const key = w.companyId ?? w.company?.id ?? "unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    return map;
  }, [workers]);

  function toggleCompany(companyId: string) {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else {
        next.add(companyId);
        void loadWorkerSuggestions(companyId);
      }
      return next;
    });
  }

  const loadWorkerSuggestions = useCallback(
    async (companyId: string) => {
      setSuggestionsLoading((prev) => ({ ...prev, [companyId]: true }));
      try {
        const res = await fetch(
          `/api/admin/workers/suggestions?siteId=${siteId}&companyId=${companyId}`
        );
        const data = await res.json().catch(() => []);
        setWorkerSuggestions((prev) => ({
          ...prev,
          [companyId]: res.ok && Array.isArray(data) ? data : [],
        }));
      } finally {
        setSuggestionsLoading((prev) => ({ ...prev, [companyId]: false }));
      }
    },
    [siteId]
  );

  function applyWorkerSuggestion(
    companyId: string,
    suggestion: WorkerSuggestion,
    currentForm: { id: string; name: string; trade: string; active: boolean; personId: string | null }
  ) {
    setWorkerForm(companyId, {
      ...currentForm,
      id: "",
      name: suggestion.name,
      trade: suggestion.trade,
      personId: suggestion.personId,
    });
  }

  function applyPersonSelection(
    companyId: string,
    personId: string | null,
    currentForm: { id: string; name: string; trade: string; active: boolean; personId: string | null }
  ) {
    const next = { ...currentForm, personId };
    if (!personId) {
      setWorkerForm(companyId, next);
      return;
    }

    const person = persons.find((p) => p.id === personId);
    if (person) next.name = person.name;

    const match = workerSuggestions[companyId]?.find((s) => s.personId === personId);
    if (match) next.trade = match.trade;
    else if (!next.trade.trim()) {
      const byName = workerSuggestions[companyId]?.find(
        (s) => s.name.toLowerCase() === (person?.name ?? "").toLowerCase()
      );
      if (byName) next.trade = byName.trade;
    }

    setWorkerForm(companyId, next);
  }

  function applyNameAutofill(
    companyId: string,
    name: string,
    currentForm: { id: string; name: string; trade: string; active: boolean; personId: string | null }
  ) {
    const next = { ...currentForm, name };
    if (currentForm.personId) {
      setWorkerForm(companyId, next);
      return;
    }

    const match = workerSuggestions[companyId]?.find(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (match) {
      next.trade = match.trade;
      next.personId = match.personId;
    }

    setWorkerForm(companyId, next);
  }

  function getWorkerForm(companyId: string) {
    return (
      workerForms[companyId] ?? {
        id: "",
        name: "",
        trade: "",
        active: true,
        personId: null,
      }
    );
  }

  function setWorkerForm(
    companyId: string,
    form: { id: string; name: string; trade: string; active: boolean; personId: string | null }
  ) {
    setWorkerForms((prev) => ({ ...prev, [companyId]: form }));
  }

  function resetWorkerForm(companyId: string) {
    setWorkerForms((prev) => {
      const next = { ...prev };
      delete next[companyId];
      return next;
    });
    setWorkerErrors((prev) => {
      const next = { ...prev };
      delete next[companyId];
      return next;
    });
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setCompanyError("");
    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...companyForm, siteId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setCompanyError(data.error ?? "Failed to save company.");
      return;
    }
    setCompanyForm({ id: "", name: "", active: true });
    load();
  }

  async function saveWorker(e: React.FormEvent, companyId: string) {
    e.preventDefault();
    const form = getWorkerForm(companyId);
    setWorkerErrors((prev) => ({ ...prev, [companyId]: "" }));
    const res = await fetch("/api/admin/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, companyId, siteId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setWorkerErrors((prev) => ({ ...prev, [companyId]: data.error ?? "Failed to save worker." }));
      return;
    }
    resetWorkerForm(companyId);
    void loadWorkerSuggestions(companyId);
    load();
  }

  return (
    <AdminCrud
      title="Subcontractor companies"
      description="Add companies, then expand each one to manage its workers."
      form={
        <form onSubmit={saveCompany} className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Company name"
            value={companyForm.name}
            onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={companyForm.active}
              onChange={(e) => setCompanyForm({ ...companyForm, active: e.target.checked })}
            />
            Active
          </label>
          <Button type="submit">{companyForm.id ? "Update" : "Add company"}</Button>
          {companyForm.id && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCompanyForm({ id: "", name: "", active: true })}
            >
              Cancel
            </Button>
          )}
          {companyError && <p className="w-full text-sm text-red-600">{companyError}</p>}
        </form>
      }
      list={
        companies.length === 0 ? (
          <li className="py-2 text-sm text-muted">No companies yet.</li>
        ) : (
          companies.map((c) => {
            const expanded = expandedCompanies.has(c.id);
            const companyWorkers = workersByCompany.get(c.id) ?? [];
            const workerForm = getWorkerForm(c.id);
            const suggestions = workerSuggestions[c.id] ?? [];
            const loadingSuggestions = suggestionsLoading[c.id] ?? false;

            return (
              <li key={c.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCompany(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={expanded}
                  >
                    {expanded ? (
                      <ChevronDown size={18} className="shrink-0 text-muted" aria-hidden />
                    ) : (
                      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                    )}
                    <span className="font-medium text-ink">
                      {c.name}
                      {!c.active && <span className="text-red-500"> (archived)</span>}
                    </span>
                    <span className="text-sm text-muted">
                      ({companyWorkers.length} worker{companyWorkers.length === 1 ? "" : "s"})
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCompanyForm({ id: c.id, name: c.name, active: c.active })}
                  >
                    Edit
                  </Button>
                </div>

                {expanded && (
                  <div className="mt-3 ml-6 space-y-4 rounded-lg border border-border-light bg-fill p-4">
                    {companyWorkers.length === 0 ? (
                      <p className="text-sm text-muted">No workers yet.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {companyWorkers.map((w) => (
                          <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span>
                              {w.name} <span className="text-muted">({w.trade})</span>
                              {w.person && (
                                <span className="text-muted"> · linked as {w.person.name}</span>
                              )}
                              {!w.active && <span className="text-red-500"> (archived)</span>}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setWorkerForm(c.id, {
                                  id: w.id,
                                  name: w.name,
                                  trade: w.trade,
                                  active: w.active,
                                  personId: w.personId,
                                })
                              }
                            >
                              Edit
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form onSubmit={(e) => saveWorker(e, c.id)} className="space-y-3 border-t border-border pt-4">
                      <p className="text-sm font-medium text-ink">
                        {workerForm.id ? "Edit worker" : "Add worker"}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Input
                            placeholder="Name"
                            list={workerForm.id ? undefined : `worker-name-suggestions-${c.id}`}
                            value={workerForm.name}
                            onChange={(e) =>
                              setWorkerForm(c.id, { ...workerForm, name: e.target.value })
                            }
                            onBlur={(e) => {
                              if (!workerForm.id && !workerForm.personId) {
                                applyNameAutofill(c.id, e.target.value, workerForm);
                              }
                            }}
                            required
                          />
                          {!workerForm.id && suggestions.length > 0 && (
                            <datalist id={`worker-name-suggestions-${c.id}`}>
                              {suggestions.map((s) => (
                                <option
                                  key={`${s.personId ?? s.name}-${s.siteName}`}
                                  value={s.name}
                                />
                              ))}
                            </datalist>
                          )}
                        </div>
                        <Input
                          placeholder="Trade / role"
                          value={workerForm.trade}
                          onChange={(e) => setWorkerForm(c.id, { ...workerForm, trade: e.target.value })}
                          required
                        />
                      </div>
                      {!workerForm.id && (
                        <div className="rounded-lg border border-border-light bg-surface p-3">
                          <p className="text-xs font-medium text-ink">
                            Suggested from other sites ({c.name})
                          </p>
                          {loadingSuggestions ? (
                            <p className="mt-2 text-xs text-muted">Loading suggestions…</p>
                          ) : suggestions.length === 0 ? (
                            <p className="mt-2 text-xs text-muted">
                              No matching workers at this company name on other sites yet.
                            </p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {suggestions.map((s) => (
                                <button
                                  key={`${s.personId ?? s.name}-${s.siteName}-${s.trade}`}
                                  type="button"
                                  className="rounded-lg border border-border bg-fill px-3 py-1.5 text-left text-xs hover:bg-surface"
                                  onClick={() => applyWorkerSuggestion(c.id, s, workerForm)}
                                >
                                  <span className="font-medium text-ink">{s.name}</span>
                                  <span className="text-muted"> · {s.trade}</span>
                                  <span className="block text-muted">{s.siteName}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <Label htmlFor={`person-${c.id}`}>Link to person (cross-site)</Label>
                        <select
                          id={`person-${c.id}`}
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                          value={workerForm.personId ?? ""}
                          onChange={(e) =>
                            applyPersonSelection(c.id, e.target.value || null, workerForm)
                          }
                        >
                          <option value="">Auto from name</option>
                          {persons.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-muted">
                          Auto from name links by name and fills trade from the same company on other sites.
                          Pick a person to reuse their role from another project.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={workerForm.active}
                            onChange={(e) => setWorkerForm(c.id, { ...workerForm, active: e.target.checked })}
                          />
                          Active
                        </label>
                        <Button type="submit">{workerForm.id ? "Update worker" : "Add worker"}</Button>
                        {workerForm.id && (
                          <Button type="button" variant="ghost" onClick={() => resetWorkerForm(c.id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                      {workerErrors[c.id] && <p className="text-sm text-red-600">{workerErrors[c.id]}</p>}
                    </form>
                  </div>
                )}
              </li>
            );
          })
        )
      }
    />
  );
}

type Category = { id: string; name: string; active: boolean };

type TaskItem = {
  id: string;
  name: string;
  reference: string;
  active: boolean;
  categoryId: string;
  category: { name: string };
};

function CategoriesAdmin({ siteId }: { siteId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [categoryForm, setCategoryForm] = useState({ id: "", name: "", active: true });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [taskForms, setTaskForms] = useState<
    Record<string, { id: string; name: string; reference: string; active: boolean }>
  >({});
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/admin/categories?siteId=${siteId}`).then((r) => r.json()),
      fetch(`/api/admin/tasks?siteId=${siteId}`).then((r) => r.json()),
    ]).then(([c, t]) => {
      setCategories(c);
      setTasks(t);
    });
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  const tasksByCategory = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      if (!map.has(t.categoryId)) map.set(t.categoryId, []);
      map.get(t.categoryId)!.push(t);
    }
    return map;
  }, [tasks]);

  function toggleCategory(categoryId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function getTaskForm(categoryId: string) {
    return taskForms[categoryId] ?? { id: "", name: "", reference: "", active: true };
  }

  function setTaskForm(
    categoryId: string,
    form: { id: string; name: string; reference: string; active: boolean }
  ) {
    setTaskForms((prev) => ({ ...prev, [categoryId]: form }));
  }

  function resetTaskForm(categoryId: string) {
    setTaskForms((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    setTaskErrors((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...categoryForm, siteId }),
    });
    setCategoryForm({ id: "", name: "", active: true });
    load();
  }

  async function saveTask(e: React.FormEvent, categoryId: string) {
    e.preventDefault();
    const form = getTaskForm(categoryId);
    setTaskErrors((prev) => ({ ...prev, [categoryId]: "" }));
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, categoryId, siteId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTaskErrors((prev) => ({ ...prev, [categoryId]: data.error ?? "Failed to save task." }));
      return;
    }
    resetTaskForm(categoryId);
    load();
  }

  return (
    <AdminCrud
      title="Cost code categories"
      description="Add categories, then expand each one to manage its tasks."
      form={
        <form onSubmit={saveCategory} className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Category name"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            required
          />
          <Button type="submit">{categoryForm.id ? "Update" : "Add category"}</Button>
          {categoryForm.id && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCategoryForm({ id: "", name: "", active: true })}
            >
              Cancel
            </Button>
          )}
        </form>
      }
      list={
        categories.length === 0 ? (
          <li className="py-2 text-sm text-muted">No categories yet.</li>
        ) : (
          categories.map((c) => {
            const expanded = expandedCategories.has(c.id);
            const categoryTasks = tasksByCategory.get(c.id) ?? [];
            const taskForm = getTaskForm(c.id);

            return (
              <li key={c.id} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={expanded}
                  >
                    {expanded ? (
                      <ChevronDown size={18} className="shrink-0 text-muted" aria-hidden />
                    ) : (
                      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                    )}
                    <span className="font-medium text-ink">
                      {c.name}
                      {!c.active && <span className="text-red-500"> (archived)</span>}
                    </span>
                    <span className="text-sm text-muted">
                      ({categoryTasks.length} task{categoryTasks.length === 1 ? "" : "s"})
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCategoryForm({ id: c.id, name: c.name, active: c.active })}
                  >
                    Edit
                  </Button>
                </div>

                {expanded && (
                  <div className="mt-3 ml-6 space-y-4 rounded-lg border border-border-light bg-fill p-4">
                    {categoryTasks.length === 0 ? (
                      <p className="text-sm text-muted">No tasks yet.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {categoryTasks.map((t) => (
                          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                            <span>
                              {t.name} ({t.reference})
                              {!t.active && <span className="text-red-500"> (archived)</span>}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setTaskForm(c.id, {
                                  id: t.id,
                                  name: t.name,
                                  reference: t.reference,
                                  active: t.active,
                                })
                              }
                            >
                              Edit
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form onSubmit={(e) => saveTask(e, c.id)} className="space-y-3 border-t border-border pt-4">
                      <p className="text-sm font-medium text-ink">
                        {taskForm.id ? "Edit task" : "Add task"}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          placeholder="Task name"
                          value={taskForm.name}
                          onChange={(e) => setTaskForm(c.id, { ...taskForm, name: e.target.value })}
                          required
                        />
                        <Input
                          placeholder="Ref #"
                          value={taskForm.reference}
                          onChange={(e) => setTaskForm(c.id, { ...taskForm, reference: e.target.value })}
                          required
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={taskForm.active}
                            onChange={(e) => setTaskForm(c.id, { ...taskForm, active: e.target.checked })}
                          />
                          Active
                        </label>
                        <Button type="submit">{taskForm.id ? "Update task" : "Add task"}</Button>
                        {taskForm.id && (
                          <Button type="button" variant="ghost" onClick={() => resetTaskForm(c.id)}>
                            Cancel
                          </Button>
                        )}
                      </div>
                      {taskErrors[c.id] && <p className="text-sm text-red-600">{taskErrors[c.id]}</p>}
                    </form>
                  </div>
                )}
              </li>
            );
          })
        )
      }
    />
  );
}

function AdminCrud({
  title,
  description,
  form,
  list,
}: {
  title: string;
  description?: string;
  form: React.ReactNode;
  list: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="font-semibold text-ink">{title}</h2>
      {description && <p className="mb-4 mt-1 text-sm text-muted">{description}</p>}
      <div className="mb-6 border-b border-border-light pb-6">{form}</div>
      <ul className="divide-y divide-border-light">{list}</ul>
    </Card>
  );
}
