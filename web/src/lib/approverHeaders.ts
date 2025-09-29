// ======================================================================
// File: web/src/lib/approverHeaders.ts
// เวอร์ชัน: 25/09/2025  (ปรับปรุงความเสถียร + เคารพค่า extra + normalize email)
// หน้าที่: รวมส่วนหัว (headers) มาตรฐานสำหรับทุก API ฝั่ง Admin/Approver
//          - Authorization: Bearer <ID_TOKEN>
//          - x-api-key: จาก ENV (VITE_APPROVER_KEY)
//          - x-requester-email: จาก localStorage หรือ ENV (พิมพ์เล็ก/ตัดช่องว่าง)
// เชื่อม auth ผ่าน Firebase Web SDK (getAuth)
// หมายเหตุ: ไม่ฮาร์ดโค้ดความลับ ใช้เฉพาะ ENV/localStorage ตามแนวทางความปลอดภัย
// วันที่/เดือน/ปี เวลา (ไทย): 25/09/2025 23:59
// ======================================================================

import { getAuth } from "firebase/auth";

type HeaderMap = Record<string, string>;

const LS_EMAIL_KEYS = ["admin_requester_email", "approver_email"] as const;

/** อ่านอีเมลของผู้เรียกจาก localStorage → ตัดช่องว่าง + พิมพ์เล็ก, มี fallback เป็น ENV */
function readRequesterEmail(): string | undefined {
  try {
    for (const k of LS_EMAIL_KEYS) {
      const v = typeof localStorage !== "undefined" ? localStorage.getItem(k) : null;
      if (v && v.trim()) return v.trim().toLowerCase();
    }
  } catch {
    // บางสภาพแวดล้อมอาจห้ามใช้ localStorage; ข้ามไปใช้ ENV
  }
  const envEmail = (import.meta as any).env?.VITE_APPROVER_EMAIL as string | undefined;
  return envEmail && envEmail.trim() ? envEmail.trim().toLowerCase() : undefined;
}

/** ขอ ID Token แบบปลอดภัย: ไม่มีผู้ใช้/เกิด error → คืนสตริงว่าง */
async function getIdTokenSafe(): Promise<string> {
  try {
    const u = getAuth().currentUser;
    if (!u) return "";
    return await u.getIdToken(); // SDK จะจัดการรีเฟรชตามอายุโทเค็นอัตโนมัติ
  } catch {
    return "";
  }
}

/**
 * รวม header มาตรฐานสำหรับเรียก Cloud Run/Functions ฝั่ง Admin
 * - ไม่เขียนทับค่าใน extra (ให้ extra มีสิทธิมากกว่า)
 */
export async function getApproverHeaders(extra: HeaderMap = {}): Promise<HeaderMap> {
  const headers: HeaderMap = { ...extra };

  // 1) Authorization
  if (!headers.Authorization) {
    const idToken = await getIdTokenSafe();
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
  }

  // 2) x-api-key
  if (!headers["x-api-key"]) {
    const apiKey = (import.meta as any).env?.VITE_APPROVER_KEY as string | undefined;
    if (apiKey) headers["x-api-key"] = String(apiKey);
  }

  // 3) x-requester-email (พิมพ์เล็ก/trim แล้ว)
  if (!headers["x-requester-email"]) {
    const email = readRequesterEmail();
    if (email) headers["x-requester-email"] = email;
  }

  return headers;
}
