import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { loadSiteFeatures, isSiteFeatureEnabled } from "@/lib/site-features";
import { ExportsClient } from "@/components/exports-client";
import { getWeekRange, formatDate } from "@/lib/utils";

export default async function SiteExportsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const session = await requireSession();
  const features = await loadSiteFeatures(siteId);

  if (!isSiteFeatureEnabled(features, "exports")) {
    redirect(`/sites/${siteId}/dashboard`);
  }

  const { start, end } = getWeekRange();

  return (
    <ExportsClient
      role={session.role}
      siteIds={session.siteIds}
      defaultFrom={formatDate(start)}
      defaultTo={formatDate(end)}
      lockedSiteId={siteId}
      pageSubtitle="Payroll CSV and PDF report for this site"
    />
  );
}
