import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

/** วันนี้สิ้นวัน (23:59:59) — ใช้เปรียบเทียบ scheduledFor ≤ today */
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Auto-promote: ดึง task ใน backlog ที่ scheduledFor ถึงแล้ว → pending
 *  รันทุกครั้งที่ GET /api/tasks หรือ /api/backlog */
async function autoPromoteScheduled(roomId: string) {
  await prisma.task.updateMany({
    where: {
      roomId,
      status: "backlog",
      scheduledFor: { not: null, lte: endOfToday() },
    },
    data: { status: "pending" },
  });
}

export async function GET(request: Request) {
  const roomId = getRoomId(request);
  await autoPromoteScheduled(roomId);
  const tasks = await prisma.task.findMany({
    where: { roomId, status: { not: "backlog" } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return Response.json(tasks);
}

export async function POST(request: Request) {
  const roomId = getRoomId(request);
  const body = (await request.json()) as {
    title?: string;
    priority?: number;
    estimatedPomodoros?: number;
    status?: string;
    scheduledFor?: string | null;
  };

  if (!body.title?.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      roomId,
      title: body.title.trim(),
      priority: body.priority ?? 0,
      estimatedPomodoros: body.estimatedPomodoros ?? 1,
      status: body.status ?? "pending",
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
    },
  });

  return Response.json(task, { status: 201 });
}
