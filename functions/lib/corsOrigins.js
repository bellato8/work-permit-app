"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOW_ORIGINS = void 0;
// functions/src/corsOrigins.ts
// รายชื่อโดเมนที่อนุญาตให้เว็บเรียกฟังก์ชันได้ (CORS allowlist)
exports.ALLOW_ORIGINS = new Set([
    "http://localhost:5173", // dev ในเครื่อง
    "https://work-permit-app-1e9f0.web.app", // โฮสต์จริง
    "https://work-permit-app-1e9f0.firebaseapp.com",
    "https://imperialworld.asia", // โดเมนจริง
    "https://staging.imperialworld.asia", // โดเมนสเตจจิง
]);
