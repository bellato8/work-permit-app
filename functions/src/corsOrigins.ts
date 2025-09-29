// functions/src/corsOrigins.ts
// รายชื่อโดเมนที่อนุญาตให้เว็บเรียกฟังก์ชันได้ (CORS allowlist)
export const ALLOW_ORIGINS = new Set<string>([
  "http://localhost:5173",                     // dev ในเครื่อง
  "https://work-permit-app-1e9f0.web.app",     // โฮสต์จริง
  "https://work-permit-app-1e9f0.firebaseapp.com",
  "https://imperialworld.asia",                // โดเมนจริง
  "https://staging.imperialworld.asia",        // โดเมนสเตจจิง
]);
