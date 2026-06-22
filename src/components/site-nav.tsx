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
    <div className="border-b border-border bg-white">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            Site
          </span>
          <h2 className="text-xl font-semibold text-ink">{siteName}</h2>
          <span className="text-sm text-muted">{location}</span>
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
                    ? "border-accent text-ink"
                    : "border-transparent text-muted hover:text-ink"
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
