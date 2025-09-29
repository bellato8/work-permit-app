"use strict";
// ============================================================
// ไฟล์: functions/src/admin.ts
// ผู้เขียน (Written by):Sutthirak.w
// เวลา/เวอร์ชัน: 2025-08-23 16:10 (รวมศูนย์ initializeApp ให้เรียกครั้งเดียว)
// หน้าที่ไฟล์: Bootstrap Firebase Admin SDK หนึ่งครั้ง แล้ว export db/storage ให้ไฟล์อื่นใช้
// คำศัพท์: initializeApp [อินนิไช-อะ-ไลซ์ แอป] = คำสั่งเริ่มต้นแอปแอดมิน, Singleton [ซิงเกิลตัน] = มีแค่ตัวเดียว
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.db = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
// ป้องกันเรียก initializeApp ซ้ำ (ถ้ามีแอปอยู่แล้วจะไม่เรียกซ้ำ)
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
// Export ตัวใช้งานร่วม
exports.db = (0, firestore_1.getFirestore)();
exports.storage = (0, storage_1.getStorage)();
