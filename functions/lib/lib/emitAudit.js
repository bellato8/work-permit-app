"use strict";
// functions/src/lib/emitAudit.ts
// Append-only audit logger (ใช้ร่วมทุกฟังก์ชัน)
// เขียนลงคอลเลกชัน: auditLogs
// หมายเหตุ: Firestore ไม่รับค่า `undefined` ในเอกสาร
//           โค้ดนี้ตั้งค่า ignoreUndefinedProperties และตัดค่า undefined ออกเสมอ
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitAudit = emitAudit;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
/** เริ่มต้น Admin SDK หนึ่งครั้ง */
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
/** Firestore client (Admin) + เปิด ignoreUndefinedProperties เพื่อกัน error runtime) */
const db = (0, firestore_1.getFirestore)();
// ตัวเลือกนี้ทำให้ field ที่เป็น undefined ถูกข้ามไป ไม่ถูกเขียนขึ้นฐาน
// (หากไม่เปิด ตัว SDK จะ throw error เมื่อเจอค่า undefined)
db.settings({ ignoreUndefinedProperties: true });
/** ลบค่าที่เป็น undefined ออกจากออบเจ็กต์/อาเรย์แบบลึก */
function pruneUndefinedDeep(input) {
    if (input === undefined)
        return undefined;
    if (input === null)
        return input;
    if (Array.isArray(input)) {
        return input
            .map((v) => pruneUndefinedDeep(v))
            .filter((v) => v !== undefined);
    }
    if (typeof input === "object") {
        const out = {};
        for (const [k, v] of Object.entries(input)) {
            if (v === undefined)
                continue;
            const vv = pruneUndefinedDeep(v);
            if (vv !== undefined)
                out[k] = vv;
        }
        return out;
    }
    return input;
}
/**
 * บันทึกเหตุการณ์สำคัญแบบ append-only
 * @param action  ชื่อเหตุการณ์ เช่น "status_update_approved"
 * @param by      ผู้กระทำ (อ็อบเจ็กต์ หรือสตริง "unknown")
 * @param target  เป้าหมาย เช่น { type:"request", rid }
 * @param note    หมายเหตุสั้น ๆ
 * @param extra   ข้อมูลเสริมใด ๆ (ip, ua, method, from, to, ฯลฯ)
 * @returns id ของเอกสารที่เพิ่ม
 */
async function emitAudit(action, by, target, note, extra) {
    // ทำความสะอาดค่า actor/target/extra กัน field ที่เป็น undefined
    const byClean = typeof by === "string" ? by : by ? pruneUndefinedDeep(by) : "unknown";
    const targetClean = typeof target === "string" ? target : target ? pruneUndefinedDeep(target) : undefined;
    const extraClean = extra ? pruneUndefinedDeep(extra) : undefined;
    const payload = pruneUndefinedDeep({
        action: action || "-",
        at: firestore_1.FieldValue.serverTimestamp(),
        by: byClean, // หากเป็น object จะถูก prune แล้ว
        target: targetClean, // undefined จะไม่ถูกเขียน
        note: note ?? undefined,
        extra: extraClean, // undefined ข้างในถูกตัดออกแล้ว
    });
    const ref = await db.collection("auditLogs").add(payload);
    return ref.id;
}
