import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

/** สถิติยอดรายวัน — derive จาก Task.doneDate (วันที่ขีดฆ่า = เสร็จจริง)
 *  รวมทั้ง task ที่ done (ยังอยู่ใน Schedule) + archived (เก็บเข้าคลังแล้ว) · ใหม่สุดก่อน · 60 วันล่าสุด */
export async function GET(request: Request) {
  const roomId = getRoomId(request);
  const rows = await prisma.task.groupBy({
    by: ["doneDate"],
    where: { roomId, doneDate: { not: null } },
    _sum: { completedPomodoros: true },
    _count: { _all: true },
    orderBy: { doneDate: "desc" },
    take: 60,
  });
  const days = rows.map((r) => ({
    date: r.doneDate as string,
    totalPomodoros: r._sum.completedPomodoros ?? 0,
    tasksDone: r._count._all,
  }));
  return Response.json(days);
}
