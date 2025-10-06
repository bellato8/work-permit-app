"use strict";
// ======================================================================
// File: functions/src/logAuth.ts
// เวอร์ชัน: 2025-10-06 (Asia/Bangkok)
// หน้าที่: รับ POST แล้วเขียนเหตุการณ์ auth ลง auditLogs (append-only) ผ่าน emitAudit
// การยืนยันตัวตน: ใช้ Authorization: Bearer <ID_TOKEN> (ไม่ใช้ x-api-key แล้ว)
// หมายเหตุ: ให้ใช้ res.json(...); return; เพื่อความชัดเจนใน onRequest (v2)
// อ้างอิงแนวทาง: เว็บแนบ ID Token → ฝั่งเซิร์ฟเวอร์ verifyIdToken ด้วย Admin SDK
//   - Verify ID Tokens (Admin SDK): https://firebase.google.com/docs/auth/admin/verify-id-tokens
//   - HTTP Cloud Functions v2 (onRequest): https://firebase.google.com/docs/functions/http-events
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
exports.logAuth = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const withCors_1 = require("./withCors");
const emitAudit_1 = require("./lib/emitAudit");
// initialize admin (ครั้งเดียวพอ)
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
// ให้ Firestore พร้อมใช้งานสำหรับ emitAudit ภายใน
(0, firestore_1.getFirestore)();
const REGION = "asia-southeast1";
/** ดึง Bearer token จากหัวข้อ Authorization */
function readBearer(req) {
    const authz = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
    if (!authz)
        return null;
    const m = /^Bearer\s+(.+)$/i.exec(authz);
    return m?.[1]?.trim() || null;
}
/** ล้างค่า undefined ทุกชั้น (ไม่แตะ "" หรือ null) */
function trimUndefDeep(v) {
    if (Array.isArray(v)) {
        return v.map((x) => trimUndefDeep(x)).filter((x) => x !== undefined);
    }
    if (v && typeof v === "object") {
        const out = {};
        for (const [k, val] of Object.entries(v)) {
            const t = trimUndefDeep(val);
            if (t !== undefined)
                out[k] = t;
        }
        return out;
    }
    return v;
}
/** เอา IP ตัวแรกจาก X-Forwarded-For (ตัวลูกค้าจริงตามลำดับผ่าน LB) */
function readClientIp(req) {
    const xff = req.headers["x-forwarded-for"];
    const raw = Array.isArray(xff) ? xff[0] : String(xff || "");
    const first = raw.split(",")[0]?.trim();
    return first || undefined;
}
exports.logAuth = (0, https_1.onRequest)({ region: REGION, timeoutSeconds: 60, memory: "256MiB" }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).json({ ok: false, error: "method_not_allowed" });
            return;
        }
        // ===== 1) ตรวจบัตรผ่าน (ID Token) =====
        const bearer = readBearer(req);
        if (!bearer) {
            res.status(401).json({ ok: false, error: "missing_authorization" });
            return;
        }
        let decoded;
        try {
            decoded = await (0, auth_1.getAuth)().verifyIdToken(bearer); // ตรวจลายเซ็น/อายุบัตร
        }
        catch (e) {
            logger.warn("[logAuth] invalid_id_token", { err: e?.message });
            res.status(401).json({ ok: false, error: "invalid_authorization" });
            return;
        }
        const requesterEmail = (decoded && decoded.email) || req.headers["x-requester-email"];
        if (!requesterEmail) {
            res.status(403).json({ ok: false, error: "requester_email_required" });
            return;
        }
        // ===== 2) อ่านเนื้อหาจาก body (แบบปลอดภัย) =====
        const b = typeof req.body === "object" && req.body ? req.body : {};
        const action = String(b.action ?? "manual").toLowerCase();
        const acctEmail = typeof b.email === "string" ? b.email.trim() : "";
        const acctName = typeof b.name === "string" ? b.name.trim() : "";
        const rid = typeof b.rid === "string" ? b.rid.trim() : "";
        const note = typeof b.note === "string" ? b.note.trim() : "";
        // ===== 3) รวบรวมรายละเอียดเสริม =====
        const ip = readClientIp(req);
        const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;
        // by = ผู้สั่งบันทึก (เชื่อถือจากโทเคน)
        const by = trimUndefDeep({
            email: requesterEmail,
            // ถ้ามีเคยใส่ role ใน custom claims ก็อ่านได้จาก decoded (ไม่บังคับ)
            role: decoded?.role || decoded?.roles?.role || undefined,
        });
        // target = เป้าหมายเหตุการณ์ (auth)
        const target = trimUndefDeep({
            type: "auth",
            rid: rid || undefined,
            id: acctEmail || undefined, // อีเมลบัญชีที่เกี่ยวข้อง (ถ้ามี)
        });
        const extra = trimUndefDeep({
            email: acctEmail || undefined,
            name: acctName || undefined,
            ip,
            ua,
            method: req.method,
            byUid: decoded?.uid || undefined,
        });
        // ===== 4) บันทึกลง auditLogs =====
        const id = await (0, emitAudit_1.emitAudit)(action, by, target, note || undefined, extra);
        res.status(200).json({ ok: true, id });
        return;
    }
    catch (e) {
        logger.error("[logAuth] internal_error", { err: e?.message || String(e) });
        res.status(500).json({ ok: false, error: "internal_error" });
        return;
    }
}));
