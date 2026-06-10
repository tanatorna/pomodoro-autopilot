import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

/** สถิติยอดรายวันของห้อง — ใหม่สุดก่อน · จำกัด 60 วันล่าสุด (พอสำหรับ dashboard) */
export async function GET(request: Request) {
  const roomId = getRoomId(request);
  const days = await prisma.daySummary.findMany({
    where: { roomId },
    orderBy: { date: "desc" },
    take: 60,
  });
  return Response.json(days);
}
