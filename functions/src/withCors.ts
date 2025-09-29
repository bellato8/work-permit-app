// ======================================================================
// File: functions/src/withCors.ts
// เวอร์ชัน: 2025-09-25 00:25 (Asia/Bangkok)
// หน้าที่: ตัวครอบ CORS กลางของระบบ (รองรับ preflight ตามสเปค MDN)
// หมายเหตุสำคัญ:
//  - Allow-Headers: รวม whitelist เดิม + สิ่งที่ client ขอมาใน preflight
//  - Vary: Origin เพื่อกัน cache ผิดโดเมน
//  - Access-Control-Max-Age: 600 เพื่อลดรอบ preflight
//  - ไม่ตั้ง Access-Control-Allow-Credentials โดยปริยาย (ถ้าไม่ใช้คุกกี้ข้ามโดเมน)
// ======================================================================

import type { Request, Response } from "express";

// ต้นทางที่อนุญาตแบบระบุชัด (exact match)
const EXACT_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://work-permit-app-1e9f0.web.app",
  "https://work-permit-app-1e9f0.firebaseapp.com",
  "https://imperialworld.asia",
  "https://staging.imperialworld.asia",
]);

// รูปแบบโดเมนที่อนุญาต (เช่น preview channel / subdomain)
const REGEX_ORIGINS: RegExp[] = [
  /^https:\/\/work-permit-app-1e9f0--[a-z0-9-]+\.web\.app$/i, // Firebase Hosting preview
  /^https:\/\/([a-z0-9-]+\.)?imperialworld\.asia$/i,           // รองรับ subdomain อื่นในอนาคต
];

// whitelist header เบื้องต้น (normalize เป็นพิมพ์เล็ก)
const BASE_ALLOW_HEADERS = [
  "content-type",
  "authorization",
  "x-requested-with",
  "x-api-key",
  "x-requester-email",
];

function allowOrigin(origin?: string | null): string | null {
  if (!origin) return null;
  if (EXACT_ORIGINS.has(origin)) return origin;
  if (REGEX_ORIGINS.some((re) => re.test(origin))) return origin;
  return null;
}

function buildAllowHeaders(req: Request): string {
  // รวม whitelist เดิม + สิ่งที่เบราว์เซอร์ขอมาทาง preflight
  const reqHdrRaw = (req.headers["access-control-request-headers"] as string | undefined) || "";
  const dynamic = reqHdrRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const merged = Array.from(new Set([...BASE_ALLOW_HEADERS, ...dynamic]));
  return merged.join(", ");
}

/** ครอบ handler เพื่อใส่ CORS และรองรับ preflight */
export function withCors(
  handler: (req: Request, res: Response) => Promise<void> | void
) {
  return async (req: Request, res: Response) => {
    const origin = allowOrigin(req.headers.origin as string | undefined);

    // ตั้ง Allow-Origin แบบเจาะจง (ไม่ใช้ *) ตามแนวทางความปลอดภัย CORS
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin"); // ให้ cache แยกตาม Origin
    }

    // Methods ที่อนุญาต — เพิ่ม PUT,PATCH ให้ครบกรณีแก้ไขข้อมูล
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

    // อนุญาต headers: รวม whitelist เดิม + ที่ client ขอมาใน preflight
    res.setHeader("Access-Control-Allow-Headers", buildAllowHeaders(req));

    // Cache preflight ไว้ 10 นาที (เบราว์เซอร์มีเพดานของตัวเอง)
    res.setHeader("Access-Control-Max-Age", "600");

    // (ถ้าต้องให้ client อ่าน header custom จาก response ค่อยเปิด)
    // res.setHeader("Access-Control-Expose-Headers", "x-total-count, x-next-page");

    // ถ้าเป็น preflight ให้จบด้วย 204 เร็ว ๆ
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    await handler(req, res);
  };
}
