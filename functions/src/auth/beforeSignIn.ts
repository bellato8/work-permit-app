// ======================================================================
// File: functions/src/auth/beforeSignIn.ts
// เวอร์ชัน: 2025-09-28 22:55 (Asia/Bangkok)
// หน้าที่: ฟังก์ชัน "ก่อนล็อกอิน" (blocking function) — อ่านสิทธิ์จาก Firestore
//          แล้วแนบลง sessionClaims ให้โทเค็นรอบนี้ทันที (role + caps)
// เชื่อม auth ผ่าน Identity Platform blocking functions (beforeUserSignedIn)
// หมายเหตุ:
//  - ใช้ sessionClaims เพราะต้องการ "ปั๊มสิทธิ์ทุกครั้งที่ล็อกอิน" จากฐานกลาง
//  - ถ้า admin ถูกปิดการใช้งาน (enabled=false) จะบล็อกการเข้าระบบ
//  - ต้องเปิดใช้ Identity Platform และผูกฟังก์ชันในหน้า Blocking functions
// ======================================================================

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  beforeUserSignedIn,
  HttpsError,
} from "firebase-functions/v2/identity";

if (!getApps().length) initializeApp();
const db = getFirestore();

type AdminDoc = {
  role?: "superadmin" | "admin" | "approver" | "viewer";
  enabled?: boolean;
  caps?: Record<string, boolean>;
  name?: string;
};

/**
 * beforeUserSignedIn:
 * - รันหลังยืนยันรหัสผ่าน/ผู้ให้บริการแล้ว แต่ "ก่อน" ส่งคืน ID token ไปยัง client
 * - เราอ่านสิทธิ์จาก /admins/{email} แล้วแนบลง sessionClaims
 */
export const applyRolesOnSignIn = beforeUserSignedIn(
  { region: "asia-southeast1", timeoutSeconds: 7 },
  async (event) => {
    const user = event.data; // ข้อมูลผู้ใช้กำลังจะล็อกอิน (email/uid/ฯลฯ)
    const email = (user?.email || "").toLowerCase().trim();

    // default สำหรับคนที่ไม่อยู่ในรายชื่อแอดมิน
    let role: AdminDoc["role"] = "viewer";
    let caps: Record<string, boolean> = {};

    if (email) {
      const doc = await db.collection("admins").doc(email).get();
      if (doc.exists) {
        const data = (doc.data() || {}) as AdminDoc;

        // ถ้าแอดมินถูกปิดใช้งาน → บล็อก
        if (data.enabled === false) {
          throw new HttpsError(
            "permission-denied",
            "บัญชีนี้ถูกปิดสิทธิ์ชั่วคราว โปรดติดต่อผู้ดูแลระบบ"
          );
        }

        // ถ้ามีในฐานและไม่ถูกปิด → ใช้ role/caps จากฐาน
        if (data.role) role = data.role;
        if (data.caps) caps = data.caps;
      }
    }

    // แนบสิทธิ์ลง "sessionClaims" ของรอบการล็อกอินนี้
    // (จะถูกรวมกับ custom claims อื่น ๆ ตามกติกาของ Identity Platform)
    return {
      sessionClaims: {
        role,
        caps,
      },
    };
  }
);
