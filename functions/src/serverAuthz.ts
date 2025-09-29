/* ============================================================================
 * ไฟล์: functions/src/serverAuthz.ts
 * เวอร์ชัน: 2025-09-17
 * บทบาทไฟล์ (role): ตัวช่วยตรวจสิทธิฝั่งเซิร์ฟเวอร์สำหรับฟังก์ชันแอดมิน (Users)
 * เปลี่ยนแปลงรอบนี้:
 *   • เพิ่มฟังก์ชันรวมศูนย์เพื่อตรวจสิทธิ manage_users ก่อนทำงาน
 *   • เพิ่มตัวช่วยลบค่า undefined ออกจากอ็อบเจกต์ก่อนเขียน Firestore (sanitize)
 *   • รวม util อ่าน header/query/ip/ua ให้ทุกฟังก์ชันเรียกเหมือนกัน
 * คำสำคัญ (English → Thai/phonetic/meaning):
 *   • Authorization (ออ-ธอ-ไร-เซ-ชั่น) = กระบวนการตรวจสิทธิ์อนุญาต (n.)
 *   • Header (เฮด-เดอร์) = ส่วนข้อมูลหัวของ HTTP request/response (n.)
 *   • Permission (เพอ-มิช-ชั่น) = สิทธิ์ย่อย เช่น manage_users (n.)
 *   • Role (โรล) = บทบาท เช่น superadmin/admin/... (n.)
 *   • Sanitize (แซน-นิ-ไทซ์) = ทำข้อมูลให้ถูกฟอร์แมต/ปลอดภัยก่อนบันทึก (v.)
 *   • CORS (คอร์ส) = กติกาเรียกข้ามโดเมน (n.)
 * หมายเหตุความปลอดภัย: อย่าฝัง secret ในโค้ด ให้ดึงจาก ENV/Secret Manager เสมอ
 * ผู้เขียน: AI ผู้ช่วย (โหมดจับมือทำ)
 * ========================================================================== */

import * as admin from "firebase-admin";

// ---------- ชนิดข้อมูลเบื้องต้น ----------
export type AdminDoc = {
  email?: string;
  emailLower?: string;
  role?: string;
  enabled?: boolean;
  caps?: Record<string, any>;
  [k: string]: any;
};

// ---------- ตัวช่วยอ่าน/แปลงค่าจาก request ----------
export function readKey(req: any): string {
  return String(
    req.get?.("x-api-key") ||
      req.get?.("x-approver-key") ||
      req.query?.key ||
      req.body?.key ||
      ""
  ).trim();
}

export function readRequester(req: any): string {
  const v = String(
    req.get?.("x-requester-email") || req.query?.requester || req.body?.requester || ""
  ).trim();
  return v.toLowerCase();
}

export function ipOf(req: any): string | undefined {
  const x = String(req?.headers?.["x-forwarded-for"] || "");
  return (x.split(",")[0] || req?.socket?.remoteAddress || "").trim() || undefined;
}

export function uaOf(req: any): string | undefined {
  return String(req?.headers?.["user-agent"] || "") || undefined;
}

export function originOf(req: any): string | undefined {
  return String(req?.headers?.origin || req?.headers?.referer || "") || undefined;
}

export function emailKey(email: string): string {
  return (email || "").trim().toLowerCase();
}

// ---------- sanitize: ตัด undefined ทิ้ง (รองรับซ้อนหลายชั้น) ----------
export function omitUndefined<T = any>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    // @ts-ignore
    return obj.map((v) => omitUndefined(v)) as any;
  }
  if (typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      if (v === undefined) continue;
      out[k] = omitUndefined(v as any);
    }
    return out as T;
  }
  return obj;
}

// ---------- โหลดข้อมูล admin จาก Firestore ----------
export async function loadAdminByEmailLower(emailLower: string): Promise<AdminDoc | null> {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const id = emailKey(emailLower);
  if (!id) return null;

  const snap = await db.collection("admins").doc(id).get();
  if (!snap.exists) return null;

  const data = (snap.data() || {}) as AdminDoc;
  // normalize
  const role = String((data.role || "")).toLowerCase();
  return {
    ...data,
    emailLower: id,
    role,
    enabled: typeof data.enabled === "boolean" ? data.enabled : true,
    caps: data.caps || {},
  };
}

// ---------- ตรวจสิทธิ manage_users ----------
export function hasManageUsers(a: AdminDoc | null | undefined): boolean {
  if (!a) return false;
  const role = String(a.role || "").toLowerCase();
  if (role === "superadmin") return true;

  const caps = (a.caps || {}) as Record<string, any>;
  // รองรับทั้งคีย์เดิม/ใหม่
  return !!(caps.manageUsers === true || caps.manage_users === true);
}

/**
 * ใช้ในฟังก์ชัน onRequest ช่วงต้น
 * ผ่านแล้วคืน AdminDoc ของ requester; ไม่ผ่านจะตอบ 403 และคืน null
 */
export async function requireManageUsers(req: any, res: any): Promise<AdminDoc | null> {
  const requester = readRequester(req);
  if (!requester) {
    res.status(403).json({ ok: false, error: "forbidden: missing requester" });
    return null;
  }
  const a = await loadAdminByEmailLower(requester);
  if (!a || a.enabled === false) {
    res.status(403).json({ ok: false, error: "forbidden: requester disabled or not found" });
    return null;
  }
  if (!hasManageUsers(a)) {
    res.status(403).json({ ok: false, error: "forbidden: need manage_users" });
    return null;
  }
  return a;
}

// ---------- ช่วยตอบ CORS ขั้นพื้นฐาน (ถ้ายังไม่ได้ใช้ middleware อื่น) ----------
const ALLOW_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "https://staging.imperialworld.asia",
  "https://imperialworld.asia",
]);

export function applyCors(req: any, res: any) {
  const origin = originOf(req);
  if (origin && ALLOW_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, x-api-key, x-requester-email");
  res.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.set("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true; // จบที่ preflight
  }
  return false;
}

// ---------- ตัวช่วยตอบ JSON มาตรฐาน ----------
export function jsonOK(res: any, data: any = {}) {
  res.json({ ok: true, ...data });
}
export function jsonErr(res: any, status: number, message: string, extra?: any) {
  res.status(status).json({ ok: false, error: message, ...(extra || {}) });
}
