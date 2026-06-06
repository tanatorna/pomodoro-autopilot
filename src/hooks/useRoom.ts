"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "pomodoro-room-id";

/** สร้าง ID แบบ 8 ตัวอักษร A-Z0-9 */
function generatePersonalId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ตัด I, O, 0, 1 ออกเพื่อไม่สับสน
  return Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/** ถ้า user ล็อกอินอยู่ → ผูกห้อง code นี้เข้ากับบัญชี (anonymous จะได้ 401 ไม่เป็นไร)
 *  เรียกตอนเปลี่ยนห้องทุกครั้ง เพื่อให้บัญชีตามห้องปัจจุบัน ไม่โดน effect ดึงกลับ */
async function syncAccountRoom(code: string): Promise<void> {
  try {
    await fetch("/api/room/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Room-Id": code },
    });
  } catch {
    /* network error / anonymous — ข้ามได้ */
  }
}

export function useRoom() {
  const [roomId, setRoomIdState] = useState<string>("");

  useEffect(() => {
    // 1. ตรวจ URL param ?room=XXXX ก่อน
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get("room")?.toUpperCase().trim();

    if (urlRoom) {
      // มี room ใน URL → ใช้เลย + บันทึกลง localStorage
      localStorage.setItem(STORAGE_KEY, urlRoom);
      setRoomIdState(urlRoom);
      // ลบ ?room= ออกจาก URL (clean URL) · แต่คง ?debug=1 ไว้ (สำหรับ debug overlay)
      const newUrl = window.location.pathname + (urlParams.get("debug") === "1" ? "?debug=1" : "");
      window.history.replaceState({}, "", newUrl);
      return;
    }

    // 2. ตรวจ localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setRoomIdState(saved);
      return;
    }

    // 3. ไม่มีทั้งคู่ → สร้าง personal ID ใหม่
    const newId = generatePersonalId();
    localStorage.setItem(STORAGE_KEY, newId);
    setRoomIdState(newId);
  }, []);

  const setRoom = useCallback(async (code: string) => {
    const normalized = code.toUpperCase().trim();
    await syncAccountRoom(normalized); // ถ้า login อยู่ บัญชีตามไปห้องนี้
    localStorage.setItem(STORAGE_KEY, normalized);
    setRoomIdState(normalized);
    // reload เพื่อ sync ข้อมูลใหม่
    window.location.reload();
  }, []);

  /** สร้างห้องใหม่ (สุ่ม code ใหม่ ว่างเปล่า) */
  const createRoom = useCallback(async () => {
    const id = generatePersonalId();
    await syncAccountRoom(id);
    localStorage.setItem(STORAGE_KEY, id);
    setRoomIdState(id);
    window.location.reload();
  }, []);

  /** เช็คว่า code มีข้อมูลอยู่แล้วไหม (ใช้เตือน "ซ้ำ" ตอนพิมพ์) */
  const checkRoom = useCallback(async (rawCode: string): Promise<boolean> => {
    const code = rawCode.toUpperCase().trim();
    if (!/^[A-Z0-9]{3,16}$/.test(code)) return false;
    const res = await fetch(`/api/room?check=${encodeURIComponent(code)}`);
    if (!res.ok) return false;
    return ((await res.json()) as { exists?: boolean }).exists === true;
  }, []);

  /** headers ที่ใส่ใน fetch ทุกครั้ง
   *  useMemo สำคัญ: คืน object เดิมตราบใดที่ roomId ไม่เปลี่ยน
   *  ไม่งั้นทุก render จะได้ object ใหม่ → useEffect/useCallback ที่ depend
   *  อยู่ rerun ไม่จบ → infinite fetch loop */
  const roomHeaders: Record<string, string> = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(roomId && { "X-Room-Id": roomId }),
    }),
    [roomId]
  );

  /** เปลี่ยนรหัสห้องปัจจุบัน → code ใหม่ (ย้ายข้อมูลให้ที่ backend) */
  const renameRoom = useCallback(
    async (rawCode: string): Promise<{ ok: boolean; reason?: string }> => {
      const to = rawCode.toUpperCase().trim();
      if (!/^[A-Z0-9]{3,16}$/.test(to)) return { ok: false, reason: "invalid" };
      if (to === roomId) return { ok: false, reason: "same" };
      const res = await fetch("/api/room", {
        method: "POST",
        headers: roomHeaders,
        body: JSON.stringify({ to }),
      });
      if (res.status === 409) return { ok: false, reason: "taken" };
      if (!res.ok) return { ok: false, reason: "error" };
      localStorage.setItem(STORAGE_KEY, to);
      window.location.reload();
      return { ok: true };
    },
    [roomId, roomHeaders]
  );

  /** ลบห้องปัจจุบันทิ้ง → แล้วเด้งไปห้องเปล่าใหม่ (ไม่กลับห้องเก่า) */
  const deleteRoom = useCallback(async () => {
    await fetch("/api/room", { method: "DELETE", headers: roomHeaders });
    const id = generatePersonalId();
    await syncAccountRoom(id); // บัญชีย้ายมาห้องเปล่าใหม่
    localStorage.setItem(STORAGE_KEY, id);
    setRoomIdState(id);
    window.location.reload();
  }, [roomHeaders]);

  return { roomId, setRoom, createRoom, renameRoom, checkRoom, deleteRoom, roomHeaders };
}
