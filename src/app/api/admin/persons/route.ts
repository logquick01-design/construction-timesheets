import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN" && session.role !== "SITE_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const persons = await prisma.person.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json(persons);
}
