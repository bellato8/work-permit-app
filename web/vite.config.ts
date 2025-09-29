// ======================================================================
// File: web/vite.config.ts
// เวอร์ชัน: 28/09/2025 16:27 (Asia/Bangkok)
// หน้าที่: ตั้งค่า Vite ให้รองรับ "เบราว์เซอร์รุ่นเก่า" โดยใช้ @vitejs/plugin-legacy
// เชื่อม auth ผ่าน "อะแดปเตอร์": (ไฟล์นี้ไม่มีการเรียก token โดยตรง — ไม่มีผลกับ auth)
// หมายเหตุ:
//  - สำรองไฟล์เดิมเป็น .bak แล้วก่อนวางแทน
//  - legacy() จะสร้างไฟล์ชุด "legacy chunks + polyfills" และโหลดเฉพาะเบราว์เซอร์เก่าที่ไม่รองรับ ESM
//    (อ้างอิงเอกสาร Vite: legacy plugin จะ generate legacy chunks + polyfills และโหลดแบบมีเงื่อนไข) 
//  - ตั้ง targets ให้ครอบคลุมเครื่ององค์กรที่เป็น Firefox/Chrome รุ่นเก่า
//  - ใส่ additionalLegacyPolyfills: ['regenerator-runtime/runtime'] เพื่อกัน error async/await บางรุ่นเก่าจัด ๆ
//  - build.target กำหนด es2017 เพื่อให้ไฟล์หลักไม่ย้อนยุคเกินไป แต่ยังได้ประสิทธิภาพบนเบราว์เซอร์ใหม่
// ======================================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),

    // --- ปลั๊กอินรองรับเครื่องเก่า ---
    legacy({
      // กลุ่มเบราว์เซอร์เป้าหมาย (อ่านง่าย/กลาง ๆ + เครือข่ายองค์กร)
      // หมายเหตุ: Vite เองยืนบน ESM; legacy plugin จะช่วยทำชุดไฟล์สำหรับเบราว์เซอร์ที่ไม่รองรับ ESM
      // และเติม polyfills ตามการใช้งานจริงของโปรเจกต์
      targets: [
        'defaults',
        'not dead',
        'Chrome >= 49',   // เครือองค์กร Windows เก่าบางเครื่อง
        'Firefox >= 45',  // ESR เก่าช่วงปี 2016 ยังเจอในบางที่
        'Safari >= 10',
        'iOS >= 10'
      ],

      // เปิด “modern polyfills” ด้วย เผื่อเคสที่เบราว์เซอร์ใหม่บางเวอร์ชันยังขาด API บางตัว
      // (เช่น Object.hasOwn) — ลด false error ตอน production
      modernPolyfills: true,

      // ใส่ polyfill สำหรับ async/await (regenerator) เฉพาะฝั่ง legacy เพื่อกัน error เก่ามาก
      // หมายเหตุ: ทำให้ไฟล์ modern ไม่บวม แต่ legacy ใช้งานได้จริง
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],

      // หมายเหตุ: ปล่อยค่าดีฟอลต์อื่น ๆ ไว้ เช่น renderLegacyChunks=true
    }),
  ],

  // ลดระดับ JS หลักเล็กน้อยเพื่อความเข้ากันได้กว้างขึ้น โดยยังคงประสิทธิภาพ
  build: {
    target: 'es2017',
    // ปล่อย cssTarget ตามที่ปลั๊กอินตั้งค่าให้ (จะบังคับเป็น chrome61 ถ้ายังไม่กำหนด)
  },
}));
