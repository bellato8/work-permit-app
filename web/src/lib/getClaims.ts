// ======================================================================
// File: web/src/lib/getClaims.ts
// เวอร์ชัน: 28/09/2025 08:45 (Asia/Bangkok)
// หน้าที่: อ่าน "สิทธิ์" (custom claims) ของผู้ใช้จาก Firebase ID Token
// ใช้เพื่อตัดสินใจซ่อน/แสดงปุ่ม (เช่น ปุ่มอนุมัติ) บนหน้าเว็บ
//
// หมายเหตุสำคัญ (แก้ TypeScript ให้คอมไพล์ผ่าน):
//  - currentUser เป็น "พร็อพเพอร์ตี" (User | null) ของ Firebase SDK v9
//    จึงเลิกใช้ ReturnType<typeof auth.currentUser> (แก้ TS2344)
//  - แปลงค่า caps ให้เป็น boolean เสมอ (true/"true" → true)
// ======================================================================

import {
  getAuth,
  onAuthStateChanged,
  getIdTokenResult,
  type User,
} from "firebase/auth";

// โครงสร้างข้อมูลสิทธิ์ที่ส่วนอื่นจะนำไปใช้
export type MyClaims = {
  email?: string;
  role?: string;
  caps: Record<string, boolean>;
};

// รอจนได้ผู้ใช้ที่ล็อกอิน (กันเคสเข้าหน้าเร็วกว่าสถานะ Auth)
async function waitForUser(): Promise<User | null> {
  const auth = getAuth();
  if (auth.currentUser) return auth.currentUser;

  return new Promise<User | null>((resolve) => {
    const off = onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
}

/**
 * อ่าน claims ล่าสุดจาก ID Token ของผู้ใช้
 * - บังคับรีเฟรชโทเค็น (true) เพื่อให้ได้ค่าล่าสุดเสมอ
 */
export async function getMyClaims(): Promise<MyClaims> {
  const user = await waitForUser();
  if (!user) return { role: undefined, caps: {} };

  const tokenResult = await getIdTokenResult(user, /* forceRefresh */ true);

  const role = (tokenResult.claims as any).role as string | undefined;
  const rawCaps = ((tokenResult.claims as any).caps || {}) as Record<string, unknown>;

  // ทำให้แน่ใจว่า caps เป็น boolean จริง ๆ
  const caps: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(rawCaps)) {
    caps[k] = v === true || v === "true";
  }

  const email =
    ((tokenResult.claims as any).email as string | undefined) ??
    user.email ??
    undefined;

  return { email, role, caps };
}

/** เช็คสิทธิ์ว่ากด “ตัดสินคำขอ” ได้หรือไม่ */
export async function canDecide(): Promise<boolean> {
  const { role, caps } = await getMyClaims();
  return (
    role === "superadmin" ||
    caps.approve === true ||
    caps.decide === true ||
    caps.manage_requests === true
  );
}
