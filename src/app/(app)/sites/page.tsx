import Link from "next/link";
import { requireSession, getAccessibleSites } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { ArrowRight, Building2 } from "lucide-react";

export default async function SitesPage() {
  const session = await requireSession();
  const sites = await getAccessibleSites(session);

  return (
    <>
      <PageHeader
        title="Sites"
        subtitle="Select a site to view its dashboard, crew, cost codes and timesheets"
      />
      {sites.length === 0 ? (
        <Card>
          <p className="text-slate-500">
            You don&apos;t have access to any sites yet. Ask your company admin to assign you.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <Link key={s.id} href={`/sites/${s.id}/dashboard`}>
              <Card className="flex h-full items-center justify-between gap-3 transition hover:border-[var(--color-accent)] hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-850">{s.name}</p>
                    <p className="text-sm text-slate-500">{s.location}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-slate-300" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
