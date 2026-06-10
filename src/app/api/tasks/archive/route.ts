import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { INITIAL_STATE } from "@/engine/types";
import { timerStateToDb } from "@/lib/sessionMapper";

/** เก็บ task ที่ "เสร็จแล้ว" (done) เข้าคลัง (status → archived) → ซ่อนจาก Schedule แต่เก็บใน DB
 *  ไม่แตะสถิติ: ยอดรายวัน derive จาก Task.doneDate (stamp ตอนขีดฆ่า) ไม่ใช่ตอน archive
 *  resetSession=true (auto จบวันเที่ยงคืน): รีเซ็ต timer เป็น IDLE · task ค้างคงเป็น pending → ยกมาวันใหม่ */
export async function POST(request: Request) {
  const roomId = getRoomId(request);
  const body = (await request.json().catch(() => ({}))) as { resetSession?: boolean };

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

  return Response.json({ archived: result.count });
}
