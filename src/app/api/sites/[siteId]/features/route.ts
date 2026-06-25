import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { loadSiteFeatures } from "@/lib/site-features";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const session = await getSession();
  if (!session || !canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const features = await loadSiteFeatures(siteId);
  return NextResponse.json({ features });
}
