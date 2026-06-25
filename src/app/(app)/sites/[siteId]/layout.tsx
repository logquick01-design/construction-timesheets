import { notFound, redirect } from "next/navigation";
import { requireSession, canAccessSite } from "@/lib/auth";
import { canLogHours, canManageSite } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { mergeSiteFeatures } from "@/lib/site-features";
import { SiteNav } from "@/components/site-nav";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const session = await requireSession();

  if (!canAccessSite(session, siteId)) redirect("/sites");

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true, location: true, features: true },
  });
  if (!site) notFound();

  const features = mergeSiteFeatures(site.features);
  const canLog = canLogHours(session);
  const canSetup = canManageSite(session, siteId);

  return (
    <div className="-mx-4 -my-6">
      <SiteNav
        siteId={siteId}
        siteName={site.name}
        location={site.location}
        features={features}
        canLogHours={canLog}
        canManageSite={canSetup}
      />
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
