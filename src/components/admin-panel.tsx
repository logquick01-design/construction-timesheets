"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Select } from "./ui";
import { UserRole } from "@prisma/client";

type Tab = "sites" | "users";

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("sites");

  const tabs: { id: Tab; label: string }[] = [
    { id: "sites", label: "Sites" },
    { id: "users", label: "Managers & Users" },
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
      {tab === "sites" && <SitesAdmin />}
      {tab === "users" && <UsersAdmin />}
    </div>
  );
}

function SitesAdmin() {
  const [items, setItems] = useState<
    { id: string; name: string; location: string; active: boolean }[]
  >([]);
  const [form, setForm] = useState({ id: "", name: "", location: "", active: true });

  const load = useCallback(() => {
    fetch("/api/admin/sites")
      .then((r) => r.json())
      .then(setItems);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        location: form.location,
        active: form.active,
      }),
    });
    setForm({ id: "", name: "", location: "", active: true });
    load();
  }

  return (
    <AdminCrud
      title="Sites"
      description="Create and edit the sites your managers will run."
      form={
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
          <div className="flex gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active
            </label>
            <Button type="submit">{form.id ? "Update" : "Add"}</Button>
            {form.id && (
              <Button type="button" variant="ghost" onClick={() => setForm({ id: "", name: "", location: "", active: true })}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      }
      list={items.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>
            {s.name} — {s.location}{" "}
            {!s.active && <span className="text-red-500">(archived)</span>}
          </span>
          <div className="flex gap-2">
            <Link
              href={`/sites/${s.id}/dashboard`}
              className="rounded-lg bg-fill px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill-hover"
            >
              Open site
            </Link>
            <Button size="sm" variant="secondary" onClick={() => setForm({ id: s.id, name: s.name, location: s.location, active: s.active })}>
              Edit
            </Button>
          </div>
        </li>
      ))}
    />
  );
}

function UsersAdmin() {
  const [items, setItems] = useState<
    {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      active: boolean;
      siteAssignments: { site: { name: string; id: string } }[];
    }[]
  >([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    id: "",
    email: "",
    name: "",
    role: "SITE_MANAGER" as UserRole,
    password: "",
    active: true,
    siteIds: [] as string[],
  });

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/sites").then((r) => r.json()),
    ]).then(([u, s]) => {
      setItems(u);
      setSites(s);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form };
    if (form.id && !form.password) {
      const { password: _password, ...rest } = body;
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
      });
    } else {
      await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setForm({
      id: "",
      email: "",
      name: "",
      role: UserRole.SITE_MANAGER,
      password: "",
      active: true,
      siteIds: [],
    });
    load();
  }

  return (
    <AdminCrud
      title="Managers & users"
      description="Add managers, give them logins, and assign which sites they can run."
      form={
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              <option value={UserRole.ADMIN}>Admin</option>
              <option value={UserRole.SITE_MANAGER}>Site Manager</option>
              <option value={UserRole.QS}>QS</option>
            </Select>
            <Input type="password" placeholder={form.id ? "New password (optional)" : "Password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} {...(form.id ? {} : { required: true })} />
          </div>
          {form.role === UserRole.SITE_MANAGER && (
            <div>
              <p className="mb-1 text-sm font-medium text-muted">Assigned sites</p>
              <div className="flex flex-wrap gap-2">
                {sites.map((s) => (
                  <label key={s.id} className="flex items-center gap-1 rounded-lg bg-fill px-3 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={form.siteIds.includes(s.id)}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          siteIds: f.siteIds.includes(s.id)
                            ? f.siteIds.filter((id) => id !== s.id)
                            : [...f.siteIds, s.id],
                        }))
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit">{form.id ? "Update" : "Add user"}</Button>
            {form.id && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setForm({
                    id: "",
                    email: "",
                    name: "",
                    role: UserRole.SITE_MANAGER,
                    password: "",
                    active: true,
                    siteIds: [],
                  })
                }
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      }
      list={items.map((u) => (
        <li key={u.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span>
            {u.name} ({u.email}) — {u.role}
            {u.siteAssignments.length > 0 &&
              ` — ${u.siteAssignments.map((a) => a.site.name).join(", ")}`}
            {!u.active && <span className="text-red-500"> (inactive)</span>}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setForm({
                id: u.id,
                email: u.email,
                name: u.name,
                role: u.role,
                password: "",
                active: u.active,
                siteIds: u.siteAssignments.map((a) => a.site.id),
              })
            }
          >
            Edit
          </Button>
        </li>
      ))}
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
