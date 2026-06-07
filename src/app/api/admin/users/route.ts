import { NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { canManageData } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session || !canManageData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      siteAssignments: { include: { site: true } },
    },
  });
  return NextResponse.json(users);
}

const schema = z.object({
  id: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
  siteIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !canManageData(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { id, email, name, role, active, password, siteIds } = parsed.data;

  if (id) {
    const data: {
      email: string;
      name: string;
      role: UserRole;
      active: boolean;
      passwordHash?: string;
    } = {
      email: email.toLowerCase(),
      name,
      role,
      active: active ?? true,
    };
    if (password) data.passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      if (role === "SITE_MANAGER") {
        await tx.siteManagerAssignment.deleteMany({ where: { userId: id } });
        if (siteIds?.length) {
          await tx.siteManagerAssignment.createMany({
            data: siteIds.map((siteId) => ({ userId: id, siteId })),
          });
        }
      } else {
        await tx.siteManagerAssignment.deleteMany({ where: { userId: id } });
      }
      return tx.user.update({
        where: { id },
        data,
        include: { siteAssignments: { include: { site: true } } },
      });
    });
    return NextResponse.json(user);
  }

  if (!password) {
    return NextResponse.json({ error: "Password required for new user" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      role,
      active: active ?? true,
      passwordHash,
      ...(role === "SITE_MANAGER" && siteIds?.length
        ? {
            siteAssignments: {
              create: siteIds.map((siteId) => ({ siteId })),
            },
          }
        : {}),
    },
    include: { siteAssignments: { include: { site: true } } },
  });
  return NextResponse.json(user);
}
