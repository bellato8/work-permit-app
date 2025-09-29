"use strict";
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
exports.deleteLogs = void 0;
// functions/src/deleteLogs.ts
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const emitAudit_1 = require("./lib/emitAudit");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const REGION = "asia-southeast1";
// ตรวจสิทธิ์แบบเดียวกับฝั่งเว็บ
function isSuperAdminLike(t) {
    const role = String(t?.role || "").toLowerCase();
    const caps = Array.isArray(t?.caps)
        ? t.caps.map((x) => String(x).toLowerCase())
        : [];
    return (role === "superadmin" ||
        t?.superadmin === true ||
        t?.superAdmin === true ||
        caps.includes("superadmin"));
}
async function deleteByQuery(label, q, step = 300) {
    let deleted = 0;
    while (true) {
        const snap = await q.limit(step).get();
        if (snap.empty)
            break;
        const batch = db.batch();
        for (const d of snap.docs)
            batch.delete(d.ref);
        await batch.commit();
        deleted += snap.size;
        if (snap.size < step)
            break;
    }
    logger.info(`[deleteLogs] ${label} deleted=${deleted}`);
    return deleted;
}
exports.deleteLogs = (0, https_1.onCall)({ region: REGION, timeoutSeconds: 540, memory: "512MiB" }, async (req) => {
    // --- auth guard ---
    const token = req.auth?.token;
    if (!token)
        throw new https_1.HttpsError("unauthenticated", "auth_required");
    if (!isSuperAdminLike(token))
        throw new https_1.HttpsError("permission-denied", "superadmin_required");
    const { mode, rid, ts } = req.data || {};
    if (!mode)
        throw new https_1.HttpsError("invalid-argument", "mode_required");
    let total = 0;
    if (mode === "all") {
        total += await deleteByQuery("auditLogs", db.collection("auditLogs").orderBy(firestore_1.FieldPath.documentId()));
        total += await deleteByQuery("audit_logs", db.collection("audit_logs").orderBy(firestore_1.FieldPath.documentId()));
        total += await deleteByQuery("logs", db.collection("logs").orderBy(firestore_1.FieldPath.documentId()));
    }
    if (mode === "byRid") {
        if (!rid?.trim())
            throw new https_1.HttpsError("invalid-argument", "rid_required");
        // auditLogs เก็บ rid อยู่ใน target.rid (ตามตัวรวม logs)
        total += await deleteByQuery("auditLogs.byRid", db.collection("auditLogs").where("target.rid", "==", rid.trim()));
        // audit_logs ใช้ requestId / rid
        total += await deleteByQuery("audit_logs.byRid", db.collection("audit_logs").where("requestId", "==", rid.trim()));
        total += await deleteByQuery("audit_logs.byRid2", db.collection("audit_logs").where("rid", "==", rid.trim()));
        // logs มีทั้ง rid บน root และใน details.rid
        total += await deleteByQuery("logs.byRid", db.collection("logs").where("rid", "==", rid.trim()));
        total += await deleteByQuery("logs.byRid.details", db.collection("logs").where("details.rid", "==", rid.trim()));
    }
    if (mode === "before") {
        let ms = null;
        if (typeof ts === "number") {
            ms = ts < 2e12 ? Math.round(ts * 1000) : Math.round(ts);
        }
        else if (typeof ts === "string") {
            const t = Date.parse(ts);
            ms = Number.isNaN(t) ? null : t;
        }
        if (ms == null)
            throw new https_1.HttpsError("invalid-argument", "ts_invalid");
        const T = firestore_1.Timestamp.fromMillis(ms);
        // auditLogs: เผื่อหลายชื่อฟิลด์เวลา
        for (const f of ["at", "createdAt", "timestamp", "time", "date"]) {
            total += await deleteByQuery(`auditLogs.before.${f}`, db.collection("auditLogs").where(f, "<=", T));
        }
        // audit_logs: พบใช้ timestamp/at/createdAt
        for (const f of ["timestamp", "at", "createdAt"]) {
            total += await deleteByQuery(`audit_logs.before.${f}`, db.collection("audit_logs").where(f, "<=", T));
        }
        // logs: timestamp / at / details.timestamp
        total += await deleteByQuery("logs.before.timestamp", db.collection("logs").where("timestamp", "<=", T));
        total += await deleteByQuery("logs.before.at", db.collection("logs").where("at", "<=", T));
        total += await deleteByQuery("logs.before.details.timestamp", db.collection("logs").where("details.timestamp", "<=", T));
    }
    // บันทึก audit
    try {
        await (0, emitAudit_1.emitAudit)("delete_logs", { email: token?.email || "unknown" }, { type: "logs" }, `mode=${mode}`, { rid, ts });
    }
    catch (e) {
        logger.warn("[deleteLogs] emitAudit failed", { err: e?.message });
    }
    return {
        ok: true,
        collectionPath: "auditLogs|audit_logs|logs",
        mode,
        deleted: total,
    };
});
