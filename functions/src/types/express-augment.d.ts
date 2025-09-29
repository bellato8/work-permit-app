// ======================================================================
// File: functions/src/types/express-augment.d.ts
// เวอร์ชัน: 25/09/2025 (Asia/Bangkok)
// หน้าที่: ขยาย (augment) ชนิดของ Express อย่างถูกต้อง เพื่อเพิ่ม req.rawBody
// หมายเหตุ:
//  - ห้ามประกาศ `interface Request {}`/`interface Response {}` แบบลอย ๆ นอกโมดูล
//    เพราะจะไป "ทับ" ชนิดหลักของ Express ทำให้ method เดิม (status/query/headers) หาย
//  - แนวทางนี้จะคง method เดิมทุกตัว และเพิ่มแค่ rawBody ที่ Cloud Functions/Run ให้มา
// ======================================================================

import type * as core from "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    /** บอดี้แบบดิบ (ดาต้าเดิมยังไม่ parse) บางกรณี Cloud Functions/Run จะให้มา */
    rawBody?: Buffer;
  }
}
