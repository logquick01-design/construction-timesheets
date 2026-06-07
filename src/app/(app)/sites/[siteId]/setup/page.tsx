import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageSite } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { SiteSetupPanel } from "@/components/site-setup-panel";

export default async function SiteSetupPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const session = await requireSession();
  if (!canManageSite(session, siteId)) redirect(`/sites/${siteId}/dashboard`);

  return (
    <>
      <PageHeader
        title="Site Setup"
        subtitle="Companies, workers, cost code categories and tasks for this site"
      />
      <SiteSetupPanel siteId={siteId} />
    </>
  );
}
