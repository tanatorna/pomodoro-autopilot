// ─────────────────────────────────────────────
// Sound — Web Audio API (ไม่ต้องมีไฟล์เสียง)
// Pattern: marimba do-mi-sol (C5-E5-G5) ทำซ้ำ 2 รอบ, warm + ไม่น่าตกใจ
//   • triangle wave + soft attack/release → เนื้อไม้
//   • Compressor → ดังโดยไม่ clip
//   • pause ~0.15s ระหว่างรอบให้รู้ว่าเป็น 2 รอบ
//   • total ~1.66s
// ─────────────────────────────────────────────

export function playAlarm(type: "work" | "break" = "work") {
  void type; // ใช้ pattern เดียวกันทั้ง work/break
  if (typeof window === "undefined") return;

  try {
    const ctx = new AudioContext();

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

    // ปิด context หลังเสียงหมด
    setTimeout(() => {
      if (ctx.state !== "closed") void ctx.close();
    }, 2200);
  } catch {
    // Safari / browser ที่ block AudioContext ก่อน user gesture → silent fail
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
