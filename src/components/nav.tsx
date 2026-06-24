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
    <header className="sticky top-0 z-40 border-b border-black bg-black">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <Link href="/" className="text-base font-bold text-white">
          LogQ
        </Link>
        <nav className="hidden items-center gap-1 sm:flex sm:gap-2">
          {showOverview && <NavLink href="/dashboard" label="Overview" />}
          <SiteDropdown sites={sites} />
          {showOverview && <NavLink href="/exports" label="Exports" />}
          {showAdmin && <NavLink href="/admin" label="Company Admin" />}
          {showAdmin && <NavLink href="/admin/labour-calendar" label="Labour Calendar" />}
          <span className="text-sm text-white">{session.name}</span>
          <LogoutButton className="text-white hover:bg-white/10" />
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
      className="rounded-lg px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
    >
      {label}
    </Link>
  );
}
