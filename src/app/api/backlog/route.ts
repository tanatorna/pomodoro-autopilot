import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { INITIAL_STATE } from "@/engine/types";
import { timerStateToDb } from "@/lib/sessionMapper";

export async function GET(request: Request) {
  const roomId = getRoomId(request);
  const tasks = await prisma.task.findMany({
    where: { roomId, status: "backlog" },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  return Response.json(tasks);
}

export async function POST(request: Request) {
  const roomId = getRoomId(request);

  const [completedTasks, pendingTasks, session] = await Promise.all([
    prisma.task.count({ where: { roomId, status: "done" } }),
    prisma.task.findMany({ where: { roomId, status: { in: ["pending", "in-progress"] } } }),
    prisma.session.findFirst({ where: { roomId }, orderBy: { createdAt: "desc" } }),
  ]);

  await prisma.task.updateMany({
    where: { roomId, status: { in: ["pending", "in-progress"] } },
    data: { status: "backlog" },
  });

  await prisma.scheduleSlot.updateMany({
    where: { roomId, status: "pending" },
    data: { status: "voided" },
  });

  if (session) {
    await prisma.session.update({
      where: { id: session.id },
      data: timerStateToDb({ ...INITIAL_STATE }),
    });
  }

  return Response.json({
    summary: {
      completedTasks,
      movedToBacklog: pendingTasks.length,
      completedPomodoros: session?.completedPomodoros ?? 0,
    },
  });
}
