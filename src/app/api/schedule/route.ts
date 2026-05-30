import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { generateSchedule } from "@/engine/scheduler";

export async function GET(request: Request) {
  const roomId = getRoomId(request);
  const slots = await prisma.scheduleSlot.findMany({
    where: { roomId, status: { not: "voided" } },
    orderBy: { slotIndex: "asc" },
    include: { task: true },
  });
  return Response.json(slots);
}

export async function POST(request: Request) {
  const roomId = getRoomId(request);
  const tasks = await prisma.task.findMany({
    where: { roomId, status: { in: ["pending", "in-progress"] } },
  });

  const generated = generateSchedule(tasks);

  await prisma.scheduleSlot.deleteMany({ where: { roomId, status: "pending" } });

  if (generated.length > 0) {
    await prisma.scheduleSlot.createMany({
      data: generated.map((s) => ({ ...s, roomId })),
    });
  }

  const slots = await prisma.scheduleSlot.findMany({
    where: { roomId, status: { not: "voided" } },
    orderBy: { slotIndex: "asc" },
    include: { task: true },
  });

  return Response.json(slots, { status: 201 });
}
