// ======================================================================
// File: web/src/components/AuthLogger.tsx
// เวอร์ชัน: 19/09/2025 03:55 (subscribe onAuthStateChanged แล้วเรียก logAuth)
// หน้าที่: ติดหูฟังสถานะล็อกอินของ Firebase Auth แล้วบันทึก login/logout อัตโนมัติ
// เชื่อม auth ผ่าน: Firebase Auth (getAuth + onAuthStateChanged)
// หมายเหตุ:
//  - บันทึก login เมื่อ user != null, logout เมื่อ user == null
//  - กันยิงซ้ำด้วย sessionStorage ใน logAuthClient
// ======================================================================

import { useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { logAuthClient } from "../lib/logAuthClient";

export default function AuthLogger() {
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const email = user.email || "";
        const name = user.displayName || "";
        // login
        logAuthClient({
          action: "login",
          requester: "", // จะถูกเติมจาก ENV/localStorage ใน client
          email,
          name,
          note: "auto log from web (login)",
        });
      } else {
        // logout
        logAuthClient({
          action: "logout",
          requester: "",
          note: "auto log from web (logout)",
        });
      }
    });

    return () => unsub();
  }, []);

  return null; // เป็นคอมโพเนนต์ที่ไม่แสดง UI
}
