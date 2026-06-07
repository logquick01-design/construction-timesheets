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
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        <Building2 size={16} className="text-slate-400" />
        <span className="max-w-[140px] truncate">
          {current ? current.name : "Sites"}
        </span>
        <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {sites.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-400">No sites available</p>
          )}
          {sites.map((s) => (
            <Link
              key={s.id}
              href={`/sites/${s.id}/dashboard`}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 text-sm hover:bg-slate-50 ${
                s.id === currentSiteId ? "bg-slate-50 font-semibold text-slate-850" : "text-slate-700"
              }`}
            >
              <span className="block truncate">{s.name}</span>
              <span className="block truncate text-xs text-slate-400">{s.location}</span>
            </Link>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <Link
            href="/sites"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-[var(--color-accent)] hover:bg-slate-50"
          >
            View all sites
          </Link>
        </div>
      )}
    </div>
  );
}
