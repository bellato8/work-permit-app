// ======================================================================
// File: web/src/api/attendance.ts
// สรุป: เรียก API เช็คอิน/เช็คเอาท์ โดยอ่าน URL เต็มจาก .env
// - ใช้ VITE_CHECKIN_URL และ VITE_CHECKOUT_URL (ตรงกับไฟล์ .env.local ของคุณ)
// - ใส่ Authorization: Bearer <Firebase ID token> ทุกครั้ง
// - แก้การรอผู้ใช้: ใช้ Promise<User | null> ธรรมดา + ยกเลิกผู้ฟังหลังได้คำตอบ
// ======================================================================

import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';

const CHECKIN_URL = import.meta.env.VITE_CHECKIN_URL as string;
const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_URL as string;

async function getIdTokenOrThrow(): Promise<string> {
  const auth = getAuth();

  // ถ้ามีผู้ใช้แล้ว ขอ token ได้เลย
  if (auth.currentUser) {
    return await auth.currentUser.getIdToken();
  }

  // ถ้ายังไม่รู้สถานะ ให้รอหนึ่งครั้ง แล้วเลิกฟังต่อ (unsubscribe)
  const user = await new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      unsubscribe(); // เลิกฟังทันทีหลังได้ค่ารอบแรก
      resolve(u);
    });
  });

  if (!user) {
    throw new Error('ยังไม่เข้าสู่ระบบ');
  }
  return await user.getIdToken();
}

async function authedPost(fullUrl: string, body: any) {
  if (!fullUrl) throw new Error('ยังไม่ได้ตั้งค่า URL ของปลายทาง');
  const token = await getIdTokenOrThrow();

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || res.statusText || 'Request failed');
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function apiCheckIn(rid: string, payload?: Record<string, any>) {
  const body = { rid, at: new Date().toISOString(), ...payload };
  return authedPost(CHECKIN_URL, body);
}

export async function apiCheckOut(rid: string, payload?: Record<string, any>) {
  const body = { rid, at: new Date().toISOString(), ...payload };
  return authedPost(CHECKOUT_URL, body);
}
