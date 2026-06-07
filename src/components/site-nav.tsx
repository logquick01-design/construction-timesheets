"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SiteTab = { segment: string; label: string };

export function SiteNav({
  siteId,
  siteName,
  location,
  tabs,
}: {
  siteId: string;
  siteName: string;
  location: string;
  tabs: SiteTab[];
}) {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Site
          </span>
          <h2 className="text-xl font-semibold text-slate-850">{siteName}</h2>
          <span className="text-sm text-slate-500">{location}</span>
        </div>
        <nav className="-mb-px mt-3 flex flex-wrap gap-1">
          {tabs.map((t) => {
            const href = `/sites/${siteId}/${t.segment}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={t.segment}
                href={href}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  active
                    ? "border-[var(--color-accent)] text-slate-850"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
