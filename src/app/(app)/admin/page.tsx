import { requireSession } from "@/lib/auth";
import { canManageData } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AdminPanel } from "@/components/admin-panel";

export default async function AdminPage() {
  const session = await requireSession();
  if (!canManageData(session)) redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Company Admin"
        subtitle="Set up sites and manage the managers who run them"
      />
      <AdminPanel />
    </>
  );
}
