// GET  /api/tasks  — คืน task ทั้งหมด (ไม่รวม backlog)
// POST /api/tasks  — สร้าง task ใหม่ (brain dump)

import { prisma } from "@/lib/prisma";

export async function GET() {
  const tasks = await prisma.task.findMany({
    where: { status: { not: "backlog" } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return Response.json(tasks);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; priority?: number };

  if (!body.title || body.title.trim() === "") {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title: body.title.trim(),
      priority: body.priority ?? 0,
    },
  });

  return Response.json(task, { status: 201 });
}
