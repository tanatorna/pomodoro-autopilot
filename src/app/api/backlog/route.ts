// GET  /api/backlog  — คืน tasks ที่อยู่ใน backlog
// POST /api/backlog  — end-of-day: ย้าย pending tasks → backlog + reset session

import { prisma } from "@/lib/prisma";
import { INITIAL_STATE } from "@/engine/types";
import { timerStateToDb } from "@/lib/sessionMapper";

export async function GET() {
  const tasks = await prisma.task.findMany({
    where: { status: "backlog" },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
  return Response.json(tasks);
}

export async function POST() {
  // ── 1. สรุปวันก่อนย้าย ─────────────────────────────
  const [completedTasks, pendingTasks, totalPomodoros] = await Promise.all([
    prisma.task.count({ where: { status: "done" } }),
    prisma.task.findMany({ where: { status: { in: ["pending", "in-progress"] } } }),
    prisma.session.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  // ── 2. ย้าย pending/in-progress → backlog ────────────
  await prisma.task.updateMany({
    where: { status: { in: ["pending", "in-progress"] } },
    data: { status: "backlog" },
  });

  // ── 3. void slots ที่เหลือทั้งหมด ──────────────────
  await prisma.scheduleSlot.updateMany({
    where: { status: "pending" },
    data: { status: "voided" },
  });

  // ── 4. reset session → IDLE ────────────────────────
  const session = await prisma.session.findFirst({
    orderBy: { createdAt: "desc" },
  });

  const resetState = { ...INITIAL_STATE };

  if (session) {
    await prisma.session.update({
      where: { id: session.id },
      data: timerStateToDb(resetState),
    });
  }

  return Response.json({
    summary: {
      completedTasks,
      movedToBacklog: pendingTasks.length,
      completedPomodoros: totalPomodoros?.completedPomodoros ?? 0,
    },
  });
}
