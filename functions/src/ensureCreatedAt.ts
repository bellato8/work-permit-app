// ======================================================================
// File: functions/src/ensureCreatedAt.ts
// เวอร์ชัน: 2025-10-04 (Asia/Bangkok)
// หน้าที่: ใส่ฟิลด์ createdAt อัตโนมัติให้เอกสารใหม่ใน requests/{rid}
// แนวคิด: ใช้ "ร่องรอยเวลา" เดิมก่อน (audit/decision/updatedAt)
//         ถ้าไม่พบเลย ใช้ "ตราประทับเวลาเซิร์ฟเวอร์" ของ Firestore
// เชื่อม auth ผ่าน: Firebase Admin SDK
// หมายเหตุ:
//   - เขียนแบบ merge: true เพื่อเติมเฉพาะฟิลด์ที่ขาด (ไม่ทับของเดิม)
//   - Trigger นี้ทำงานเฉพาะ "ตอนเอกสารถูกสร้างใหม่" เท่านั้น
// ======================================================================

import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// แปลงค่าประเภทต่าง ๆ ให้เป็น milliseconds (ถ้าแปลงไม่ได้ คืน undefined)
function toMillis(anyVal: any): number | undefined {
  if (anyVal == null) return undefined;

  if (typeof anyVal === "number" && isFinite(anyVal)) {
    const abs = Math.abs(anyVal);
    if (abs < 1e11) return anyVal * 1000; // วินาที → ms
    if (abs < 1e13) return anyVal;        // ms
    if (abs < 1e16) return Math.floor(anyVal / 1e3); // µs → ms
    return Math.floor(anyVal / 1e6);      // ns → ms
  }

  // Firestore Timestamp (มีเมธอด toMillis)
  if (typeof (anyVal as any)?.toMillis === "function") {
    try {
      return (anyVal as admin.firestore.Timestamp).toMillis();
    } catch {}
  }

  // โครงสร้าง {seconds, nanoseconds} หรือ {_seconds, _nanoseconds}
  const sec = (anyVal as any)?.seconds ?? (anyVal as any)?._seconds;
  const nsec = (anyVal as any)?.nanoseconds ?? (anyVal as any)?._nanoseconds ?? 0;
  if (typeof sec === "number") return sec * 1000 + Math.round(nsec / 1e6);

  // สตริงวันที่ หรือสตริงตัวเลข
  if (typeof anyVal === "string") {
    const t = Date.parse(anyVal);
    if (!Number.isNaN(t)) return t;
    const n = Number(anyVal);
    if (Number.isFinite(n)) return toMillis(n);
  }
  return undefined;
}

export const ensureCreatedAt = onDocumentCreated(
  { region: "asia-southeast1", document: "requests/{rid}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() || {};

    // ถ้ามี createdAt อยู่แล้ว ไม่ทำอะไร (กันซ้ำ)
    if (Object.prototype.hasOwnProperty.call(data, "createdAt")) {
      logger.debug("ensureCreatedAt: already exists, skip.", { rid: snap.id });
      return;
    }

    // เลือกเวลาให้เหมาะสุดตามลำดับ
    const fromAudit = toMillis(data?.audit?.createdAt);
    const fromDecision = toMillis(data?.decision?.at);
    const fromUpdated = toMillis(data?.updatedAt);

    const pickedMs = fromAudit ?? fromDecision ?? fromUpdated;

    if (pickedMs !== undefined) {
      const pickedTs = admin.firestore.Timestamp.fromMillis(pickedMs);
      await snap.ref.set({ createdAt: pickedTs }, { merge: true });
      logger.info("ensureCreatedAt: set from existing trace", {
        rid: snap.id,
        source:
          (fromAudit !== undefined && "audit.createdAt") ||
          (fromDecision !== undefined && "decision.at") ||
          "updatedAt",
      });
      return;
    }

    // Fallback: ใช้ตราประทับเวลาเซิร์ฟเวอร์ของ Firestore (แม่นและเป็นมาตรฐาน)
    await snap.ref.set(
      { createdAt: admin.firestore.FieldValue.serverTimestamp() as any },
      { merge: true }
    );
    logger.info("ensureCreatedAt: set from serverTimestamp()", { rid: snap.id });
  }
);
