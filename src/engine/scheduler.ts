// ─────────────────────────────────────────────
// Pomodoro Scheduler — Auto-schedule Algorithm
// Pure function. Input: tasks → Output: slots
// ─────────────────────────────────────────────

export interface SchedulableTask {
  id: number;
  title: string;
  priority: number;
  estimatedPomodoros: number;
  completedPomodoros: number;
}

export interface GeneratedSlot {
  taskId: number;
  slotIndex: number; // ลำดับ slot ในวัน (0-based)
  status: "pending";
}

/**
 * generateSchedule — แจกจ่าย task เป็น Pomodoro slots
 *
 * Algorithm:
 *   1. เรียง tasks ตาม priority (สูง → ต่ำ)
 *   2. แต่ละ task มี estimatedPomodoros → สร้าง slot ตามจำนวน
 *   3. หัก completedPomodoros ที่ทำไปแล้วออก (ถ้า resume วันใหม่)
 *   4. Slot index เพิ่มขึ้น globally ทั้งวัน
 *
 * @param tasks   - tasks ที่ต้องการ schedule (status = pending/in-progress)
 * @param maxSlots - จำนวน slot สูงสุดต่อวัน (default 16 = 8 ชั่วโมง)
 */
export function generateSchedule(
  tasks: SchedulableTask[],
  maxSlots = 16
): GeneratedSlot[] {
  // เรียงตาม priority สูงสุดก่อน ถ้าเท่ากันเรียงตาม id (first-in)
  const sorted = [...tasks].sort((a, b) =>
    b.priority !== a.priority ? b.priority - a.priority : a.id - b.id
  );

  const slots: GeneratedSlot[] = [];
  let slotIndex = 0;

  for (const task of sorted) {
    if (slotIndex >= maxSlots) break;

    // slot ที่เหลือ = estimated - completed
    const remaining = Math.max(0, task.estimatedPomodoros - task.completedPomodoros);

    for (let i = 0; i < remaining; i++) {
      if (slotIndex >= maxSlots) break;
      slots.push({ taskId: task.id, slotIndex, status: "pending" });
      slotIndex++;
    }
  }

  return slots;
}
