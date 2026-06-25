"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSiteNavTabs,
  mergeSiteFeatures,
  type SiteFeatures,
} from "@/lib/site-features";

export function SiteNav({
  siteId,
  siteName,
  location,
  features: initialFeatures,
  canLogHours,
  canManageSite,
}: {
  siteId: string;
  siteName: string;
  location: string;
  features: SiteFeatures;
  canLogHours: boolean;
  canManageSite: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [features, setFeatures] = useState(initialFeatures);

  useEffect(() => {
    setFeatures(initialFeatures);
  }, [initialFeatures]);

  const refreshFeatures = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/features`);
      if (!res.ok) return;
      const json = (await res.json()) as { features?: SiteFeatures };
      setFeatures(mergeSiteFeatures(json.features));
    } catch {
      // Keep the last known features if the refresh fails.
    }
  }, [siteId]);

  useEffect(() => {
    void refreshFeatures();
  }, [refreshFeatures]);

  useEffect(() => {
    function onFocus() {
      void refreshFeatures();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshFeatures]);

  const tabs = useMemo(
    () => buildSiteNavTabs({ features, canLogHours, canManageSite }),
    [features, canLogHours, canManageSite]
  );

  useEffect(() => {
    const segment = pathname.replace(`/sites/${siteId}/`, "").split("/")[0];
    if (segment === "dashboard" || !segment) return;
    if (tabs.some((t) => t.segment === segment)) return;
    router.replace(`/sites/${siteId}/dashboard`);
  }, [pathname, router, siteId, tabs]);

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
