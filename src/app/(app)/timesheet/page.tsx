import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export default async function LegacyTimesheetRedirect() {
  const session = await requireSession();
  if (session.siteIds.length === 1) redirect(`/sites/${session.siteIds[0]}/timesheet`);
  redirect("/sites");
}
