import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canViewAllSites } from "@/lib/permissions";

export default async function Home() {
  const session = await requireSession();
  if (canViewAllSites(session)) redirect("/dashboard");
  if (session.siteIds.length === 1) redirect(`/sites/${session.siteIds[0]}/dashboard`);
  redirect("/sites");
}
