import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DashboardClient } from "@/components/dashboard-client";
import { getWeekRange, formatDate } from "@/lib/utils";

export default async function SiteDashboardPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const session = await requireSession();
  const { start, end } = getWeekRange();

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Hours logged on this site" />
      <DashboardClient
        defaultFrom={formatDate(start)}
        defaultTo={formatDate(end)}
        role={session.role}
        siteIds={session.siteIds}
        lockedSiteId={siteId}
      />
    </>
  );
}
