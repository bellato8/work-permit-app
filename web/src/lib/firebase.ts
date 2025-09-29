// ======================================================================
// src/lib/firebase.ts
// รวมของจำเป็นให้ไฟล์เดิม import จากที่เดียว
// - app, auth, storage มาจาก src/auth.ts (จุด init กลาง)
// - db = Firestore เอาไว้ใช้ฝั่งหน้า public/form (ฝั่ง Admin ยังห้ามอ่านตรง)
// - helper: authReady(), ensureSignedIn()
// ======================================================================

import { app, auth, storage } from "../auth";
import { onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export { app, auth, storage };           // ของจริงจาก src/auth.ts
export const db = getFirestore(app);      // สำหรับฝั่ง public/form

// รอให้ auth “พร้อม” ครั้งแรก
export function authReady(): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const off = onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
}

// ✅ ล็อกอินแบบไม่ระบุตัวตน (ใช้สำหรับหน้าแบบฟอร์มให้ upload ได้ตามกติกา Storage Rules)
export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}
