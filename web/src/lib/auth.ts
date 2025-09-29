// ======================================================================
// File: web/src/lib/auth.ts
// เวอร์ชัน: 28/09/2025 12:10 (Asia/Bangkok)
// หน้าที่: อะแดปเตอร์ auth ฝั่งเว็บ (login/logout/get user/token/claims)
//          + ตัวช่วยรีเฟรช ID token, อ่าน custom claims, และ hook สำหรับ Console
//
// แก้จุดพังเดิม:
//   • รวมการประกาศ window.__auth ให้เหลือ "แบบเดียว" ป้องกัน TS2717
//   • ให้ __auth.refresh() คืน Promise<string|null> (ID token) ตามที่ส่วนอื่นคาดหวัง
//   • เพิ่ม __auth.claims(force?) สำหรับอ่านสิทธิ์ (claims)
//   • อ่าน claims ด้วย user.getIdTokenResult(force) ตามแนวทาง Firebase v9
//     (แทนการถอด JWT เอง) และมี onIdTokenChanged ให้ฟังการเปลี่ยนแปลง
// ======================================================================

import { auth } from "../auth"; // ใช้ Firebase app เดิมของโปรเจกต์
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";

// เผื่อบางหน้าต้องการใช้ตัว auth ตรง ๆ
export { auth };

// ---------- Types ----------
export type AppUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
};

// สิทธิ์/คลเลมที่เราสนใจจาก ID token
export type UserClaims = {
  email?: string;
  role?: string;
  caps?: Record<string, boolean>;
  // อนุญาต field อื่น ๆ เผื่อมีเพิ่มในอนาคต
  [k: string]: unknown;
};

export type AppClaims = UserClaims;

// ======================================================================
// 1) Login / Logout / Current user
// ======================================================================

/** ล็อกอินแบบปลอดภัย ใช้งานต่อกับโค้ดเดิมได้ทันที */
export async function tryLoginWithAuth(
  email: string,
  password: string
): Promise<{ ok: boolean; user?: AppUser; error?: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const u = cred.user;
    return { ok: true, user: { uid: u.uid, email: u.email, displayName: u.displayName } };
  } catch (e: any) {
    return { ok: false, error: e?.message || "login_failed" };
  }
}

/** คืนผู้ใช้ปัจจุบัน (รอโหลด state ให้แล้ว) */
export function getCurrentUser(): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
}

/** ออกจากระบบ */
export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}

// ======================================================================
// 2) Token helpers (ID token & Claims)
// ======================================================================

/** ขอ ID token (เลือก force refresh ได้) */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

/** บังคับรีเฟรช ID token แล้วคืน token ล่าสุด */
export async function ensureFreshIdToken(): Promise<string | null> {
  return getIdToken(true);
}

/**
 * อ่าน custom claims ล่าสุดจาก ID token (ใช้ getIdTokenResult ตามเอกสาร Firebase)
 * @param force true = บังคับออก token ใหม่ก่อนอ่าน
 */
export async function getFreshClaims(force = true): Promise<UserClaims | null> {
  const u = auth.currentUser;
  if (!u) return null;
  const res = await u.getIdTokenResult(force); // มี .claims ตรงนี้
  const c = (res?.claims || {}) as Record<string, unknown>;
  return {
    email: (c.email as string) ?? u.email ?? undefined,
    role: (c.role as string) ?? undefined,
    caps: (c.caps as Record<string, boolean>) ?? {},
    ...c, // เผื่อส่วนอื่นอยากเข้าถึงคีย์ดิบเพิ่มเติม
  };
}

/** ดึง claims แบบ force refresh (alias สั้น ๆ) */
export async function fetchFreshClaims(): Promise<AppClaims | null> {
  return getFreshClaims(true);
}

/** สมัครฟังการเปลี่ยนแปลงของ "ID token/claims" (เปลี่ยนปุ๊บยิง callback ปั๊บ) */
export function onClaimsChanged(cb: (claims: AppClaims | null) => void): () => void {
  return onIdTokenChanged(auth, async (user) => {
    if (!user) return cb(null);
    cb(await getFreshClaims(false));
  });
}

// ======================================================================
// 3) Subscribe auth state (สำหรับ UI)
// ======================================================================

/** ฟังการเปลี่ยนแปลงสถานะล็อกอิน (คืนฟังก์ชันยกเลิกฟัง) */
export function onAuthState(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

// ======================================================================
// 4) Debug helper (ผูกเข้าหน้า Console อย่างปลอดภัย)
//    — แก้ type ให้คงที่ตัวเดียว ป้องกัน TS2717 และ TS2322
// ======================================================================

declare global {
  interface Window {
    __auth?: {
      // ดูค่า auth / user ปัจจุบัน
      auth: typeof auth;
      currentUser: () => User | null;

      // รับ ID token (หรือรีเฟรชบังคับ)
      getIdToken: (force?: boolean) => Promise<string | null>;
      // รีเฟรช ID token (ต้องคืน string|null เสมอ เพื่อให้ส่วนอื่นใช้งานร่วมกันได้)
      refresh: () => Promise<string | null>;

      // อ่าน claims ล่าสุด (force?: true = ออก token ใหม่ก่อนอ่าน)
      claims: (force?: boolean) => Promise<UserClaims | null>;
    };
  }
}

/** ผูกตัวช่วย debug เข้า window.__auth (เฉพาะเบราว์เซอร์) */
export function exposeForDebug() {
  if (typeof window === "undefined") return;
  window.__auth = {
    auth,
    currentUser: () => auth.currentUser,
    getIdToken: (force = false) => getIdToken(force),
    refresh: () => ensureFreshIdToken(),
    claims: (force = true) => getFreshClaims(force),
  };
}

// ผูกให้เลยตอนโหลดไฟล์ (ไม่รบกวนผู้ใช้ หากรันนอกเบราว์เซอร์จะข้าม)
try {
  exposeForDebug();
} catch {
  /* no-op */
}
