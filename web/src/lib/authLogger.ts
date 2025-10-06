// web/src/lib/authLogger.ts
// ยิง logAuth: login/logout → auditLogs (Cloud Function 'logAuth') ด้วย ID Token (ไม่ใช้ x-api-key แล้ว)

import { getAuth, onAuthStateChanged, getIdToken, signOut } from "firebase/auth";

const LOG_URL = (import.meta.env.VITE_LOG_AUTH_URL as string) || "";

// กันยิงซ้ำในแท็บเดียว (จำ uid ล่าสุดที่บันทึก)
const KEY = "wp.logged-uid";

// สร้าง Header ที่แนบ ID Token; forceRefresh=true ใช้เฉพาะตอนรีทรายเมื่อ 401
async function authzHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("ยังไม่ล็อกอิน");
  const token = await getIdToken(user, forceRefresh); // ออกบัตรปัจจุบัน หรือบัตรใหม่เมื่อจำเป็น
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  // แถมผู้สั่ง (ไม่บังคับ) เพื่อช่วยไล่เหตุการณ์ภายหลัง
  if (user.email) h["x-requester-email"] = user.email;
  return h;
}

// ยิงไปที่ logAuth (รีทราย 1 ครั้งเมื่อ 401)
async function postAuthLog(
  action: "login" | "logout" | "manual",
  body: Record<string, any>
): Promise<void> {
  if (!LOG_URL) return;
  const url = LOG_URL;

  // ครั้งที่ 1: ใช้บัตรปัจจุบัน
  try {
    const r1 = await fetch(url, { method: "POST", headers: await authzHeaders(false), body: JSON.stringify({ action, ...body }), mode: "cors" });
    if (r1.status !== 401) return; // สำเร็จหรือเป็นรหัสอื่น ก็พอแค่นี้ (ไม่รบกวน UX)
  } catch {
    // เงียบไว้ ลองใหม่ด้วยการออกบัตรใหม่
  }

  // ครั้งที่ 2: รีเฟรชบัตรแล้วลองใหม่ (กันเคสหมดอายุ)
  try {
    await fetch(url, { method: "POST", headers: await authzHeaders(true), body: JSON.stringify({ action, ...body }), mode: "cors" });
  } catch {
    // เงียบ: ไม่เด้ง error ไปที่ผู้ใช้
  }
}

/**
 * เริ่มระบบบันทึกอัตโนมัติ
 * - เมื่อ "มีผู้ใช้" → บันทึก login 1 ครั้งต่อแท็บ
 * - เมื่อ "ไม่มีผู้ใช้" → แค่ล้างสถานะกันยิงซ้ำ (ไม่ส่ง logout ที่นี่ เพราะไม่มีบัตรแล้ว)
 */
export function startAuthLogging() {
  const auth = getAuth();
  onAuthStateChanged(auth, async (user) => {
    const prevUid = sessionStorage.getItem(KEY);

    // มีผู้ใช้ล็อกอิน และยังไม่เคยบันทึกในแท็บนี้ → บันทึก login
    if (user && prevUid !== user.uid) {
      try {
        await postAuthLog("login", {
          email: user.email || "",
          name: user.displayName || "",
          note: "auto login",
        });
      } finally {
        sessionStorage.setItem(KEY, user.uid);
      }
      return;
    }

    // ไม่มีผู้ใช้แล้ว → เคลียร์สถานะกันยิงซ้ำ (ไม่ยิง logout ที่นี่)
    if (!user && prevUid) {
      sessionStorage.removeItem(KEY);
    }
  });
}

/**
 * ใช้แทนการเรียก signOut() ตรง ๆ
 * - ยิง "logout" ก่อน (ยังมี ID Token ใช้ยืนยัน)
 * - แล้วค่อย signOut จริง
 */
export async function signOutWithAudit(note = "manual logout"): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user?.email) {
    try {
      await postAuthLog("logout", {
        email: user.email,
        name: user.displayName || "",
        note,
      });
    } catch {
      // เงียบ ไม่ขวางการออกจากระบบ
    }
  }

  await signOut(auth);
  sessionStorage.removeItem(KEY);
}
