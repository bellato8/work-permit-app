// ============================================================
// ไฟล์: functions/src/admin.ts
// ผู้เขียน (Written by):Sutthirak.w
// เวลา/เวอร์ชัน: 2025-08-23 16:10 (รวมศูนย์ initializeApp ให้เรียกครั้งเดียว)
// หน้าที่ไฟล์: Bootstrap Firebase Admin SDK หนึ่งครั้ง แล้ว export db/storage ให้ไฟล์อื่นใช้
// คำศัพท์: initializeApp [อินนิไช-อะ-ไลซ์ แอป] = คำสั่งเริ่มต้นแอปแอดมิน, Singleton [ซิงเกิลตัน] = มีแค่ตัวเดียว
// ============================================================

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// ป้องกันเรียก initializeApp ซ้ำ (ถ้ามีแอปอยู่แล้วจะไม่เรียกซ้ำ)
if (!getApps().length) {
  initializeApp();
}

// Export ตัวใช้งานร่วม
export const db = getFirestore();
export const storage = getStorage();
