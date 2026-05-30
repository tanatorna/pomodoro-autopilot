// GET  /api/room?check=CODE  — เช็คว่า code นั้น "มีข้อมูลอยู่แล้ว" หรือยัง → { exists }
// POST /api/room  { to: "CODE" } — เปลี่ยนรหัสห้องปัจจุบัน (จาก header X-Room-Id) เป็น CODE
//   ย้ายข้อมูลทุกตารางจากห้องเดิม → ห้องใหม่ (กันชนถ้าปลายทางมีข้อมูลแล้ว)

import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

const CODE_RE = /^[A-Z0-9]{3,16}$/;

/** ห้องนี้มีข้อมูลอยู่ไหม (task / session / slot อย่างน้อย 1 แถว) */
async function roomHasData(roomId: string): Promise<boolean> {
  const [tasks, sessions, slots] = await Promise.all([
    prisma.task.count({ where: { roomId } }),
    prisma.session.count({ where: { roomId } }),
    prisma.scheduleSlot.count({ where: { roomId } }),
  ]);
  return tasks + sessions + slots > 0;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("check") || "").toUpperCase().trim();
  if (!CODE_RE.test(code)) {
    return Response.json({ error: "invalid", exists: false }, { status: 400 });
  }
  return Response.json({ exists: await roomHasData(code) });
}

export async function POST(request: Request) {
  const from = getRoomId(request);
  const body = (await request.json()) as { to?: string };
  const to = (body.to || "").toUpperCase().trim();

  if (!CODE_RE.test(to)) {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  if (to === from) {
    return Response.json({ ok: true }); // ไม่มีอะไรต้องเปลี่ยน
  }
  if (await roomHasData(to)) {
    return Response.json({ error: "taken" }, { status: 409 });
  }

  // ย้ายทุกตารางจากห้องเดิม → ห้องใหม่ แบบ atomic
  await prisma.$transaction([
    prisma.task.updateMany({ where: { roomId: from }, data: { roomId: to } }),
    prisma.session.updateMany({ where: { roomId: from }, data: { roomId: to } }),
    prisma.scheduleSlot.updateMany({ where: { roomId: from }, data: { roomId: to } }),
  ]);

  return Response.json({ ok: true });
}
