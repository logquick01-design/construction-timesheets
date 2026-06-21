"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Menu, X } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { cn } from "@/lib/utils";

type Site = { id: string; name: string; location: string };

export function MobileNav({
  sessionName,
  showOverview,
  showAdmin,
  sites,
}: {
  sessionName: string;
  showOverview: boolean;
  showAdmin: boolean;
  sites: Site[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const currentSiteId = pathname.match(/^\/sites\/([^/]+)/)?.[1];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-[var(--app-header-height)] z-40 bg-black/20"
            onClick={close}
            aria-label="Close menu"
          />
          <nav
            id="mobile-nav-panel"
            className="absolute right-0 z-50 mt-3 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <div className="max-h-[calc(100dvh-var(--app-header-height)-1.5rem)] overflow-y-auto p-2">
              {showOverview && (
                <MobileNavLink href="/dashboard" label="Overview" pathname={pathname} onNavigate={close} />
              )}

              <div className="my-1 border-t border-slate-100 pt-1">
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Sites
                </p>
                {sites.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-400">No sites available</p>
                ) : (
                  sites.map((s) => (
                    <Link
                      key={s.id}
                      href={`/sites/${s.id}/dashboard`}
                      onClick={close}
                      className={cn(
                        "flex min-h-11 items-start gap-2 rounded-lg px-3 py-2 hover:bg-slate-50",
                        s.id === currentSiteId && "bg-slate-50"
                      )}
                    >
                      <Building2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            s.id === currentSiteId ? "font-semibold text-slate-850" : "text-slate-700"
                          )}
                        >
                          {s.name}
                        </span>
                        <span className="block truncate text-xs text-slate-400">{s.location}</span>
                      </span>
                    </Link>
                  ))
                )}
                <Link
                  href="/sites"
                  onClick={close}
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[var(--color-accent)] hover:bg-slate-50"
                >
                  View all sites
                </Link>
              </div>

              {showOverview && (
                <MobileNavLink href="/exports" label="Exports" pathname={pathname} onNavigate={close} />
              )}
              {showAdmin && (
                <MobileNavLink href="/admin" label="Company Admin" pathname={pathname} onNavigate={close} />
              )}

              <div className="mt-1 border-t border-slate-100 pt-2">
                <p className="px-3 py-1 text-sm text-slate-500">{sessionName}</p>
                <LogoutButton className="mt-1 w-full justify-center min-h-11" onLoggedOut={close} />
              </div>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

function MobileNavLink({
  href,
  label,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  pathname: string;
  onNavigate: () => void;
}) {
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center rounded-lg px-3 text-base font-medium",
        active ? "bg-slate-100 text-slate-850" : "text-slate-700 hover:bg-slate-50"
      )}
    >
      {label}
    </Link>
  );
}
