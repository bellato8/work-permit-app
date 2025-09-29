// ======================================================================
// src/auth.ts
// จุด init Firebase กลางของแอป (แหล่งความจริง)
// - อ่านค่าจาก .env เสมอ
// - ตั้งค่า storage ให้ชี้ bucket firebasestorage.app ที่ถูกต้อง
// ======================================================================

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// ค่าคอนฟิกทั้งหมดมาจาก .env.local
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ❗ สำคัญ: ต้องเป็น firebasestorage.app (ไม่ใช่ appspot.com)
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

// สร้าง/ดึงแอป (กัน init ซ้ำตอน HMR ของ Vite)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth (เว็บเราใช้ anonymous sign-in ได้ในบางหน้า)
export const auth = getAuth(app);

// Storage
// - ใส่พารามิเตอร์ที่ 2 เป็น gs://... เพื่อ “ล็อก bucket ให้ตรง” กันพลาด
// - ถ้าไม่ระบุ ก็จะใช้จาก storageBucket ใน config ด้านบน
export const storage = getStorage(
  app,
  import.meta.env.VITE_FIREBASE_STORAGE_BUCKET_GS // "gs://work-permit-app-1e9f0.firebasestorage.app"
);
