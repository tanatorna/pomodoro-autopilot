// ─────────────────────────────────────────────
// Sound — Web Audio API (ไม่ต้องมีไฟล์เสียง)
// Pattern: marimba do-mi-sol (C5-E5-G5) ทำซ้ำ 2 รอบ, warm + ไม่น่าตกใจ
//
// มือถือ (iOS/Android) บล็อก AudioContext ที่สร้าง/เล่นนอก user gesture →
// ถ้าสร้าง context ใหม่ตอน timer หมด (ไม่ใช่ gesture) เสียงจะ "เงียบ"
// แก้: ใช้ context เดียว (singleton) ปลดล็อคตอนกดเริ่ม (primeAudio) แล้ว reuse +
// resume() ก่อนเล่นทุกครั้ง → alarm ดังจริงแม้ trigger จาก timer/visibility
// ─────────────────────────────────────────────

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

/**
 * ปลดล็อคเสียง — ต้องเรียก "ระหว่าง user gesture" (เช่นตอนกดปุ่มเริ่ม/resume)
 * สร้าง context + resume + เล่น blip เงียบๆ เพื่อให้ iOS ปลดล็อก
 * หลังจากนี้ playAlarm จะส่งเสียงได้แม้ trigger จาก timer ที่ไม่ใช่ gesture
 */
export function primeAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume();
  try {
    // silent blip — ช่วยปลดล็อก audio pipeline บน iOS
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  } catch {
    /* ignore */
  }
}

/**
 * เล่นเสียง alarm — marimba do-mi-sol × 2 รอบ
 * reuse shared context + resume() เผื่อถูก suspend ตอน background → ดังบนมือถือ
 */
export function playAlarm(type: "work" | "break" = "work") {
  void type; // ใช้ pattern เดียวกันทั้ง work/break
  const ctx = getCtx();
  if (!ctx) return;

  try {
    void ctx.resume(); // เผื่อ context ถูก suspend (background/มือถือ)

    // compressor + master gain → ดันให้ดังโดยไม่ clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    const master = ctx.createGain();
    master.gain.value = 1.0;
    comp.connect(master).connect(ctx.destination);

    // C5, E5, G5 — do-mi-sol pentatonic warm
    const notes = [523.25, 659.25, 783.99];
    const noteGap = 0.18;
    const roundGap = 0.9; // pattern 1 รอบใช้เวลา ~0.76s + pause ~0.15s
    const rounds = 2;

    for (let r = 0; r < rounds; r++) {
      const base = r * roundGap;
      notes.forEach((f, i) => {
        playNote(ctx, comp, f, base + i * noteGap);
      });
    }
    // ไม่ปิด ctx — reuse ครั้งถัดไป (ปิดแล้วต้องปลดล็อกใหม่ด้วย gesture บนมือถือ)
  } catch {
    // browser ที่ block AudioContext → silent fail
  }
}

/** marimba note — triangle wave, soft attack/release */
function playNote(ctx: AudioContext, dest: AudioNode, freq: number, startOffset: number) {
  const startTime = ctx.currentTime + startOffset;
  const DURATION = 0.4;
  const ATTACK = 0.005;
  const RELEASE = 0.35;
  const PEAK = 0.7;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  osc.connect(gain).connect(dest);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(PEAK, startTime + ATTACK);
  gain.gain.setValueAtTime(PEAK, startTime + DURATION - RELEASE);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + DURATION);

  osc.start(startTime);
  osc.stop(startTime + DURATION + 0.02);
}
