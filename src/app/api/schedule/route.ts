// GET  /api/schedule  — คืน schedule slots + task ที่ bind อยู่
// POST /api/schedule  — (re)generate schedule จาก tasks ปัจจุบัน

import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/engine/scheduler";

export async function GET() {
  const slots = await prisma.scheduleSlot.findMany({
    where: { status: { not: "voided" } },
    orderBy: { slotIndex: "asc" },
    include: { task: true },
  });
  return Response.json(slots);
}

export async function POST() {
  // ดึง tasks ที่ยังต้องทำ
  const tasks = await prisma.task.findMany({
    where: { status: { in: ["pending", "in-progress"] } },
  });

  // Generate slots ด้วย pure function
  const generated = generateSchedule(tasks);

  // ลบ slots เดิมที่ pending ทิ้ง (ไม่แตะ completed/voided)
  await prisma.scheduleSlot.deleteMany({ where: { status: "pending" } });

  // บันทึก slots ใหม่
  if (generated.length > 0) {
    await prisma.scheduleSlot.createMany({ data: generated });
  }

  // คืน slots ใหม่พร้อม task data
  const slots = await prisma.scheduleSlot.findMany({
    where: { status: { not: "voided" } },
    orderBy: { slotIndex: "asc" },
    include: { task: true },
  });

  return Response.json(slots, { status: 201 });
}
