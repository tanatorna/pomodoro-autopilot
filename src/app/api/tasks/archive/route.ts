import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { INITIAL_STATE } from "@/engine/types";
import { timerStateToDb } from "@/lib/sessionMapper";

/** เก็บ task ที่ "เสร็จแล้ว" (done) เข้าคลัง (status → archived)
 *  - ซ่อนจาก Schedule แต่ยังอยู่ใน DB (updatedAt = เวลาที่เก็บ → เป็น raw data ทำ stat รายวันทีหลังได้)
 *  - resetSession=true (ใช้ตอน auto จบวันเที่ยงคืน): รีเซ็ต timer เป็น IDLE ด้วย · task ค้างคงเป็น pending → ยกมาวันใหม่ */
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
