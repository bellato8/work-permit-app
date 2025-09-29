/* ============================================================================
 * ไฟล์: web/src/pages/LogoutPage.tsx
 * เวอร์ชัน: 2025-09-16
 * บทบาทไฟล์ (role): หน้าออกจากระบบ — บันทึกล็อก logout แล้ว signOut และพาไป /login
 * เปลี่ยนแปลงรอบนี้:
 *   • [ใหม่] เรียก logAuth({ kind: "logout", ... }) ก่อน signOut
 *   • [ใหม่] กันเรียกซ้ำด้วย useRef และมีปุ่มสำรองกรณีเครือข่ายช้า
 * คำสำคัญ (English → Thai/phonetic/meaning):
 *   • Logout (ล็อกเอาต์) = ออกจากระบบ
 *   • Redirect (รีไดเรกต์) = ส่งผู้ใช้ไปหน้าอื่นโดยอัตโนมัติ
 * หมายเหตุความปลอดภัย: ใช้ URL จาก ENV ผ่าน helper logAuth เท่านั้น
 * ผู้เขียน: AI ผู้ช่วย (โหมดจับมือทำ)
 * ========================================================================== */

import React, { useEffect, useRef } from "react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { logAuth } from "../lib/logAuth";

export default function LogoutPage() {
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;

    const doLogout = async () => {
      const u = auth.currentUser;
      try {
        if (u) {
          // บันทึกเหตุการณ์ออกจากระบบ (ไม่บล็อกหากล้มเหลว)
          try {
            await logAuth({
              kind: "logout",
              email: u.email ?? undefined,
              uid: u.uid,
              name: u.displayName ?? undefined,
            });
          } catch (e) {
            console.warn("[Logout] logAuth(logout) failed:", e);
          }
        }
      } finally {
        try {
          await signOut(auth);
        } catch (e) {
          console.warn("[Logout] signOut failed:", e);
        }
        // พาไปหน้าเข้าสู่ระบบ
        window.location.replace("/login");
      }
    };

    void doLogout();
  }, []);

  // UI ระหว่างกำลังออกจากระบบ + ปุ่มสำรอง
  const manual = async () => {
    try { await signOut(auth); } catch {}
    window.location.replace("/login");
  };

  return (
    <div className="min-h-screen grid place-items-center text-white"
         style={{ background:
           "radial-gradient(circle at 25% 10%,#0f172a,transparent 40%),radial-gradient(circle at 80% 20%,#1e293b,transparent 35%),linear-gradient(180deg,#020617,#0b1020)"}}>
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl w-[min(92vw,460px)] text-center">
        <h1 className="text-xl font-semibold">กำลังออกจากระบบ…</h1>
        <p className="text-white/70 mt-2">โปรดรอสักครู่ ระบบจะพาไปหน้าเข้าสู่ระบบ</p>
        <button
          onClick={manual}
          className="mt-6 w-full py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition"
        >
          ไปหน้าเข้าสู่ระบบทันที
        </button>
      </div>
    </div>
  );
}
