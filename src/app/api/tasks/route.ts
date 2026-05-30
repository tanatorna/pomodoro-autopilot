import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

export async function GET(request: Request) {
  const roomId = getRoomId(request);
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
    },
  });

  return Response.json(task, { status: 201 });
}
