// web/src/lib/logs.ts
// ใช้ ID Token แนบใน Authorization: Bearer … สำหรับเรียก API (ไม่ใช้ x-api-key แล้ว)

import { getAuth, getIdToken } from "firebase/auth";

const LIST_LOGS_URL = (import.meta.env.VITE_LIST_LOGS_URL as string) || "";
const LOG_AUTH_URL  = (import.meta.env.VITE_LOG_AUTH_URL as string) || "";

/** อีเมลผู้ใช้ปัจจุบัน (fallback ไป .env เฉพาะช่วยระบุตัวผู้สั่ง) */
export function getRequesterEmail(): string {
  const u = getAuth().currentUser;
  return (u?.email || (import.meta.env.VITE_APPROVER_EMAIL as string) || "").trim();
}

/** สร้าง Header พร้อม ID Token; forceRefresh=true ใช้ตอนรีทรายเมื่อ 401 */
export async function authzHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const idToken = await getIdToken(user, forceRefresh);
  const h: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };
  const requester = getRequesterEmail();
  if (requester) h["x-requester-email"] = requester;
  return h;
}

/** เติม query string แบบข้ามค่าที่ว่าง */
function withQuery(
  baseUrl: string,
  params: Record<string, string | number | undefined | null>
) {
  const u = new URL(baseUrl);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

/** ดึงรายการ logs (GET) — รีทราย 1 ครั้งเมื่อ 401 */
export async function listLogs(params: {
  q?: string; action?: string; from?: string; to?: string; limit?: number;
  orderBy?: string; orderDir?: "asc" | "desc";
} = {}): Promise<any[]> {
  if (!LIST_LOGS_URL) throw new Error("ยังไม่ได้ตั้งค่า VITE_LIST_LOGS_URL");

  const url = withQuery(LIST_LOGS_URL, {
    ...params,
    requester: getRequesterEmail() || undefined,
  });

  // ครั้งที่ 1: ใช้โทเคนปัจจุบัน
  let res = await fetch(url, { method: "GET", headers: await authzHeaders(false), mode: "cors" });
  let text = await res.text();

  // ถ้าเจอ 401 → ขอออกโทเคนใหม่แล้วลองอีกครั้ง
  if (res.status === 401) {
    res = await fetch(url, { method: "GET", headers: await authzHeaders(true), mode: "cors" });
    text = await res.text();
  }

  if (res.status === 401) throw new Error("401 Unauthorized — กรุณาเข้าสู่ระบบใหม่");
  if (res.status === 403) throw new Error("403 Forbidden — ยังไม่มีสิทธิ์เรียกดู audit log");

  let json: any = {};
  try { json = JSON.parse(text); } catch {}
  return (
    (Array.isArray(json?.data?.items) && json.data.items) ||
    (Array.isArray(json?.items) && json.items) ||
    (Array.isArray(json) && json) ||
    []
  );
}

/** บันทึกเหตุการณ์ auth (POST) — login/logout/manual — รีทราย 1 ครั้งเมื่อ 401 */
export async function logAuth(payload: {
  action: "login" | "logout" | "manual";
  email: string;
  name?: string;
  rid?: string;
  note?: string;
}): Promise<{ ok: boolean; id?: string }> {
  if (!LOG_AUTH_URL) throw new Error("ยังไม่ได้ตั้งค่า VITE_LOG_AUTH_URL");

  const body = JSON.stringify({
    action: payload.action,
    email: payload.email,
    name: payload.name ?? "",
    rid: payload.rid ?? "",
    note: payload.note ?? "",
  });

  // ครั้งที่ 1
  let res = await fetch(LOG_AUTH_URL, {
    method: "POST",
    headers: { ...(await authzHeaders(false)), "Content-Type": "application/json" },
    body, mode: "cors",
  });
  let text = await res.text();

  // ถ้า 401 → รีเฟรชโทเคนแล้วลองใหม่
  if (res.status === 401) {
    res = await fetch(LOG_AUTH_URL, {
      method: "POST",
      headers: { ...(await authzHeaders(true)), "Content-Type": "application/json" },
      body, mode: "cors",
    });
    text = await res.text();
  }

  if (res.status === 401) throw new Error("401 Unauthorized — กรุณาเข้าสู่ระบบใหม่");
  if (res.status === 403) throw new Error("403 Forbidden — ไม่มีสิทธิ์บันทึก log");

  try { return JSON.parse(text); } catch { return { ok: false }; }
}
