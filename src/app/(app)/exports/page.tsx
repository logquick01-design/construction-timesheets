import { requireSession } from "@/lib/auth";
import { ExportsClient } from "@/components/exports-client";
import { getWeekRange, formatDate } from "@/lib/utils";

export default async function ExportsPage() {
  const session = await requireSession();
  const { start, end } = getWeekRange();

  return (
    <ExportsClient
      role={session.role}
      siteIds={session.siteIds}
      defaultFrom={formatDate(start)}
      defaultTo={formatDate(end)}
      pageSubtitle="Payroll CSV and site PDF reports"
    />
  );
}
