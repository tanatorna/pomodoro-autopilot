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
}: RoomBadgeProps) {
  const [open, setOpen] = useState(false);
  const [joinInput, setJoinInput] = useState("");

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
      // กันกรณีผู้ใช้พิมพ์ต่อจนค่าเปลี่ยน
      setRenameState((prev) =>
        prev.kind === "checking"
          ? { kind: taken ? "taken" : "available" }
          : prev
      );
    }, 400);
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    const code = renameInput.toUpperCase().trim();
    if (code === roomId || !/^[A-Z0-9]{3,16}$/.test(code)) return;
    if (renameState.kind === "taken") return;
    setRenameState({ kind: "saving" });
    const res = await onRenameRoom(code); // สำเร็จ → reload เอง
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
          bg-zinc-800 border border-zinc-700 hover:border-zinc-500
          text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        title="จัดการห้อง"
      >
        <span className="text-zinc-600">🔑</span>
        <span className="tracking-widest">{roomId}</span>
        <span className="text-zinc-600">✎</span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setJoinInput("");
              setRenaming(false);
            }}
          />

          {/* Panel */}
          <div className="absolute top-full right-0 mt-2 z-50
            bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-80 shadow-2xl">

            {/* ── ห้องปัจจุบัน ── */}
            <p className="text-xs font-semibold text-zinc-300 mb-1">ห้องปัจจุบัน</p>

            {!renaming ? (
              <div className="flex items-center gap-2 mb-2">
                <code className="flex-1 text-sm font-mono text-amber-400 bg-zinc-800 px-3 py-1.5 rounded-lg">
                  {roomId}
                </code>
                <button
                  onClick={startRename}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1.5 rounded-lg
                    bg-zinc-800 border border-zinc-700 hover:border-zinc-500"
                  title="เปลี่ยนรหัสห้อง (ย้ายข้อมูลตามไปด้วย)"
                >
                  ✎ แก้รหัส
                </button>
                <button
                  onClick={handleCopyLink}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1.5 rounded-lg
                    bg-zinc-800 border border-zinc-700 hover:border-zinc-500 whitespace-nowrap"
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
                    className="flex-1 min-w-0 text-sm font-mono bg-zinc-800 border rounded-lg px-3 py-1.5
                      text-zinc-100 placeholder:text-zinc-600 focus:outline-none uppercase
                      border-zinc-700 focus:border-amber-500"
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
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400
                      text-black text-xs font-semibold disabled:opacity-40"
                  >
                    {renameState.kind === "saving" ? "..." : "บันทึก"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming(false)}
                    className="px-2 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    ยกเลิก
                  </button>
                </div>
                {/* สถานะเช็คซ้ำ */}
                <p className="text-xs mt-1.5 h-4">
                  {renameState.kind === "checking" && (
                    <span className="text-zinc-500">กำลังเช็ค...</span>
                  )}
                  {renameState.kind === "available" && (
                    <span className="text-emerald-500">✓ ใช้รหัสนี้ได้</span>
                  )}
                  {renameState.kind === "taken" && (
                    <span className="text-red-400">✗ รหัสนี้มีคนใช้แล้ว</span>
                  )}
                  {renameState.kind === "invalid" && (
                    <span className="text-red-400">ใช้ A–Z, 0–9 ความยาว 3–16 ตัว</span>
                  )}
                </p>
              </form>
            )}

            {/* ── สร้างห้องใหม่ ── */}
            <button
              onClick={onCreateRoom}
              className="w-full mb-3 text-xs text-zinc-300 hover:text-white px-3 py-2 rounded-lg
                bg-zinc-800/60 border border-dashed border-zinc-600 hover:border-amber-500/60
                hover:bg-zinc-800 transition-colors"
              title="เปิดห้องว่างใหม่ (สุ่มรหัสให้)"
            >
              + สร้างห้องใหม่
            </button>

            {/* ── เข้าห้องอื่น ── */}
            <div className="border-t border-zinc-800 pt-3">
              <p className="text-xs text-zinc-500 mb-2">
                เข้าห้องอื่นที่มีอยู่แล้ว — ใส่ code แล้วกดเข้า
              </p>
              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="CODE ห้อง..."
                  maxLength={16}
                  className="flex-1 text-sm font-mono bg-zinc-800 border border-zinc-700
                    rounded-lg px-3 py-1.5 text-zinc-100 placeholder:text-zinc-600
                    focus:outline-none focus:border-amber-500 uppercase"
                />
                <button
                  type="submit"
                  disabled={!joinInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600
                    text-zinc-100 text-xs font-semibold disabled:opacity-40"
                >
                  เข้า
                </button>
              </form>
              <p className="text-xs text-zinc-600 mt-2">
                ไม่มี code? ให้เพื่อน copy link ด้านบนมาให้
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
