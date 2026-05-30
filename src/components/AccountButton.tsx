"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

interface AccountButtonProps {
  roomId: string;
  roomHeaders: Record<string, string>;
}

export function AccountButton({ roomId, roomHeaders }: AccountButtonProps) {
  const { data: session, status, update } = useSession();
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // ระหว่างโหลด session — ไม่โชว์อะไร กันกระพริบ
  if (status === "loading") return null;

  // ── ยังไม่ล็อกอิน → ปุ่ม sign in (optional, ไม่บังคับ) ──
  if (status !== "authenticated") {
    return (
      <button
        onClick={() => signIn("google")}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
          bg-zinc-800 border border-zinc-700 hover:border-zinc-500
          text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        title="ล็อกอินเพื่อใช้ห้องนี้ข้ามเครื่อง (ไม่บังคับ)"
      >
        🔓 Sign in
      </button>
    );
  }

  const accountRoom = session.user?.roomId ?? null;
  const claimed = accountRoom === roomId;

  async function claim() {
    setClaiming(true);
    await fetch("/api/room/claim", { method: "POST", headers: roomHeaders });
    await update(); // refresh session → roomId ใหม่
    setClaiming(false);
  }

  const initial = (session.user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-7 h-7 rounded-full
          bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold
          hover:bg-amber-500/30 transition-colors"
        title={session.user?.email ?? "account"}
      >
        {initial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 z-50
            bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-72 shadow-2xl">
            <p className="text-xs text-zinc-500 mb-1">ล็อกอินด้วย</p>
            <p className="text-sm text-zinc-200 truncate mb-3">{session.user?.email}</p>

            <div className="border-t border-zinc-800 pt-3 mb-3">
              {claimed ? (
                <p className="text-xs text-emerald-500">
                  ✓ ห้อง {roomId} ผูกกับบัญชีนี้แล้ว — ล็อกอินเครื่องไหนก็เจอ
                </p>
              ) : (
                <>
                  <p className="text-xs text-zinc-400 mb-2">
                    ผูกห้อง <span className="font-mono text-amber-400">{roomId}</span> เข้ากับบัญชีนี้
                    เพื่อเข้าถึงจากทุกเครื่อง
                    {accountRoom && (
                      <span className="block text-zinc-600 mt-1">
                        (จะแทนที่ห้องเดิมที่ผูกไว้: {accountRoom})
                      </span>
                    )}
                  </p>
                  <button
                    onClick={claim}
                    disabled={claiming}
                    className="w-full px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400
                      text-black text-xs font-semibold disabled:opacity-50"
                  >
                    {claiming ? "กำลังผูก..." : "🔗 ใช้ห้องนี้กับบัญชี"}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => signOut()}
              className="w-full text-xs text-zinc-400 hover:text-red-400 px-3 py-1.5 rounded-lg
                border border-zinc-800 hover:border-red-500/40 transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
