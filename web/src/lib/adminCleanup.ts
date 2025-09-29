// ======================================================================
// File: web/src/lib/adminCleanup.ts
// เวอร์ชัน: 2025-09-18
// หน้าที่: ตัวช่วยเรียก Cloud Functions แบบ httpsCallable (onCall) สำหรับ
//          ลบงานตาม RID และลบ Logs — ใช้ได้เฉพาะ superadmin
// เชื่อม auth ผ่าน Firebase Web SDK (โทเคนจะแนบให้อัตโนมัติเมื่อใช้ httpsCallable)
// หมายเหตุ: ฟังก์ชันฝั่งเซิร์ฟเวอร์ของโปรเจกต์นี้เป็น "onCall"
//           ดังนั้นห้ามเรียก HTTP ตรง เพราะรูปแบบ payload จะไม่ตรงและจะได้ 400
// วันที่/เวลา: 18/09/2025
// ======================================================================

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

// ใช้ region ที่ดีพลอยไว้
const functions = getFunctions(app, "asia-southeast1");

// ---------- ประเภทข้อมูลตอบกลับ ----------
export type DeleteRequestCascadeResult = {
  ok: boolean;
  rid: string;
  deleted: {
    firestore: boolean;
    storagePrefix: string;
    storageFiles: number;
  };
};

export type DeleteLogsResult = {
  ok: boolean;
  collectionPath: string;
  mode: "all" | "byRid" | "before";
  deleted: number; // จำนวนเอกสารถูกลบ
};

// ---------- ตัวช่วยเรียก onCall ----------
async function callOnCall<T>(name: string, payload: unknown): Promise<T> {
  try {
    const fn = httpsCallable(functions, name);
    const res = await fn(payload);
    return res.data as T;
  } catch (e: any) {
    // โยนข้อความอ่านง่ายกลับไปให้ UI แสดง
    const msg = e?.message || e?.code || String(e);
    throw new Error(msg);
  }
}

// ---------- ฟังก์ชันใช้งานจริง ----------
/** ลบคำขอทั้งชุดตาม RID: ลบ Firestore (รวม subcollections) + ไฟล์ใน Storage ใต้ `requests/{rid}/` */
export async function removeRequestAll(rid: string): Promise<DeleteRequestCascadeResult> {
  if (!rid?.trim()) throw new Error("กรุณาใส่ RID");
  return callOnCall<DeleteRequestCascadeResult>("deleteRequestCascade", { rid: rid.trim() });
}

/** ลบ Logs ทั้งหมด (อันตราย ใช้เฉพาะ superadmin) */
export async function removeLogsAll(): Promise<DeleteLogsResult> {
  return callOnCall<DeleteLogsResult>("deleteLogs", { mode: "all" });
}

/** ลบ Logs ที่มี field rid ตรงกับที่ระบุ */
export async function removeLogsByRid(rid: string): Promise<DeleteLogsResult> {
  if (!rid?.trim()) throw new Error("กรุณาใส่ RID");
  return callOnCall<DeleteLogsResult>("deleteLogs", { mode: "byRid", rid: rid.trim() });
}

/** ลบ Logs ที่สร้างก่อน/เท่ากับ ts (รับ millis หรือ ISO string) */
export async function removeLogsBefore(ts: number | string): Promise<DeleteLogsResult> {
  if (typeof ts !== "number" && typeof ts !== "string") {
    throw new Error("กรุณาใส่เวลาเป็นเลข millis หรือข้อความ ISO เช่น 2025-09-01T00:00:00Z");
  }
  return callOnCall<DeleteLogsResult>("deleteLogs", { mode: "before", ts });
}
