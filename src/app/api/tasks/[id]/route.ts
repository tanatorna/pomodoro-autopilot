import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

type PatchBody = {
  title?: string;
  priority?: number;
  status?: string;
  estimatedPomodoros?: number;
  /** ใช้ตอน mark done มือ (✔) — เครดิตลูกที่ทำไปแล้วโดยไม่ผ่าน timer */
  completedPomodoros?: number;
  /** YYYY-MM-DD (local) วันที่เสร็จจริง — stamp ตอน mark done มือ ให้เข้า Stats */
  doneDate?: string;
  /** ISO string (YYYY-MM-DD) หรือ null = เคลียร์วัน */
  scheduledFor?: string | null;
};

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const roomId = getRoomId(request);
  const { id } = await ctx.params;
  const taskId = parseInt(id, 10);

  if (isNaN(taskId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const body = (await request.json()) as PatchBody;

  try {
    const task = await prisma.task.update({
      where: { id: taskId, roomId },
      data: {
        ...(body.title !== undefined && body.title.trim() && {
          title: body.title.trim(),
        }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.estimatedPomodoros !== undefined && {
          estimatedPomodoros: body.estimatedPomodoros,
        }),
        ...(body.completedPomodoros !== undefined && {
          completedPomodoros: body.completedPomodoros,
        }),
        ...(body.doneDate !== undefined && { doneDate: body.doneDate }),
        ...(body.scheduledFor !== undefined && {
          scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        }),
      },
    });
    return Response.json(task);
  } catch {
    // P2025 = ไม่พบ task ที่ id นี้ "ในห้องนี้" (อาจเป็นของห้องอื่น)
    return Response.json({ error: "task not found" }, { status: 404 });
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const roomId = getRoomId(request);
  const { id } = await ctx.params;
  const taskId = parseInt(id, 10);

  if (isNaN(taskId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  try {
    // ScheduleSlot อ้างถึง task ด้วย FK (ON DELETE RESTRICT)
    // → ต้องลบ slots ของ task นี้ก่อน ไม่งั้น delete จะติด constraint
    await prisma.scheduleSlot.deleteMany({ where: { taskId, roomId } });
    await prisma.task.delete({ where: { id: taskId, roomId } });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "task not found" }, { status: 404 });
  }
}
