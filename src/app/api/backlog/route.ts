import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { INITIAL_STATE } from "@/engine/types";
import { timerStateToDb } from "@/lib/sessionMapper";

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Auto-promote backlog ที่ scheduledFor ถึงแล้ว → pending */
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
    where: { roomId, status: "backlog" },
    // มีวันก่อน (ใกล้สุดก่อน) → null ท้ายสุด · ใช้ updatedAt เป็น tiebreak
    orderBy: [{ scheduledFor: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { updatedAt: "desc" }],
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

  // "จบวัน": ย้ายไป backlog + เคลียร์ scheduledFor (วันนี้ผ่านไปแล้ว) → กลายเป็น "ยังไม่กำหนด"
  await prisma.task.updateMany({
    where: { roomId, status: { in: ["pending", "in-progress"] } },
    data: { status: "backlog", scheduledFor: null },
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
