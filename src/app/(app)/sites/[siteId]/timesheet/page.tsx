import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canLogHours } from "@/lib/permissions";
import { loadSiteFeatures, isSiteFeatureEnabled } from "@/lib/site-features";
import { PageHeader } from "@/components/ui";
import { TimesheetClient } from "@/components/timesheet-client";
import { formatDate } from "@/lib/utils";

export default async function SiteTimesheetPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const session = await requireSession();
  if (!canLogHours(session)) redirect(`/sites/${siteId}/dashboard`);

  const features = await loadSiteFeatures(siteId);
  if (!isSiteFeatureEnabled(features, "logHours")) {
    redirect(`/sites/${siteId}/dashboard`);
  }

  return (
    <>
      <PageHeader
        title="Daily Timesheet"
        subtitle="Log hours for this site's crew — all changes save together"
      />
      <TimesheetClient
        role={session.role}
        siteIds={session.siteIds}
        defaultDate={formatDate(new Date())}
        lockedSiteId={siteId}
      />
    </>
  );
}
