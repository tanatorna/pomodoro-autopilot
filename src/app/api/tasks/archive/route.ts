import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { INITIAL_STATE } from "@/engine/types";
import { timerStateToDb } from "@/lib/sessionMapper";

/** เก็บ task ที่ "เสร็จแล้ว" (done) เข้าคลัง (status → archived) + บันทึกสถิติของวันที่ปิด
 *  - snapshot ยอดวัน (DaySummary) ก่อน archive → ตัวเลขแม่นแม้ auto-midnight มาทำวันถัดไป
 *    (date = วันที่ "ถูกปิด" ส่งมาจาก client ไม่ใช่เวลา archive)
 *  - upsert แบบ increment → ปิดวันเดียวกันหลายครั้ง (เคลียร์หลายรอบ) ยอดสะสมรวมกัน
 *  - resetSession=true (auto จบวันเที่ยงคืน): รีเซ็ต timer เป็น IDLE · task ค้างคงเป็น pending → ยกมาวันใหม่ */
export async function POST(request: Request) {
  const roomId = getRoomId(request);
  const body = (await request.json().catch(() => ({}))) as {
    resetSession?: boolean;
    date?: string; // YYYY-MM-DD (local) วันที่กำลังปิด
  };

  // นับยอดของ task ที่เสร็จ(done) ก่อน archive → ใช้ทำ snapshot รายวัน
  const doneTasks = await prisma.task.findMany({
    where: { roomId, status: "done" },
    select: { completedPomodoros: true },
  });
  const tasksDone = doneTasks.length;
  const totalPomodoros = doneTasks.reduce((s, t) => s + t.completedPomodoros, 0);

  // บันทึก DaySummary เฉพาะเมื่อมี task ปิดจริง + มีวันที่ส่งมา
  if (tasksDone > 0 && body.date) {
    await prisma.daySummary.upsert({
      where: { roomId_date: { roomId, date: body.date } },
      create: { roomId, date: body.date, totalPomodoros, tasksDone },
      update: {
        totalPomodoros: { increment: totalPomodoros },
        tasksDone: { increment: tasksDone },
      },
    });
  }

  const result = await prisma.task.updateMany({
    where: { roomId, status: "done" },
    data: { status: "archived" },
  });

  if (body.resetSession) {
    const session = await prisma.session.findFirst({
      where: { roomId },
      orderBy: { createdAt: "desc" },
    });
    if (session) {
      await prisma.session.update({
        where: { id: session.id },
        data: timerStateToDb({ ...INITIAL_STATE }),
      });
    }
  }

  return Response.json({ archived: result.count, totalPomodoros, tasksDone });
}
