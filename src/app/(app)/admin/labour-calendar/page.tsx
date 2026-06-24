import { requireSession } from "@/lib/auth";
import { canReviewLabourRequests } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AdminLabourCalendarClient } from "@/components/admin-labour-calendar-client";

export default async function AdminLabourCalendarPage() {
  const session = await requireSession();
  if (!canReviewLabourRequests(session)) redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Labour Calendar"
        subtitle="Review and approve site manager labour requests across all projects"
      />
      <AdminLabourCalendarClient />
    </>
  );
}
