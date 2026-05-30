/**
 * อ่าน roomId จาก X-Room-Id header
 * ถ้าไม่มี header → fallback เป็น "default"
 */
export function getRoomId(request: Request): string {
  return request.headers.get("X-Room-Id") ?? "default";
}
