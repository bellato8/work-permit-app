// ======================================================================
// File: web/src/lib/request.ts
// เวอร์ชัน: 2025-09-18
// หน้าที่: รวมตัวช่วยเกี่ยวกับ "คำขอทำงาน" และตัวช่วย "ยิง HTTP แบบแนบโทเคน"
// เชื่อม auth ผ่าน "อะแดปเตอร์" ที่เราสร้างไว้: ./firebase
// หมายเหตุ:
//  - เก็บฟังก์ชันสร้างรหัสคำขอ (RID), บันทึกคำขอลง Firestore
//  - เพิ่มตัวช่วยเรียก HTTP พร้อมแนบโทเคนผู้ใช้ (แก้ปัญหา 403 ได้จากฝั่งเว็บ)
// วันที่/เวลา: 18/09/2025
// ======================================================================

import { app, db } from "./firebase"; // ต้องมี export app และ db ในไฟล์ firebase
import { getAuth } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { customAlphabet } from "nanoid";

// ----------------------------------------------------------------------
// สร้างรหัสคำขอ (RID) รูปแบบ <PREFIX>-YYYYMMDD-XXXXXX
// ของเดิมใช้ 'REQ' อยู่แล้ว เพื่อให้ยืดหยุ่นเลยเปิดให้เปลี่ยน prefix ได้
// ----------------------------------------------------------------------
const nanoRid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

/** สร้างรหัสคำขอใหม่ เช่น REQ-20250918-ABC123 */
export function newRequestId(prefix: string = "REQ") {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${ymd}-${nanoRid()}`;
}

// ----------------------------------------------------------------------
// โครงสร้างข้อมูลคำขอ (เหมือนไฟล์เดิม แต่คอมเมนต์ให้ชัดขึ้น)
// ----------------------------------------------------------------------
export type RequestPayload = {
  company: string;
  contactName: string;
  contactPhone: string;
  workPurpose: string;
  location: string;
  floor: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalWorkers: number;
  images?: string[]; // เก็บเป็นลิงก์ไฟล์จริงภายหลัง
};

// ----------------------------------------------------------------------
// บันทึกคำขอใหม่ลง Firestore (เหมือนเดิมเป๊ะ เพิ่มคอมเมนต์ให้เข้าใจง่าย)
// ----------------------------------------------------------------------
export async function createRequest(data: RequestPayload) {
  const requestId = newRequestId("REQ");
  await setDoc(doc(db, "requests", requestId), {
    requestId,
    status: "PENDING",
    createdAt: serverTimestamp(),
    ...data,
  });
  return requestId;
}

// ======================================================================
// ส่วนเพิ่มใหม่: ตัวช่วยยิง HTTP พร้อมแนบโทเคน (ใช้ซ้ำได้ทั้งโปรเจกต์)
// ใช้เมื่อต้องคุยกับ Cloud Functions/บริการที่ต้องยืนยันตัวตน
// ======================================================================

/** ดึงโทเคนผู้ใช้ปัจจุบัน (บังคับรีเฟรชเพื่อให้ได้สิทธิ์ล่าสุด) */
async function getIdToken(forceRefresh = true): Promise<string> {
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user) throw new Error("ยังไม่ได้ล็อกอิน");
  return await user.getIdToken(forceRefresh);
}

/** POST แบบแนบโทเคนอัตโนมัติ คืนค่า JSON (หรือ {} ถ้าไม่มีเนื้อหา) */
export async function postAuth<T = unknown>(url: string, body?: any): Promise<T> {
  const token = await getIdToken(true);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  if (!res.ok) {
    // โยนข้อความผิดพลาดให้อ่านง่าย (ช่วยดีบัก 403/401 ได้)
    throw new Error(`${res.status} ${res.statusText} :: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

/** GET แบบแนบโทเคนอัตโนมัติ */
export async function getAuthJson<T = unknown>(url: string): Promise<T> {
  const token = await getIdToken(false);
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} :: ${text}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

/** ยูทิลเล็กๆ สำหรับเช็คว่าเป็นรูปแบบ RID ที่เราคุ้นหรือไม่ (ใช้ในฟอร์มหรือ validate ง่ายๆ) */
export function looksLikeRid(value: string) {
  return /^(REQ|WP)-\d{8}-[A-Z2-9]{4,}$/i.test((value || "").trim());
}
