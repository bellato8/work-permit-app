// functions/src/lib/emitAudit.ts
// Append-only audit logger (ใช้ร่วมทุกฟังก์ชัน)
// เขียนลงคอลเลกชัน: auditLogs
// หมายเหตุ: Firestore ไม่รับค่า `undefined` ในเอกสาร
//           โค้ดนี้ตั้งค่า ignoreUndefinedProperties และตัดค่า undefined ออกเสมอ

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";

/** เริ่มต้น Admin SDK หนึ่งครั้ง */
if (!getApps().length) initializeApp();

/** Firestore client (Admin) + เปิด ignoreUndefinedProperties เพื่อกัน error runtime) */
const db: Firestore = getFirestore();
// ตัวเลือกนี้ทำให้ field ที่เป็น undefined ถูกข้ามไป ไม่ถูกเขียนขึ้นฐาน
// (หากไม่เปิด ตัว SDK จะ throw error เมื่อเจอค่า undefined)
db.settings({ ignoreUndefinedProperties: true });

/** รูปแบบผู้กระทำ (actor) */
export type AuditActor =
  | { email?: string; name?: string; role?: string; [k: string]: any }
  | string
  | undefined;

/** รูปแบบเป้าหมาย (target) */
export type AuditTarget =
  | { type?: string; id?: string; rid?: string; [k: string]: any }
  | string
  | undefined;

/** ลบค่าที่เป็น undefined ออกจากออบเจ็กต์/อาเรย์แบบลึก */
function pruneUndefinedDeep<T = any>(input: T): T {
  if (input === undefined) return undefined as any;
  if (input === null) return input;
  if (Array.isArray(input)) {
    return input
      .map((v) => pruneUndefinedDeep(v))
      .filter((v) => v !== undefined) as any;
  }
  if (typeof input === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input as any)) {
      if (v === undefined) continue;
      const vv = pruneUndefinedDeep(v);
      if (vv !== undefined) out[k] = vv;
    }
    return out as any;
  }
  return input;
}

/**
 * บันทึกเหตุการณ์สำคัญแบบ append-only
 * @param action  ชื่อเหตุการณ์ เช่น "status_update_approved"
 * @param by      ผู้กระทำ (อ็อบเจ็กต์ หรือสตริง "unknown")
 * @param target  เป้าหมาย เช่น { type:"request", rid }
 * @param note    หมายเหตุสั้น ๆ
 * @param extra   ข้อมูลเสริมใด ๆ (ip, ua, method, from, to, ฯลฯ)
 * @returns id ของเอกสารที่เพิ่ม
 */
export async function emitAudit(
  action: string,
  by?: AuditActor,
  target?: AuditTarget,
  note?: string,
  extra?: Record<string, any>
): Promise<string> {
  // ทำความสะอาดค่า actor/target/extra กัน field ที่เป็น undefined
  const byClean =
    typeof by === "string" ? by : by ? pruneUndefinedDeep(by) : "unknown";
  const targetClean =
    typeof target === "string" ? target : target ? pruneUndefinedDeep(target) : undefined;
  const extraClean = extra ? pruneUndefinedDeep(extra) : undefined;

  const payload: Record<string, any> = pruneUndefinedDeep({
    action: action || "-",
    at: FieldValue.serverTimestamp(),
    by: byClean,           // หากเป็น object จะถูก prune แล้ว
    target: targetClean,   // undefined จะไม่ถูกเขียน
    note: note ?? undefined,
    extra: extraClean,     // undefined ข้างในถูกตัดออกแล้ว
  });

  const ref = await db.collection("auditLogs").add(payload);
  return ref.id;
}
