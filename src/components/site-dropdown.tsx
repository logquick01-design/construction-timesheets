"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Building2 } from "lucide-react";

type Site = { id: string; name: string; location: string };

export function SiteDropdown({ sites }: { sites: Site[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const match = pathname.match(/^\/sites\/([^/]+)/);
  const currentSiteId = match?.[1];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = sites.find((s) => s.id === currentSiteId);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
      >
        <Building2 size={16} className="text-white" />
        <span className="max-w-[140px] truncate">
          {current ? current.name : "Sites"}
        </span>
        <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
          {sites.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-light">No sites available</p>
          )}
          {sites.map((s) => (
            <Link
              key={s.id}
              href={`/sites/${s.id}/dashboard`}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 text-sm hover:bg-fill ${
                s.id === currentSiteId ? "bg-fill font-semibold text-ink" : "text-ink"
              }`}
            >
              <span className="block truncate">{s.name}</span>
              <span className="block truncate text-xs text-muted-light">{s.location}</span>
            </Link>
          ))}
          <div className="my-1 border-t border-border-light" />
          <Link
            href="/sites"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-accent hover:bg-fill"
          >
            View all sites
          </Link>
        </div>
      )}
    </div>
  );
}
