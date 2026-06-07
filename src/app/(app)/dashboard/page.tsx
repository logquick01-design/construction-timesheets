import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canViewAllSites } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { DashboardClient } from "@/components/dashboard-client";
import { getWeekRange, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireSession();
  // Company-wide overview is only for roles that can see every site.
  if (!canViewAllSites(session)) {
    if (session.siteIds.length === 1) redirect(`/sites/${session.siteIds[0]}/dashboard`);
    redirect("/sites");
  }
  const { start, end } = getWeekRange();

  return (
    <>
      <PageHeader title="Company Overview" subtitle="Hours across all sites" />
      <DashboardClient
        defaultFrom={formatDate(start)}
        defaultTo={formatDate(end)}
        role={session.role}
        siteIds={session.siteIds}
      />
    </>
  );
}
