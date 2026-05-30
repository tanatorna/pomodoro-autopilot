// ─────────────────────────────────────────────
// Sound — Web Audio API (ไม่ต้องมีไฟล์เสียง)
// สร้างเสียง beep จาก oscillator โดยตรง
// ─────────────────────────────────────────────

/**
 * เล่นเสียง beep แจ้งเตือน
 * @param type "work" = เสียง 2 ครั้งความถี่สูง (หมดเวลางาน)
 *             "break" = เสียง 1 ครั้งความถี่ต่ำ (หมดเวลา break)
 */
export function playAlarm(type: "work" | "break" = "work") {
  if (typeof window === "undefined") return;

  try {
    const ctx = new AudioContext();

    if (type === "work") {
      // 2 beep ความถี่สูง → "หยุดทำงานได้แล้ว"
      playBeep(ctx, 880, 0.0, 0.15);
      playBeep(ctx, 880, 0.2, 0.15);
    } else {
      // 3 beep ความถี่กลาง → "กลับมาทำงานได้แล้ว"
      playBeep(ctx, 660, 0.0, 0.12);
      playBeep(ctx, 660, 0.15, 0.12);
      playBeep(ctx, 880, 0.3, 0.2);
    }

    // ปิด AudioContext หลังเสียงหมด
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Safari / browser ที่ block AudioContext ก่อน user gesture → silent fail
  }
}

function playBeep(
  ctx: AudioContext,
  frequency: number,
  startOffset: number,
  duration: number
) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  const startTime = ctx.currentTime + startOffset;
  gainNode.gain.setValueAtTime(0.4, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}
