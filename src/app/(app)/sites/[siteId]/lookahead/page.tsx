import { requireSession } from "@/lib/auth";
import { canCreateLabourRequest } from "@/lib/permissions";
import { LookAheadClient } from "@/components/look-ahead-client";

export default async function SiteLookAheadPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const session = await requireSession();

  return (
    <LookAheadClient
      siteId={siteId}
      canCreate={canCreateLabourRequest(session)}
      title="Look Ahead"
      subtitle="Request labour by worker and date — pending until company approval"
    />
  );
}
