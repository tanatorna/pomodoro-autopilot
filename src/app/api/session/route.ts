import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { dbToTimerState, timerStateToDb } from "@/lib/sessionMapper";
import { start, pause, resume, restart, tick, type DurationConfig } from "@/engine/transitions";
import { DURATIONS, INITIAL_STATE, type TimerState } from "@/engine/types";

/** void current pending slot (ลูกที่กำลังทำ) — ใช้กับ switch/skip */
async function voidCurrentSlot(roomId: string) {
  const slot = await prisma.scheduleSlot.findFirst({
    where: { roomId, status: "pending" },
    orderBy: { slotIndex: "asc" },
  });
  if (slot) {
    await prisma.scheduleSlot.update({
      where: { id: slot.id },
      data: { status: "voided" },
    });
  }
}

/** สร้าง state WORK ใหม่ผูกกับ taskId (ใช้ตอน switch / skip) */
function workWith(current: TimerState, nowMs: number, taskId: number | null, custom?: Partial<DurationConfig>): TimerState {
  const workMs = custom?.WORK ?? DURATIONS.WORK;
  return {
    state: "WORK",
    endsAt: nowMs + workMs,
    remainingMs: null,
    origin: null,
    completedPomodoros: current.completedPomodoros,
    currentTaskId: taskId,
  };
}

async function getOrCreateSession(roomId: string) {
  const existing = await prisma.session.findFirst({
    where: { roomId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return prisma.session.create({ data: { roomId, ...timerStateToDb(INITIAL_STATE) } });
}

export async function GET(request: Request) {
  const roomId = getRoomId(request);
  const session = await getOrCreateSession(roomId);
  // ส่ง serverNow ด้วย → client คำนวณ clock offset (กัน timer ค้างจากนาฬิกาเหลื่อม)
  return Response.json({ ...dbToTimerState(session), serverNow: Date.now() });
}

type SessionAction =
  | { action: "start"; taskId?: number; durations?: Partial<DurationConfig> }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "restart"; durations?: Partial<DurationConfig> }
  | { action: "expire"; durations?: Partial<DurationConfig> }
  | { action: "switch"; taskId: number; durations?: Partial<DurationConfig> }
  | { action: "skip"; durations?: Partial<DurationConfig> }
  | { action: "finishEarly"; durations?: Partial<DurationConfig> };

export async function POST(request: Request) {
  const roomId = getRoomId(request);
  const body = (await request.json()) as SessionAction;
  const nowMs = Date.now();

  const session = await getOrCreateSession(roomId);
  const current = dbToTimerState(session);

  let next = current;
  switch (body.action) {
    case "start":
      next = start(current, nowMs, body.taskId ?? null, body.durations);
      break;
    case "pause":
      next = pause(current, nowMs);
      break;
    case "resume":
      next = resume(current, nowMs);
      break;
    case "restart":
      next = restart(current, nowMs, body.durations);
      break;
    case "expire": {
      // จำ state ก่อน tick — ใช้ดูว่าเพิ่งจบลูก WORK ของ task อะไร
      const wasWork = current.state === "WORK";
      const wasBreak =
        current.state === "SHORT_BREAK" || current.state === "LONG_BREAK";
      const finishedTaskId = current.currentTaskId;
      // client เรียก expire = ฝั่ง client เห็นว่าหมดเวลาแล้ว · ถ้านาฬิกา server ช้ากว่านิด
      // (clock skew) tick ปกติจะคืน state เดิม → client reconcile ย้อนกลับ → "ค้าง"
      // แก้: clamp เวลาเป็นอย่างน้อย endsAt → server ขยับเสมอเมื่อ client บอกหมด (ทนทานทุกเวอร์ชัน client)
      const effectiveNow =
        current.endsAt != null ? Math.max(nowMs, current.endsAt) : nowMs;
      next = tick(current, effectiveNow, body.durations);

      // ถ้า WORK เพิ่งจบจริง (เปลี่ยน state ไป BREAK) → นับ pomodoro ของ task + ปิด slot
      if (wasWork && next.state !== "WORK" && finishedTaskId !== null) {
        // mark slot ที่กำลังทำเป็น "completed" (slot แรกที่ pending ของ task นี้)
        const slot = await prisma.scheduleSlot.findFirst({
          where: { roomId, status: "pending", taskId: finishedTaskId },
          orderBy: { slotIndex: "asc" },
        });
        if (slot) {
          await prisma.scheduleSlot.update({
            where: { id: slot.id },
            data: { status: "completed" },
          });
        }

        // เพิ่ม Task.completedPomodoros + ถ้าครบ estimated → status = done
        const task = await prisma.task.findFirst({
          where: { id: finishedTaskId, roomId },
        });
        let taskBecameDone = false;
        if (task) {
          const nextCompleted = task.completedPomodoros + 1;
          taskBecameDone = nextCompleted >= task.estimatedPomodoros;
          await prisma.task.update({
            where: { id: task.id },
            data: {
              completedPomodoros: nextCompleted,
              status: taskBecameDone ? "done" : task.status,
            },
          });
        }

        // ถ้า task นี้เพิ่ง done และไม่มี task เหลือในคิว → ไป IDLE เลย (อย่าเข้า break ลอยๆ
        // บน task ที่ขีดฆ่าแล้ว — ไม่งั้น timer ยัง "กำลังทำ" task ที่เสร็จ + กดเริ่มต่อได้)
        if (taskBecameDone) {
          const remaining = await prisma.task.count({
            where: { roomId, status: { in: ["pending", "in-progress"] } },
          });
          if (remaining === 0) {
            next = { ...INITIAL_STATE, completedPomodoros: next.completedPomodoros };
          }
        }
      }

      // ถ้า BREAK เพิ่งจบ → เริ่ม WORK ลูกใหม่
      // engine carry currentTaskId เดิมมา (ถูกสำหรับ task หลายลูก) แต่ถ้า task นั้น
      // "done" แล้ว (ครบ estimated) ต้องเลื่อนไป task ถัดไปในคิว — ไม่งั้น timer ค้างที่ task ที่ขีดฆ่าแล้ว
      if (wasBreak && next.state === "WORK") {
        const stillTask =
          next.currentTaskId != null
            ? await prisma.task.findFirst({
                where: { id: next.currentTaskId, roomId },
              })
            : null;

        // task ปัจจุบันยังทำต่อได้ก็เมื่อ "ยังไม่ done"
        if (!stillTask || stillTask.status === "done") {
          const nextTask = await prisma.task.findFirst({
            where: { roomId, status: { in: ["pending", "in-progress"] } },
            orderBy: [{ priority: "desc" }, { id: "asc" }],
          });
          if (nextTask) {
            next = { ...next, currentTaskId: nextTask.id };
          } else {
            // หมดคิว → กลับ IDLE (อย่าเริ่ม WORK ลอยๆ บน task ที่ขีดฆ่า)
            next = { ...INITIAL_STATE, completedPomodoros: next.completedPomodoros };
          }
        }
      }
      break;
    }
    case "switch": {
      // เปลี่ยน task ที่กำลังทำ → void ลูกปัจจุบัน + start WORK ใหม่กับ taskId
      await voidCurrentSlot(roomId);
      next = workWith(current, nowMs, body.taskId, body.durations);
      break;
    }
    case "skip": {
      // ข้าม task ปัจจุบัน → void ลูกที่กำลังทำค้างอยู่ (ไม่นับ) + ไป task ถัดไป
      // ลูกที่ทำเสร็จแล้วเก็บไว้ (ไม่ reset) → กลับมาทำต่อทีหลังได้
      await voidCurrentSlot(roomId);
      const nextTask = await prisma.task.findFirst({
        where: {
          roomId,
          status: { in: ["pending", "in-progress"] },
          ...(current.currentTaskId != null ? { id: { not: current.currentTaskId } } : {}),
        },
        orderBy: [{ priority: "desc" }, { id: "asc" }],
      });
      if (nextTask) {
        next = workWith(current, nowMs, nextTask.id, body.durations);
      } else {
        next = { ...INITIAL_STATE, completedPomodoros: current.completedPomodoros };
      }
      break;
    }
    case "finishEarly": {
      // จบ task ปัจจุบันก่อนเวลา — ลูกที่กำลังทำนับเป็นของ task นี้เต็มลูก (credit ให้ A)
      // นาฬิกานับต่อ (ไม่รีเซ็ต) · ดึง task ถัดไปมาทำในเวลาที่เหลือ แต่ลูกนี้ "ไม่นับให้ task ใหม่"
      // (currentTaskId = null → ตอนกริ่งดัง expire จะไม่ credit ใคร → พัก → task ใหม่เริ่มนับลูกของตัวเอง)
      if (current.currentTaskId != null) {
        const task = await prisma.task.findFirst({
          where: { id: current.currentTaskId, roomId },
        });
        if (task) {
          // ปิด slot ที่กำลังทำ (ของ task นี้) + นับลูกนี้ให้ task → done
          const slot = await prisma.scheduleSlot.findFirst({
            where: { roomId, status: "pending", taskId: task.id },
            orderBy: { slotIndex: "asc" },
          });
          if (slot) {
            await prisma.scheduleSlot.update({ where: { id: slot.id }, data: { status: "completed" } });
          }
          await prisma.task.update({
            where: { id: task.id },
            data: { completedPomodoros: task.completedPomodoros + 1, status: "done" },
          });
        }
      }

      // มี task เหลือ → ทำต่อในเวลาที่เหลือ (currentTaskId = null = "ต่อเวลา" ลูกนี้ไม่นับให้ใคร)
      // ไม่มี task เหลือ → จบ (IDLE)
      const remaining = await prisma.task.count({
        where: {
          roomId,
          status: { in: ["pending", "in-progress"] },
          ...(current.currentTaskId != null ? { id: { not: current.currentTaskId } } : {}),
        },
      });
      if (remaining > 0 && current.state === "WORK") {
        next = { ...current, currentTaskId: null }; // คงนาฬิกาเดิม ทำงานต่อ
      } else {
        next = { ...INITIAL_STATE, completedPomodoros: current.completedPomodoros };
      }
      break;
    }
    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: timerStateToDb(next),
  });

  return Response.json({ ...dbToTimerState(updated), serverNow: Date.now() });
}
