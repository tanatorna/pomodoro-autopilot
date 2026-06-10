import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

/** task ที่เสร็จในวันที่กำหนด (?date=YYYY-MM-DD) — ใช้ขยายดูรายละเอียดใน Stats
 *  match ด้วย Task.doneDate (วันที่ขีดฆ่า) · รวม done + archived · task เสร็จก่อนมีฟีเจอร์นี้ไม่มี doneDate → [] */
export async function GET(request: Request) {
  const roomId = getRoomId(request);
  const date = new URL(request.url).searchParams.get("date");
  if (!date) return Response.json({ error: "date is required" }, { status: 400 });

  const tasks = await prisma.task.findMany({
    where: { roomId, doneDate: date },
    select: { id: true, title: true, completedPomodoros: true, estimatedPomodoros: true },
    orderBy: { id: "asc" },
  });
  return Response.json(tasks);
}
