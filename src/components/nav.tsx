import Link from "next/link";
import { getSession, getAccessibleSites } from "@/lib/auth";
import { canViewAllSites, canManageData } from "@/lib/permissions";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./mobile-nav";
import { SiteDropdown } from "./site-dropdown";

export async function AppNav() {
  const session = await getSession();
  if (!session) return null;

  const sites = await getAccessibleSites(session);
  const showOverview = canViewAllSites(session);
  const showAdmin = canManageData(session);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-slate-850">
          Log<span className="text-[var(--color-accent)]">Q</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex sm:gap-2">
          {showOverview && <NavLink href="/dashboard" label="Overview" />}
          <SiteDropdown sites={sites} />
          {showOverview && <NavLink href="/exports" label="Exports" />}
          {showAdmin && <NavLink href="/admin" label="Company Admin" />}
          <span className="text-sm text-slate-500">{session.name}</span>
          <LogoutButton />
        </nav>
        <MobileNav
          sessionName={session.name}
          showOverview={showOverview}
          showAdmin={showAdmin}
          sites={sites}
        />
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
    >
      {label}
    </Link>
  );
}
