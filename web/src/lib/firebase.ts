// ======================================================================
// src/lib/firebase.ts
// รวมของจำเป็นให้ไฟล์เดิม import จากที่เดียว (ไม่ไปยุ่งไฟล์ตั้งค่าหลัก)
// - app, auth, storage มาจาก src/auth.ts (จุด init กลางของโปรเจ็กต์)
// - db = Firestore สำหรับฝั่งหน้า public/form (ฝั่ง Admin ยังห้ามอ่านตรง)
// - ตัวช่วย:
//     • authReady(timeoutMs?): รอให้ระบบ “รู้ว่าเราเป็นใคร” หนึ่งครั้งแบบมีเวลารอสูงสุด
//     • ensureSignedIn(): เข้าระบบแบบผู้เยี่ยมชม เมื่อยังไม่มีตัวตน (ใช้เฉพาะหน้า public/form)
// หมายเหตุ:
//   - การรอสถานะผู้ใช้ ใช้วิธี “ตั้งหูฟังครั้งเดียว” ตามแนวคู่มือที่แนะนำ
//     (ใช้ onAuthStateChanged เพื่อหลีกเลี่ยงการอ่านสถานะตอนยังตั้งค่าไม่เสร็จ)
//   - โหมดผู้เยี่ยมชมควรเปิดไว้ในคอนโซล ถ้าปิดไว้จะเข้าระบบแบบนี้ไม่ได้
//     เอกสาร: Anonymous Auth (Firebase)
// ======================================================================

import { app, auth, storage } from "../auth";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export { app, auth, storage };           // ของจริงจาก src/auth.ts
export const db = getFirestore(app);      // สำหรับฝั่ง public/form

// -------------------------------------------------------------
// รอให้ระบบ “รู้ว่าเราเป็นใคร” หนึ่งครั้ง (มีเวลารอสูงสุด)
//   - ถ้ารู้ตัวตนแล้ว: ตอบทันที
//   - ถ้ายังไม่รู้: ตั้งหูฟัง 1 ตัว รอผลครั้งแรก แล้วปิดหูฟัง
//   - กันค้าง: มี timeout (ค่าเริ่ม 8 วินาที) แล้วคืนค่าปัจจุบัน (อาจเป็น null)
// เอกสารที่เกี่ยวข้อง: ใช้ตัวสังเกตสถานะผู้ใช้ (onAuthStateChanged)
// -------------------------------------------------------------
// แบ่งปัน “ตัวรอ” ทั่วทั้งแอป เพื่อไม่สร้างหูฟังซ้ำๆ
let _authReadyOnce: Promise<User | null> | null = null;

export function authReady(timeoutMs = 8000): Promise<User | null> {
  // รู้ตัวตนแล้ว ตอบทันที
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  // มีตัวรอที่สร้างไว้แล้ว ใช้ร่วมกัน
  if (_authReadyOnce) return _authReadyOnce;

  _authReadyOnce = new Promise<User | null>((resolve) => {
    let settled = false;
    const off = onAuthStateChanged(auth, (u) => {
      if (settled) return;
      settled = true;
      off();          // ปิดหูฟังทันทีที่รู้ผลครั้งแรก
      resolve(u);     // อาจเป็น User หรือ null
    });

    // กันกรณีรอนานเกินไป (เช่น เน็ตช้า)
    setTimeout(() => {
      if (settled) return;
      settled = true;
      try { off(); } catch {}
      resolve(auth.currentUser || null);
    }, Math.max(1000, timeoutMs)); // อย่างน้อย 1 วินาที
  });

  return _authReadyOnce;
}

// -------------------------------------------------------------
// ✅ ล็อกอินแบบผู้เยี่ยมชม (เฉพาะหน้า public/form เท่านั้น)
//   - ถ้ามีตัวตนอยู่แล้ว: ไม่ทำอะไร
//   - ถ้าไม่มี: ขอเข้าระบบแบบผู้เยี่ยมชม
//   - ถ้าไม่สำเร็จ: โยนข้อความอ่านง่าย (เช่น ระบบปิดโหมดผู้เยี่ยมชมไว้)
// เอกสารที่เกี่ยวข้อง: Anonymous Auth (Firebase)
// -------------------------------------------------------------
export async function ensureSignedIn(): Promise<User> {
  // มีตัวตนอยู่แล้ว (จะเป็นผู้เยี่ยมชมหรือผู้ใช้จริงก็ได้) → ส่งกลับเลย
  if (auth.currentUser) return auth.currentUser;

  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (e: any) {
    // ข้อความอ่านง่าย ไม่ใช้ศัพท์ช่าง
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("operation-not-allowed")) {
      // โหมดผู้เยี่ยมชมถูกปิดไว้ในคอนโซล
      throw new Error("ยังไม่เปิดโหมดผู้เยี่ยมชม กรุณาให้ผู้ดูแลเปิดใช้งาน แล้วลองใหม่");
    }
    throw new Error("เข้าระบบแบบผู้เยี่ยมชมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
}
