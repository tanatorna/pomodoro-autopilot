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

  if (status === "loading") return null;

  // ── ยังไม่ล็อกอิน → ปุ่ม sign in (optional) ──
  if (status !== "authenticated") {
    return (
      <button
        onClick={() => signIn("google")}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
          bg-card border border-border hover:border-[var(--border-strong)]
          text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="ล็อกอินเพื่อใช้ห้องนี้ข้ามเครื่อง (ไม่บังคับ)"
      >
        Sign in
      </button>
    );
  }

  const accountRoom = session.user?.roomId ?? null;
  const claimed = accountRoom === roomId;

  async function claim() {
    setClaiming(true);
    await fetch("/api/room/claim", { method: "POST", headers: roomHeaders });
    await update();
    setClaiming(false);
  }

  const initial = (session.user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-7 h-7 rounded-full
          text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg, #d99a5f, #c15f3c)" }}
        title={session.user?.email ?? "account"}
      >
        {initial}
      </button>

      {open && (
        <>
          {/* scrim — frost ทั้งจอบางๆ (3px) ให้พื้นหลังนุ่มลงนิด แต่ยังเห็นชัด */}
          <div
            className="fixed inset-0 z-40 bg-black/[0.04]"
            style={{ backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute top-full right-0 mt-2 z-50 pm-pop
              border border-border rounded-2xl p-4 w-72"
            style={{
              // glass แท้ แต่อ่านง่าย: opacity 0.78 + blur 32px + พื้นหน้า frost แล้ว
              background: "rgba(255, 252, 246, 0.78)",
              backdropFilter: "blur(32px) saturate(150%)",
              WebkitBackdropFilter: "blur(32px) saturate(150%)",
              boxShadow: "0 14px 40px rgba(120,80,40,0.2)",
            }}
          >
            <p className="text-xs text-muted-foreground mb-1">ล็อกอินด้วย</p>
            <p className="text-sm text-foreground truncate mb-3">{session.user?.email}</p>

            <div className="border-t border-border pt-3 mb-3">
              {claimed ? (
                <p className="text-xs" style={{ color: "var(--success)" }}>
                  ✓ ห้อง {roomId} ผูกกับบัญชีนี้แล้ว — ล็อกอินเครื่องไหนก็เจอ
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    ผูกห้อง <span className="font-mono text-primary">{roomId}</span> เข้ากับบัญชีนี้
                    เพื่อเข้าถึงจากทุกเครื่อง
                    {accountRoom && (
                      <span className="block text-[var(--faint)] mt-1">
                        (จะแทนที่ห้องเดิมที่ผูกไว้: {accountRoom})
                      </span>
                    )}
                  </p>
                  <button
                    onClick={claim}
                    disabled={claiming}
                    className="w-full px-3 py-1.5 rounded-lg bg-primary hover:bg-[var(--accent-hover)]
                      text-primary-foreground text-xs font-semibold disabled:opacity-50"
                  >
                    {claiming ? "กำลังผูก..." : "🔗 ใช้ห้องนี้กับบัญชี"}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => signOut()}
              className="w-full text-xs text-muted-foreground hover:text-[var(--danger)] px-3 py-1.5 rounded-lg
                border border-border transition-colors"
            >
              ↪ ออกจากระบบ
            </button>
          </div>
        </>
      )}
    </div>
  );
}
