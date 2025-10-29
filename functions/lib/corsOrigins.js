"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOW_ORIGINS = void 0;
// functions/src/corsOrigins.ts
// รายชื่อโดเมนที่อนุญาตให้เว็บเรียกฟังก์ชันได้ (CORS allowlist)
exports.ALLOW_ORIGINS = new Set([
    "http://localhost:5173", // dev ในเครื่อง
    "https://work-permit-app-dev.web.app", // ⭐ เพิ่ม: เว็บ Dev
    "https://work-permit-app-dev.firebaseapp.com", // ⭐ เพิ่ม: เว็บ Dev (URL สำรอง )
    "https://work-permit-app-1e9f0.web.app", // โฮสต์จริง (Prod )
    "https://work-permit-app-1e9f0.firebaseapp.com", // โฮสต์จริง (Prod - URL สำรอง )
    "https://imperialworld.asia", // โดเมนจริง
    "https://staging.imperialworld.asia", // โดเมนสเตจจิง
]);
