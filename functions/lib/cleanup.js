"use strict";
// ======================================================================
// File: functions/src/cleanup.ts
// เวอร์ชัน: 2025-09-18 23:10 (Asia/Bangkok)
// หน้าที่: ฟังก์ชันล้างงานตาม RID และลบ logs (จำกัดเฉพาะ superadmin)
// เชื่อม auth ผ่าน Firebase Admin SDK (initializeApp อยู่ใน index.ts แล้ว)
// หมายเหตุ:
// - ยกระดับตรวจสิทธิ์: รับทั้ง custom claims และ Firestore (adminUsers / admins)
// - ล็อกดีบักไว้ให้ วิเคราะห์ได้ถ้ามีเคส token ค้าง
// ======================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLogs = exports.deleteRequestCascade = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// ใช้ instance เดียวที่ถูก initialize ที่ index.ts
const db = admin.firestore();
const bucket = admin.storage().bucket();
/** ตรวจ superadmin จาก custom claims */
function isSuperAdminFromClaims(token) {
    return !!(token?.role === "superadmin" || // เคสใหม่ ใช้สตริง role
        token?.superadmin === true || // เคสที่ตั้งธง boolean
        token?.roles?.superadmin === true // เคสเก็บแบบ object roles
    );
}
/** ตรวจ superadmin จาก Firestore (fallback เมื่อ token ยังไม่รีเฟรช) */
async function isSuperAdminFromDb(uid, email) {
    const collections = ["adminUsers", "admins"]; // รองรับได้ทั้งสองชื่อ
    for (const col of collections) {
        // 1) ด้วย uid ก่อน
        if (uid) {
            const snap = await db.collection(col).doc(uid).get();
            if (snap.exists) {
                const d = snap.data() || {};
                if (d.role === "superadmin" || d.superadmin === true || d?.roles?.superadmin)
                    return true;
            }
        }
        // 2) ด้วย email (รองลงมา)
        if (email) {
            const qs = await db.collection(col).where("email", "==", email).limit(1).get();
            if (!qs.empty) {
                const d = qs.docs[0].data() || {};
                if (d.role === "superadmin" || d.superadmin === true || d?.roles?.superadmin)
                    return true;
            }
        }
    }
    return false;
}
/** ตรวจ superadmin จากทั้งสองทาง */
async function assertSuperadminOrThrow(auth) {
    if (!auth) {
        throw new https_1.HttpsError("unauthenticated", "ต้องล็อกอินก่อน");
    }
    const token = auth.token || {};
    const uid = auth.uid;
    const email = token?.email;
    const byClaims = isSuperAdminFromClaims(token);
    if (byClaims)
        return; // ผ่านตั้งแต่ชั้น claims
    // ยังไม่ผ่าน → ลองเช็กที่ DB (กันเคส token ค้าง)
    const byDb = await isSuperAdminFromDb(uid, email);
    if (byDb)
        return;
    // ไม่ผ่านทั้งสองชั้น
    console.warn("[cleanup] deny: not superadmin", {
        uid, email, tokenRole: token?.role, tokenKeys: Object.keys(token || {}),
    });
    throw new https_1.HttpsError("permission-denied", "เฉพาะ superadmin เท่านั้น");
}
// ====== 1) ลบคำขอทั้งชุดตาม RID ======
exports.deleteRequestCascade = (0, https_1.onCall)({
    region: "asia-southeast1",
    timeoutSeconds: 540,
    memory: "1GiB",
}, async (req) => {
    const { data, auth } = req;
    await assertSuperadminOrThrow(auth);
    const rid = String(data?.rid ?? "").trim();
    if (!rid)
        throw new https_1.HttpsError("invalid-argument", "ต้องระบุ rid");
    const RID_OK = /^[A-Z0-9-]{6,60}$/i;
    if (!RID_OK.test(rid))
        throw new https_1.HttpsError("invalid-argument", "รูปแบบ rid ไม่ถูกต้อง");
    const docRef = db.doc(`requests/${rid}`);
    // ลบ Firestore (รวม subcollections)
    await admin.firestore().recursiveDelete(docRef);
    // ลบไฟล์ Storage ใต้ prefix เดียวกัน
    const prefix = `requests/${rid}/`;
    const [files] = await bucket.getFiles({ prefix });
    if (files.length) {
        await bucket.deleteFiles({ prefix });
    }
    console.log("[cleanup] cascade deleted", { rid, files: files.length });
    return { ok: true, rid, deleted: { firestore: true, storageFiles: files.length } };
});
// ====== 2) ลบ Logs ======
exports.deleteLogs = (0, https_1.onCall)({
    region: "asia-southeast1",
    timeoutSeconds: 540,
    memory: "1GiB",
}, async (req) => {
    const { data, auth } = req;
    await assertSuperadminOrThrow(auth);
    const collectionPath = String(data?.collectionPath || "logs");
    const mode = String(data?.mode || "all");
    let q = db.collection(collectionPath);
    if (mode === "byRid") {
        const rid = String(data?.rid ?? "").trim();
        if (!rid)
            throw new https_1.HttpsError("invalid-argument", "ต้องระบุ rid");
        q = q.where("rid", "==", rid);
    }
    else if (mode === "before") {
        const ts = data?.ts;
        let d;
        if (typeof ts === "number")
            d = new Date(ts);
        else if (typeof ts === "string")
            d = new Date(ts);
        else
            throw new https_1.HttpsError("invalid-argument", "ต้องระบุ ts");
        q = q.where("createdAt", "<=", d);
    }
    else if (mode !== "all") {
        throw new https_1.HttpsError("invalid-argument", "โหมดไม่ถูกต้อง");
    }
    const BATCH = 400;
    let total = 0;
    while (true) {
        const snap = await q.limit(BATCH).get();
        if (snap.empty)
            break;
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        total += snap.size;
        if (snap.size < BATCH)
            break;
    }
    console.log("[cleanup] logs deleted", { mode, collectionPath, total });
    return { ok: true, collectionPath, mode, deleted: total };
});
