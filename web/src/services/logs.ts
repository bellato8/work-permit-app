// ======================================================================
// File: web/src/services/logs.ts
// เวอร์ชัน: 2025-09-21 23:59
// หน้าที่: Helper สำหรับดึง/เขียน System Logs จากฝั่งเว็บให้ไฟล์อื่น ๆ เรียกใช้
// เชื่อม auth ผ่าน "อะแดปเตอร์": ./lib/auth (ถ้าเกี่ยวข้อง)
// หมายเหตุ:
//  - คงฟังก์ชันเดิม: fetchLogs(), logAuth()  • ไม่เปลี่ยนพฤติกรรมการเรียก/พารามิเตอร์
//  - เพิ่มชนิดข้อมูลเวลาแบบ Firestore (seconds/nanoseconds) และรองรับ atMillis (ms)
//  - คำศัพท์อังกฤษ: Timestamp (ไทม์-สแตมป์ = จุดเวลา), normalize (นอ-มะ-ไลซ์ = ทำมาตรฐาน)
// วันที่/เวลาแก้ล่าสุด: 21-09-2568 23:59
// ======================================================================

/** เวลาแบบ Firestore (seconds + nanoseconds) — อิงเอกสาร Firestore Timestamp. */
export type FirestoreTs = {
  /** วินาทีตั้งแต่ epoch (UTC) — seconds */
  seconds?: number;        // SDK client ปกติใช้ 'seconds'
  nanoseconds?: number;    // SDK client ปกติใช้ 'nanoseconds'
  /** บางไลบรารี/เอ็กซ์พอร์ต JSON จะเป็น _seconds/_nanoseconds */
  _seconds?: number;
  _nanoseconds?: number;
};

/** โครงสร้าง Log ขั้นต่ำที่เราเจอบ่อย (เปิดกว้างด้วย index signature) */
export type AuditLog = {
  id?: string;
  at?: FirestoreTs | string | number | Date;
  atMillis?: number;
  by?: { email?: string; name?: string; uid?: string; role?: string; ip?: string } | string | null;
  action?: string;
  target?: any;
  note?: string;
  ip?: string;
  ua?: string;
  method?: string;
  raw?: any;
  // ฟิลด์รุ่นเก่า (สำรอง)
  email?: string;
  adminEmail?: string;
  [k: string]: any;
};

// ---- ค่าคงที่จาก .env ----
const LIST_LOGS_URL = import.meta.env.VITE_LIST_LOGS_URL as string;
const LOG_AUTH_URL  = import.meta.env.VITE_LOG_AUTH_URL  as string; // อาจมี ?key=... ติดมาแล้ว
const APPROVER_KEY  = import.meta.env.VITE_APPROVER_KEY  as string;
const REQUESTER_FALLBACK = (import.meta.env.VITE_APPROVER_EMAIL as string) || "";

/** ดึงรายการ Logs */
export async function fetchLogs(opts: {
  requester?: string;   // อีเมลผู้เรียก (จะส่งเป็น header x-requester-email)
  q?: string;           // คำค้นง่าย ๆ (action/by/target/note/ip/ua)
  action?: string;      // filter action ตรงตัว (เช่น "login")
  from?: string;        // ISO date/time
  to?: string;          // ISO date/time
  limit?: number;       // เริ่มต้น 300 สูงสุด 1000
} = {}): Promise<AuditLog[]> {
  if (!LIST_LOGS_URL) throw new Error("VITE_LIST_LOGS_URL is not set");

  const {
    requester = REQUESTER_FALLBACK,
    q = "",
    action = "",
    from = "",
    to = "",
    limit = 300,
  } = opts;

  // แนบทั้ง query (สำรอง) และ header (หลัก)
  const u = new URL(LIST_LOGS_URL);
  if (APPROVER_KEY) u.searchParams.set("key", APPROVER_KEY);
  if (q)       u.searchParams.set("q", q);
  if (action)  u.searchParams.set("action", action);
  if (from)    u.searchParams.set("from", from);
  if (to)      u.searchParams.set("to", to);
  if (limit)   u.searchParams.set("limit", String(limit));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (APPROVER_KEY) headers["x-api-key"] = APPROVER_KEY;       // รูปแบบ header แบบคีย์ (เอ็กซ์-เอพีไอ-คีย์)
  if (requester)    headers["x-requester-email"] = requester;  // ผู้เรียก (requester)

  const res = await fetch(u.toString(), { method: "GET", headers, mode: "cors" });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* เผื่อปลายทางส่ง text/plain มา */ }

  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `listLogs: HTTP ${res.status}`);
  }
  // โครงสร้างตอบกลับมาตรฐาน: { ok:true, data:{ items:[...], count:N } }
  return Array.isArray(json?.data?.items) ? (json.data.items as AuditLog[])
       : Array.isArray(json) ? (json as AuditLog[])
       : [];
}

/** บันทึก Log ตอน login/logout ฯลฯ */
export async function logAuth(payload: {
  action: "login" | "logout" | "manual";
  requester: string;  // คนกดทำรายการ (อีเมล)
  email: string;      // อีเมลของบัญชี
  name?: string;      // ชื่อ (ปล่อย "" ได้ แต่ห้าม undefined)
  rid?: string;       // อ้างอิง (เช่น "RID-AUTO-LOGIN")
  ip?: string;        // ถ้ามี
  note?: string;      // เพิ่มเติม
}) {
  if (!LOG_AUTH_URL) throw new Error("VITE_LOG_AUTH_URL is not set");

  const u = new URL(LOG_AUTH_URL);
  // กันกรณี LOG_AUTH_URL ไม่ได้ติด ?key= มาใน .env
  if (!u.searchParams.get("key") && APPROVER_KEY) {
    u.searchParams.set("key", APPROVER_KEY);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (APPROVER_KEY) headers["x-api-key"] = APPROVER_KEY;
  if (payload.requester) headers["x-requester-email"] = payload.requester;

  const body = {
    action: payload.action,
    requester: payload.requester,
    email: payload.email,
    name: payload.name ?? "",
    rid: payload.rid ?? "",
    ip: payload.ip ?? "",
    note: payload.note ?? "",
  };

  const res = await fetch(u.toString(), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `logAuth: HTTP ${res.status}`);
  }
  return true;
}
