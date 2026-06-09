import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";

// settings ต่อห้อง (sync ข้าม device) — เก็บบน server แทน localStorage แยกเครื่อง
const DEFAULTS = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  pomodorosPerLongBreak: 4,
};

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(max, Math.max(min, Math.round(n)))
    : fallback;

export async function GET(request: Request) {
  const roomId = getRoomId(request);
  const s = await prisma.roomSetting.findUnique({ where: { roomId } });
  return Response.json(s ?? { roomId, ...DEFAULTS });
}

export async function PATCH(request: Request) {
  const roomId = getRoomId(request);
  const body = (await request.json()) as Partial<typeof DEFAULTS>;

  // รับเฉพาะ field ที่ส่งมา + clamp ช่วงที่สมเหตุสมผล
  const data: Partial<typeof DEFAULTS> = {};
  if ("workMinutes" in body) data.workMinutes = clamp(body.workMinutes, 1, 180, DEFAULTS.workMinutes);
  if ("shortBreakMinutes" in body) data.shortBreakMinutes = clamp(body.shortBreakMinutes, 1, 60, DEFAULTS.shortBreakMinutes);
  if ("longBreakMinutes" in body) data.longBreakMinutes = clamp(body.longBreakMinutes, 1, 120, DEFAULTS.longBreakMinutes);
  if ("pomodorosPerLongBreak" in body) data.pomodorosPerLongBreak = clamp(body.pomodorosPerLongBreak, 1, 12, DEFAULTS.pomodorosPerLongBreak);

  const s = await prisma.roomSetting.upsert({
    where: { roomId },
    create: { roomId, ...DEFAULTS, ...data },
    update: data,
  });
  return Response.json(s);
}
