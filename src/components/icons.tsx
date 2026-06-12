/** icon เส้นแบบ monochrome (stroke = currentColor) — ใช้แทนอิโมจิสีเต็ม (📥 🗑)
 *  เพื่อให้รับสี faint/hover ชุดเดียวกับปุ่ม glyph อื่น (✔ ▲ ▼ ✎) */

function base(props: { size?: number }) {
  return {
    width: props.size ?? 13,
    height: props.size ?? 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

/** ถังขยะ (ลบ task) */
export function TrashIcon({ size }: { size?: number }) {
  return (
    <svg {...base({ size })}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

/** กล่องเก็บ + ลูกศรลง (ย้ายไป Backlog) */
export function ToBacklogIcon({ size }: { size?: number }) {
  return (
    <svg {...base({ size })}>
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M12 11v6" />
      <path d="m9 14 3 3 3-3" />
    </svg>
  );
}
