"use strict";
// ======================================================================
// ไฟล์: functions/src/_cors.ts
// เวอร์ชัน: 2025-09-03-reexport-singleton
// หน้าที่: ส่งออกตัวครอบ CORS เดียวจาก withCors.ts
// หมายเหตุ: คงชื่อไฟล์เดิมไว้เพื่อความเข้ากันได้ย้อนหลัง (backward compatibility)
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCors = void 0;
var withCors_1 = require("./withCors");
Object.defineProperty(exports, "withCors", { enumerable: true, get: function () { return withCors_1.withCors; } });
