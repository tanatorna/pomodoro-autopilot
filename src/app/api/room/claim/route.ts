// POST /api/room/claim — ผูกห้องปัจจุบัน (จาก header X-Room-Id) เข้ากับบัญชีที่ล็อกอินอยู่
// ต้องล็อกอินก่อน — ถ้าไม่ → 401

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

export async function POST(request: Request) {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const roomId = getRoomId(request);
  await prisma.user.update({ where: { id: uid }, data: { roomId } });
  return Response.json({ ok: true, roomId });
}
