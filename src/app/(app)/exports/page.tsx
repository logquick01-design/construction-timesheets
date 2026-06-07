import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ExportsClient } from "@/components/exports-client";
import { getWeekRange, formatDate } from "@/lib/utils";

export default async function ExportsPage() {
  const session = await requireSession();
  const { start, end } = getWeekRange();

  return (
    <>
      <PageHeader title="Exports" subtitle="Payroll CSV and site PDF reports" />
      <ExportsClient
        role={session.role}
        siteIds={session.siteIds}
        defaultFrom={formatDate(start)}
        defaultTo={formatDate(end)}
      />
    </>
  );
}
