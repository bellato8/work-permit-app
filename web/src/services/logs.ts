// ======================================================================
// File: web/src/services/logs.ts  (Adapter → ใช้ของใหม่ใน web/src/lib/logs.ts)
// เวอร์ชัน: 06/10/2025
// หน้าที่: คง API เดิม (fetchLogs, logAuth) แต่ภายในเรียก lib/logs.ts (ID Token, รีทราย 401)
// หมายเหตุ: ไม่ใช้ x-api-key อีกต่อไป
// ======================================================================

/** เวลาแบบ Firestore (seconds + nanoseconds) */
export type FirestoreTs = {
  seconds?: number; nanoseconds?: number;
  _seconds?: number; _nanoseconds?: number;
};

/** โครงสร้าง Log ขั้นต่ำ (เปิดกว้าง) */
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

// 👉 ใช้ของใหม่จาก lib/logs.ts (แนบ ID Token + รีทรายเมื่อ 401)
import { listLogs as _listLogs, logAuth as _logAuth, getRequesterEmail } from "../lib/logs";

/** ดึงรายการ Logs (คงซิกเนเจอร์เดิม) */
export async function fetchLogs(opts: {
  requester?: string;   // อีเมลผู้เรียก (จะส่งต่อเพื่ออ้างอิงในผลลัพธ์เท่านั้น)
  q?: string;
  action?: string;
  from?: string;        // ISO
  to?: string;          // ISO
  limit?: number;       // เริ่มต้น 300
} = {}): Promise<AuditLog[]> {
  const {
    requester = getRequesterEmail(),
    q, action, from, to, limit = 300,
  } = opts;

  const items = await _listLogs({
    q, action, from, to, limit,
    orderBy: "at",
    orderDir: "desc",
  });

  // ส่งต่อ requester เป็นข้อมูลเสริม (ไม่บังคับ)
  return items.map((x: any) => ({ ...x, requester }));
}

/** บันทึก Log ตอน login/logout/manual (คงซิกเนเจอร์เดิม) */
export async function logAuth(payload: {
  action: "login" | "logout" | "manual";
  requester: string;  // คนกดทำรายการ (จะไม่ใช้ยืนยันตัวตน แค่ส่งต่อเป็นข้อมูล)
  email: string;      // อีเมลของบัญชีที่เกี่ยวข้อง
  name?: string;
  rid?: string;
  ip?: string;        // ไม่จำเป็น: ปลายทางอ่านจาก X-Forwarded-For เอง
  note?: string;
}): Promise<boolean> {
  await _logAuth({
    action: payload.action,
    email: payload.email,
    name: payload.name,
    rid: payload.rid,
    note: payload.note,
  });
  return true;
}
