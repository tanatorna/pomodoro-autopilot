"use client";

import { useEffect, useRef, useState } from "react";

interface RoomBadgeProps {
  roomId: string;
  /** เข้าห้องอื่นที่มีอยู่แล้ว (พิมพ์ code) */
  onChangeRoom: (code: string) => void;
  /** สร้างห้องใหม่ (สุ่ม code) */
  onCreateRoom: () => void;
  /** เปลี่ยนรหัสห้องปัจจุบัน → ย้ายข้อมูล */
  onRenameRoom: (code: string) => Promise<{ ok: boolean; reason?: string }>;
  /** เช็คว่า code มีคนใช้แล้วไหม */
  onCheckRoom: (code: string) => Promise<boolean>;
  /** ลบห้องปัจจุบันทิ้ง → ไปห้องเปล่าใหม่ */
  onDeleteRoom: () => Promise<void>;
}

type RenameState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "invalid" }
  | { kind: "saving" };

export function RoomBadge({
  roomId,
  onChangeRoom,
  onCreateRoom,
  onRenameRoom,
  onCheckRoom,
  onDeleteRoom,
}: RoomBadgeProps) {
  const [open, setOpen] = useState(false);
  const [joinInput, setJoinInput] = useState("");

  // ── delete current room (2-step confirm) ──
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── rename current room ──
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [renameState, setRenameState] = useState<RenameState>({ kind: "idle" });
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopyLink() {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinInput.trim()) return;
    onChangeRoom(joinInput.trim());
  }

  function startRename() {
    setRenaming(true);
    setRenameInput(roomId);
    setRenameState({ kind: "idle" });
  }

  // เช็ค code ซ้ำแบบ debounce ระหว่างพิมพ์
  function onRenameChange(raw: string) {
    const code = raw.toUpperCase().trim();
    setRenameInput(code);
    if (checkTimer.current) clearTimeout(checkTimer.current);

    if (code === roomId) return setRenameState({ kind: "idle" });
    if (!/^[A-Z0-9]{3,16}$/.test(code)) return setRenameState({ kind: "invalid" });

    setRenameState({ kind: "checking" });
    checkTimer.current = setTimeout(async () => {
      const taken = await onCheckRoom(code);
      setRenameState((prev) =>
        prev.kind === "checking" ? { kind: taken ? "taken" : "available" } : prev
      );
    }, 400);
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    const code = renameInput.toUpperCase().trim();
    if (code === roomId || !/^[A-Z0-9]{3,16}$/.test(code)) return;
    if (renameState.kind === "taken") return;
    setRenameState({ kind: "saving" });
    const res = await onRenameRoom(code);
    if (!res.ok) {
      setRenameState({ kind: res.reason === "taken" ? "taken" : "invalid" });
    }
  }

  useEffect(() => {
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, []);

  if (!roomId) return null;

  return (
    <div className="relative flex items-center gap-2">
      {/* Room badge */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
          bg-card border border-border hover:border-[var(--border-strong)]
          text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        title="จัดการห้อง"
      >
        <span className="text-[var(--faint)]">🔑</span>
        <span className="tracking-widest text-[var(--ink-soft)]">{roomId}</span>
        <span className="text-[var(--faint)]">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setJoinInput("");
              setRenaming(false);
              setConfirmingDelete(false);
            }}
          />

          <div
            className="absolute top-full right-0 mt-2 z-50 paper-panel pm-pop
              border border-border rounded-2xl p-4 w-80"
            style={{ boxShadow: "0 14px 40px rgba(120,80,40,0.16)" }}
          >
            {/* ── ห้องปัจจุบัน ── */}
            <p className="text-xs font-semibold text-[var(--ink-soft)] mb-1">ห้องปัจจุบัน</p>

            {!renaming ? (
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 text-sm font-mono text-primary bg-card px-3 py-1.5 rounded-lg border border-border">
                  {roomId}
                </code>
                <button
                  onClick={startRename}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg
                    bg-card border border-border hover:border-[var(--border-strong)]"
                  title="เปลี่ยนรหัสห้อง (ย้ายข้อมูลตามไปด้วย)"
                >
                  ✎ แก้รหัส
                </button>
                <button
                  onClick={handleCopyLink}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg
                    bg-card border border-border hover:border-[var(--border-strong)] whitespace-nowrap"
                  title="copy invite link"
                >
                  📋
                </button>
              </div>
            ) : (
              <form onSubmit={submitRename} className="mb-2">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={renameInput}
                    onChange={(e) => onRenameChange(e.target.value)}
                    placeholder="รหัสห้องใหม่"
                    maxLength={16}
                    className="flex-1 min-w-0 text-sm font-mono bg-card border rounded-lg px-3 py-1.5
                      text-foreground placeholder:text-[var(--faint)] focus:outline-none uppercase
                      border-border focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={
                      renameState.kind === "taken" ||
                      renameState.kind === "invalid" ||
                      renameState.kind === "checking" ||
                      renameState.kind === "saving" ||
                      renameInput.toUpperCase().trim() === roomId
                    }
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-[var(--accent-hover)]
                      text-primary-foreground text-xs font-semibold disabled:opacity-40"
                  >
                    {renameState.kind === "saving" ? "..." : "บันทึก"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(false)}
                    className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                  >
                    ยกเลิก
                  </button>
                </div>
                {/* สถานะเช็คซ้ำ */}
                <p className="text-xs mt-1.5 h-4">
                  {renameState.kind === "checking" && (
                    <span className="text-muted-foreground">กำลังเช็ค...</span>
                  )}
                  {renameState.kind === "available" && (
                    <span style={{ color: "var(--success)" }}>✓ ใช้รหัสนี้ได้</span>
                  )}
                  {renameState.kind === "taken" && (
                    <span style={{ color: "var(--danger)" }}>✗ รหัสนี้มีคนใช้แล้ว</span>
                  )}
                  {renameState.kind === "invalid" && (
                    <span style={{ color: "var(--danger)" }}>ใช้ A–Z, 0–9 ความยาว 3–16 ตัว</span>
                  )}
                </p>
              </form>
            )}

            {/* ── สร้างห้องใหม่ ── */}
            <button
              onClick={onCreateRoom}
              className="w-full mb-3 text-xs text-[var(--ink-soft)] hover:text-foreground px-3 py-2 rounded-lg
                bg-card border border-dashed border-[var(--border-strong)] hover:border-primary/60
                hover:bg-secondary transition-colors"
              title="เปิดห้องว่างใหม่ (สุ่มรหัสให้)"
            >
              + สร้างห้องใหม่
            </button>

            {/* ── เข้าห้องอื่น ── */}
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2">
                เข้าห้องอื่นที่มีอยู่แล้ว — ใส่ code แล้วกดเข้า
              </p>
              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="CODE ห้อง..."
                  maxLength={16}
                  className="flex-1 text-sm font-mono bg-card border border-border
                    rounded-lg px-3 py-1.5 text-foreground placeholder:text-[var(--faint)]
                    focus:outline-none focus:border-primary uppercase"
                />
                <button
                  type="submit"
                  disabled={!joinInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted border border-border
                    text-foreground text-xs font-semibold disabled:opacity-40"
                >
                  เข้า
                </button>
              </form>
              <p className="text-xs text-[var(--faint)] mt-2">
                ไม่มี code? ให้เพื่อน copy link ด้านบนมาให้
              </p>
            </div>

            {/* ── ลบห้องนี้ (danger zone) ── */}
            <div className="border-t border-border mt-3 pt-3">
              {!confirmingDelete ? (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full text-xs text-muted-foreground px-3 py-2 rounded-lg
                    border border-border transition-colors hover:text-[var(--danger)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  🗑 ลบห้องนี้
                </button>
              ) : (
                <div
                  className="rounded-lg p-3"
                  style={{ border: "1px solid var(--border-active)", background: "var(--danger-bg, rgba(182,69,46,0.08))" }}
                >
                  <p className="text-xs mb-1 font-semibold" style={{ color: "var(--danger)" }}>
                    ลบห้อง {roomId} ถาวร?
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    task / schedule / timer ทั้งหมดในห้องนี้จะหายและ<strong>กู้คืนไม่ได้</strong>
                    {" "}· ถ้าแชร์ห้องนี้กับคนอื่น จะกระทบทุกคน · ลบเสร็จจะไปห้องเปล่าใหม่
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setDeleting(true);
                        await onDeleteRoom();
                      }}
                      disabled={deleting}
                      className="flex-1 px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-50 hover:opacity-90"
                      style={{ background: "var(--danger)" }}
                    >
                      {deleting ? "กำลังลบ..." : "ยืนยันลบถาวร"}
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting}
                      className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground
                        bg-card border border-border"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
