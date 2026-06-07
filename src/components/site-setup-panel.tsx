"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, Select } from "./ui";

type Tab = "companies" | "workers" | "categories" | "tasks";

export function SiteSetupPanel({ siteId }: { siteId: string }) {
  const [tab, setTab] = useState<Tab>("companies");

  const tabs: { id: Tab; label: string }[] = [
    { id: "companies", label: "Companies" },
    { id: "workers", label: "Workers" },
    { id: "categories", label: "Categories" },
    { id: "tasks", label: "Tasks" },
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
                ? "bg-slate-850 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "companies" && <CompaniesAdmin siteId={siteId} />}
      {tab === "workers" && <WorkersAdmin siteId={siteId} />}
      {tab === "categories" && <CategoriesAdmin siteId={siteId} />}
      {tab === "tasks" && <TasksAdmin siteId={siteId} />}
    </div>
  );
}

type Company = { id: string; name: string; active: boolean };

function CompaniesAdmin({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<Company[]>([]);
  const [form, setForm] = useState({ id: "", name: "", active: true });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/companies?siteId=${siteId}`)
      .then((r) => r.json())
      .then(setItems);
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save company.");
      return;
    }
    setForm({ id: "", name: "", active: true });
    load();
  }

  return (
    <AdminCrud
      title="Subcontractor companies"
      description="Companies that supply workers to this site."
      form={
        <form onSubmit={save} className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Company name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>
          <Button type="submit">{form.id ? "Update" : "Add"}</Button>
          {form.id && (
            <Button type="button" variant="ghost" onClick={() => setForm({ id: "", name: "", active: true })}>
              Cancel
            </Button>
          )}
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      }
      list={
        items.length === 0 ? (
          <li className="py-2 text-sm text-slate-500">No companies yet.</li>
        ) : (
          items.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>
                {c.name}
                {!c.active && <span className="text-red-500"> (archived)</span>}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setForm({ id: c.id, name: c.name, active: c.active })}>
                Edit
              </Button>
            </li>
          ))
        )
      }
    />
  );
}

type WorkerItem = {
  id: string;
  name: string;
  trade: string;
  active: boolean;
  companyId: string | null;
  company: { id: string; name: string } | null;
};

function WorkersAdmin({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<WorkerItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({
    id: "",
    name: "",
    trade: "",
    companyId: "",
    active: true,
  });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/admin/workers?siteId=${siteId}`).then((r) => r.json()),
      fetch(`/api/admin/companies?siteId=${siteId}`).then((r) => r.json()),
    ]).then(([w, c]) => {
      setItems(w);
      setCompanies(c);
      setForm((f) => (f.id || f.companyId || !c[0] ? f : { ...f, companyId: c[0].id }));
    });
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  const workersByCompany = useMemo(() => {
    const map = new Map<string, { name: string; rows: WorkerItem[] }>();
    for (const w of items) {
      const key = w.company?.id ?? "unassigned";
      const name = w.company?.name ?? "Unassigned";
      if (!map.has(key)) map.set(key, { name, rows: [] });
      map.get(key)!.rows.push(w);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  function reset() {
    setError("");
    setForm({ id: "", name: "", trade: "", companyId: companies[0]?.id ?? "", active: true });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.companyId) {
      setError("Please select a company.");
      return;
    }
    const res = await fetch("/api/admin/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to save worker.");
      return;
    }
    reset();
    load();
  }

  return (
    <AdminCrud
      title="Workers"
      description="The crew working on this site, grouped by company."
      form={
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input placeholder="Trade / role" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} required />
            <div>
              <Label>Company</Label>
              <Select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} required>
                <option value="">Select company…</option>
                {companies
                  .filter((c) => c.active || c.id === form.companyId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {!c.active ? " (archived)" : ""}
                    </option>
                  ))}
              </Select>
            </div>
          </div>
          {companies.length === 0 && (
            <p className="text-sm text-amber-600">Add a company first before adding workers.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
            <Button type="submit" disabled={companies.length === 0}>
              {form.id ? "Update" : "Add"}
            </Button>
            {form.id && (
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      }
      list={
        workersByCompany.length === 0 ? (
          <li className="py-2 text-sm text-slate-500">No workers yet.</li>
        ) : (
          workersByCompany.map((group) => (
            <li key={group.name}>
              <div className="bg-slate-100 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {group.name}
              </div>
              <ul className="divide-y divide-slate-100">
                {group.rows.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2 pl-4">
                    <span>
                      {w.name} <span className="text-slate-500">({w.trade})</span>
                      {!w.active && <span className="text-red-500"> (archived)</span>}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setForm({
                          id: w.id,
                          name: w.name,
                          trade: w.trade,
                          companyId: w.companyId ?? w.company?.id ?? "",
                          active: w.active,
                        })
                      }
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))
        )
      }
    />
  );
}

function CategoriesAdmin({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [form, setForm] = useState({ id: "", name: "", active: true });

  const load = useCallback(() => {
    fetch(`/api/admin/categories?siteId=${siteId}`)
      .then((r) => r.json())
      .then(setItems);
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    setForm({ id: "", name: "", active: true });
    load();
  }

  return (
    <AdminCrud
      title="Cost code categories"
      description="Top-level groupings for this site's cost codes."
      form={
        <form onSubmit={save} className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Button type="submit">{form.id ? "Update" : "Add"}</Button>
          {form.id && (
            <Button type="button" variant="ghost" onClick={() => setForm({ id: "", name: "", active: true })}>
              Cancel
            </Button>
          )}
        </form>
      }
      list={
        items.length === 0 ? (
          <li className="py-2 text-sm text-slate-500">No categories yet.</li>
        ) : (
          items.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>
                {c.name}
                {!c.active && <span className="text-red-500"> (archived)</span>}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setForm({ id: c.id, name: c.name, active: c.active })}>
                Edit
              </Button>
            </li>
          ))
        )
      }
    />
  );
}

function TasksAdmin({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<
    { id: string; name: string; reference: string; active: boolean; category: { name: string }; categoryId: string }[]
  >([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ id: "", name: "", reference: "", categoryId: "", active: true });

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/admin/tasks?siteId=${siteId}`).then((r) => r.json()),
      fetch(`/api/admin/categories?siteId=${siteId}`).then((r) => r.json()),
    ]).then(([t, c]) => {
      setItems(t);
      setCategories(c);
      setForm((f) => (f.id || f.categoryId || !c[0] ? f : { ...f, categoryId: c[0].id }));
    });
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId) return;
    await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteId }),
    });
    setForm({ id: "", name: "", reference: "", categoryId: categories[0]?.id ?? "", active: true });
    load();
  }

  return (
    <AdminCrud
      title="Tasks / cost codes"
      description="Individual cost codes workers log time against."
      form={
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Task name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Ref #" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required />
          <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            <option value="">Select category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={categories.length === 0}>
            {form.id ? "Update" : "Add"}
          </Button>
          {categories.length === 0 && (
            <p className="text-sm text-amber-600 sm:col-span-2 lg:col-span-4">
              Add a category first before adding tasks.
            </p>
          )}
        </form>
      }
      list={
        items.length === 0 ? (
          <li className="py-2 text-sm text-slate-500">No tasks yet.</li>
        ) : (
          items.map((t) => (
            <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <span>
                {t.name} ({t.reference}) — {t.category.name}
                {!t.active && <span className="text-red-500"> (archived)</span>}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setForm({ id: t.id, name: t.name, reference: t.reference, categoryId: t.categoryId, active: t.active })}
              >
                Edit
              </Button>
            </li>
          ))
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
      <h2 className="font-semibold text-slate-850">{title}</h2>
      {description && <p className="mb-4 mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mb-6 border-b border-slate-100 pb-6">{form}</div>
      <ul className="divide-y divide-slate-100">{list}</ul>
    </Card>
  );
}
