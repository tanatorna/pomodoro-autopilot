// PATCH /api/tasks/[id] — อัปเดต priority / status / estimatedPomodoros

import { prisma } from "@/lib/prisma";

type PatchBody = {
  priority?: number;
  status?: string;
  estimatedPomodoros?: number;
};

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const { id } = await ctx.params;
  const taskId = parseInt(id, 10);

  if (isNaN(taskId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const body = (await request.json()) as PatchBody;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.estimatedPomodoros !== undefined && {
        estimatedPomodoros: body.estimatedPomodoros,
      }),
    },
  });

  return Response.json(task);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]">
) {
  const { id } = await ctx.params;
  const taskId = parseInt(id, 10);

  if (isNaN(taskId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  await prisma.task.delete({ where: { id: taskId } });
  return new Response(null, { status: 204 });
}
