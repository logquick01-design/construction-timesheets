import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORY_NAMES = [
  "Instructed Works",
  "Contra Charge Works",
  "Provisional Sum Works",
  "Other",
];

type TaskSeed = { name: string; reference: string; categoryIndex: number };

// Each site gets its own categories, tasks, companies and workers.
async function seedSite(opts: {
  name: string;
  location: string;
  tasks: TaskSeed[];
  companies: { name: string; workers: { name: string; trade: string }[] }[];
}) {
  const site = await prisma.site.create({
    data: { name: opts.name, location: opts.location, active: true },
  });

  const categories = await Promise.all(
    CATEGORY_NAMES.map((name, i) =>
      prisma.costCodeCategory.create({
        data: { name, sortOrder: i, siteId: site.id },
      })
    )
  );

  const tasks = await Promise.all(
    opts.tasks.map((t) =>
      prisma.costCodeTask.create({
        data: {
          name: t.name,
          reference: t.reference,
          siteId: site.id,
          categoryId: categories[t.categoryIndex].id,
        },
      })
    )
  );

  const workers: { id: string }[] = [];
  for (const c of opts.companies) {
    const company = await prisma.company.create({
      data: { name: c.name, siteId: site.id },
    });
    for (const w of c.workers) {
      const worker = await prisma.worker.create({
        data: {
          name: w.name,
          trade: w.trade,
          siteId: site.id,
          companyId: company.id,
        },
      });
      workers.push(worker);
    }
  }

  return { site, categories, tasks, workers };
}

async function main() {
  await prisma.timesheetEntry.deleteMany();
  await prisma.siteManagerAssignment.deleteMany();
  await prisma.costCodeTask.deleteMany();
  await prisma.costCodeCategory.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.company.deleteMany();
  await prisma.site.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const siteA = await seedSite({
    name: "Riverside Tower",
    location: "Manchester",
    tasks: [
      { name: "Groundworks", reference: "IW-001", categoryIndex: 0 },
      { name: "Structural steel", reference: "IW-002", categoryIndex: 0 },
      { name: "MEP first fix", reference: "IW-003", categoryIndex: 0 },
      { name: "Defect rectification", reference: "CC-101", categoryIndex: 1 },
      { name: "General provisional", reference: "PS-001", categoryIndex: 2 },
      { name: "Site setup", reference: "OT-001", categoryIndex: 3 },
    ],
    companies: [
      {
        name: "BuildRight Ltd",
        workers: [
          { name: "James Carter", trade: "Carpenter" },
          { name: "Maria Lopez", trade: "Electrician" },
        ],
      },
      {
        name: "Northern Trades Co",
        workers: [{ name: "Tom Hughes", trade: "Labourer" }],
      },
    ],
  });

  const siteB = await seedSite({
    name: "Harbour Phase 2",
    location: "Liverpool",
    tasks: [
      { name: "Piling", reference: "IW-101", categoryIndex: 0 },
      { name: "Concrete frame", reference: "IW-102", categoryIndex: 0 },
      { name: "Snagging", reference: "CC-201", categoryIndex: 1 },
      { name: "Welfare facilities", reference: "OT-101", categoryIndex: 3 },
    ],
    companies: [
      {
        name: "Coastal Construction",
        workers: [
          { name: "Priya Shah", trade: "Plumber" },
          { name: "Owen Bell", trade: "Steel fixer" },
        ],
      },
    ],
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Alex Admin",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const qs = await prisma.user.create({
    data: {
      email: "qs@example.com",
      name: "Sam Surveyor",
      passwordHash,
      role: UserRole.QS,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: "manager@example.com",
      name: "Jordan Manager",
      passwordHash,
      role: UserRole.SITE_MANAGER,
      siteAssignments: { create: { siteId: siteA.site.id } },
    },
  });

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  await prisma.timesheetEntry.createMany({
    data: [
      {
        workerId: siteA.workers[0].id,
        siteId: siteA.site.id,
        taskId: siteA.tasks[0].id,
        date: today,
        hours: 8,
      },
      {
        workerId: siteA.workers[1].id,
        siteId: siteA.site.id,
        taskId: siteA.tasks[2].id,
        date: today,
        hours: 7.5,
      },
      {
        workerId: siteA.workers[0].id,
        siteId: siteA.site.id,
        taskId: siteA.tasks[1].id,
        date: yesterday,
        hours: 6,
      },
      {
        workerId: siteB.workers[0].id,
        siteId: siteB.site.id,
        taskId: siteB.tasks[0].id,
        date: today,
        hours: 8,
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo logins (password: password123):");
  console.log("  Admin:", admin.email);
  console.log("  Site Manager:", manager.email);
  console.log("  QS:", qs.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
