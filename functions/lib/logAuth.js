"use strict";
// ======================================================================
// File: functions/src/logAuth.ts
// เวอร์ชัน: 19/09/2025 03:20 (แก้ชนิดรีเทิร์นให้เป็น void, เพิ่ม type Request/Response, คง sanitize ลึก)
// หน้าที่: รับ POST แล้วเขียนเหตุการณ์ auth ลง auditLogs (append-only) ผ่าน emitAudit
// เชื่อม auth ผ่าน: Secret APPROVER_KEY + ต้องมี requester (หัวข้อหรือพารามิเตอร์)
// หมายเหตุ: ห้าม `return res.json(...)`; ให้ `res.json(...); return;` เพื่อให้ตรงกับ withCors(req,res)=>Promise<void>|void
// วันที่/เวลา: 19/09/2025 03:20
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
const params_1 = require("firebase-functions/params");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const withCors_1 = require("./withCors");
const emitAudit_1 = require("./lib/emitAudit");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
// ใช้เพื่อ initial Firestore (ไม่ใช้ตรง ๆ ในไฟล์นี้ แต่ช่วยให้ admin พร้อม)
(0, firestore_1.getFirestore)();
const REGION = "asia-southeast1";
const APPROVER_KEY = (0, params_1.defineSecret)("APPROVER_KEY"); // ผูก secret ระดับฟังก์ชัน (v2) — อ่านค่าด้วย .value()
/** ล้างค่า undefined ทุกชั้น (ไม่แตะค่าที่เป็น "" หรือ null) */
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
function readKey(req) {
    const h = req.headers;
    return (req.query?.key ||
        (req.body && req.body.key) ||
        h["x-api-key"] ||
        "").toString().trim();
}
function readRequester(req) {
    const h = req.headers;
    return (req.query?.requester ||
        (req.body && req.body.requester) ||
        h["x-requester-email"] ||
        "").toString().trim();
}
exports.logAuth = (0, https_1.onRequest)({ region: REGION, secrets: [APPROVER_KEY], timeoutSeconds: 60, memory: "256MiB" }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).json({ ok: false, error: "method_not_allowed" });
            return;
        }
        const key = readKey(req);
        const requester = readRequester(req);
        // ตรวจ Secret จาก defineSecret() (อ่านค่าด้วย APPROVER_KEY.value())
        if (!key || key !== APPROVER_KEY.value()) {
            res.status(403).json({ ok: false, error: "forbidden" });
            return;
        }
        if (!requester) {
            res.status(400).json({ ok: false, error: "requester_required" });
            return;
        }
        // ดึง body แบบปลอดภัย
        const b = typeof req.body === "object" && req.body ? req.body : {};
        const action = String(b.action ?? "manual").toLowerCase();
        const acctEmail = typeof b.email === "string" ? b.email : "";
        const acctName = typeof b.name === "string" ? b.name : "";
        const rid = typeof b.rid === "string" ? b.rid : "";
        const note = typeof b.note === "string" ? b.note : "";
        // ip / ua / method
        const xfwd = req.headers["x-forwarded-for"];
        const xfwdFirst = Array.isArray(xfwd) ? xfwd[0] : String(xfwd || "").split(",")[0].trim();
        const ip = (typeof b.ip === "string" && b.ip.trim()) ||
            (xfwdFirst ? xfwdFirst : undefined);
        const ua = typeof req.headers["user-agent"] === "string"
            ? req.headers["user-agent"]
            : undefined;
        // by = คนสั่งบันทึก (ผู้ดูแล/ระบบ)
        const by = trimUndefDeep({
            email: requester || undefined,
            role: "superadmin", // ถ้าอนาคตมี role จริง ค่อยแมพตาม claims
        });
        // target = เป้าหมายเหตุการณ์ (auth)
        const target = trimUndefDeep({
            type: "auth",
            rid: rid || undefined,
            id: acctEmail || undefined, // อีเมลบัญชีที่เกี่ยวข้อง (ถ้ามี)
        });
        // extra = ข้อมูลเสริม สำหรับ debug/ตรวจสอบภายหลัง
        const extra = trimUndefDeep({
            email: acctEmail || undefined,
            name: acctName || undefined,
            ip,
            ua,
            method: req.method,
        });
        // บันทึกลง auditLogs (append-only)
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
