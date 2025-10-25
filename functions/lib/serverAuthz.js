"use strict";
/* ============================================================================
 * ไฟล์: functions/src/serverAuthz.ts
// เวอร์ชัน: 2025-10-25 (RBAC Fix - รองรับ pagePermissions)
 * บทบาทไฟล์ (role): ตัวช่วยตรวจสิทธิฝั่งเซิร์ฟเวอร์สำหรับฟังก์ชันแอดมิน (Users)
 * เปลี่ยนแปลงรอบนี้:
 *   • เพิ่มฟังก์ชันรวมศูนย์เพื่อตรวจสิทธิ manage_users ก่อนทำงาน
 *   • เพิ่มตัวช่วยลบค่า undefined ออกจากอ็อบเจกต์ก่อนเขียน Firestore (sanitize)
 *   • รวม util อ่าน header/query/ip/ua ให้ทุกฟังก์ชันเรียกเหมือนกัน
 * คำสำคัญ (English → Thai/phonetic/meaning):
 *   • Authorization (ออ-ธอ-ไร-เซ-ชั่น) = กระบวนการตรวจสิทธิ์อนุญาต (n.)
 *   • Header (เฮด-เดอร์) = ส่วนข้อมูลหัวของ HTTP request/response (n.)
 *   • Permission (เพอ-มิช-ชั่น) = สิทธิ์ย่อย เช่น manage_users (n.)
 *   • Role (โรล) = บทบาท เช่น superadmin/admin/... (n.)
 *   • Sanitize (แซน-นิ-ไทซ์) = ทำข้อมูลให้ถูกฟอร์แมต/ปลอดภัยก่อนบันทึก (v.)
 *   • CORS (คอร์ส) = กติกาเรียกข้ามโดเมน (n.)
 * หมายเหตุความปลอดภัย: อย่าฝัง secret ในโค้ด ให้ดึงจาก ENV/Secret Manager เสมอ
 * ผู้เขียน: AI ผู้ช่วย (โหมดจับมือทำ)
 * ========================================================================== */
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
exports.readKey = readKey;
exports.readRequester = readRequester;
exports.ipOf = ipOf;
exports.uaOf = uaOf;
exports.originOf = originOf;
exports.emailKey = emailKey;
exports.omitUndefined = omitUndefined;
exports.loadAdminByEmailLower = loadAdminByEmailLower;
exports.hasManageUsers = hasManageUsers;
exports.requireManageUsers = requireManageUsers;
exports.applyCors = applyCors;
exports.jsonOK = jsonOK;
exports.jsonErr = jsonErr;
const admin = __importStar(require("firebase-admin"));
// ---------- ตัวช่วยอ่าน/แปลงค่าจาก request ----------
function readKey(req) {
    return String(req.get?.("x-api-key") ||
        req.get?.("x-approver-key") ||
        req.query?.key ||
        req.body?.key ||
        "").trim();
}
function readRequester(req) {
    const v = String(req.get?.("x-requester-email") || req.query?.requester || req.body?.requester || "").trim();
    return v.toLowerCase();
}
function ipOf(req) {
    const x = String(req?.headers?.["x-forwarded-for"] || "");
    return (x.split(",")[0] || req?.socket?.remoteAddress || "").trim() || undefined;
}
function uaOf(req) {
    return String(req?.headers?.["user-agent"] || "") || undefined;
}
function originOf(req) {
    return String(req?.headers?.origin || req?.headers?.referer || "") || undefined;
}
function emailKey(email) {
    return (email || "").trim().toLowerCase();
}
// ---------- sanitize: ตัด undefined ทิ้ง (รองรับซ้อนหลายชั้น) ----------
function omitUndefined(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (Array.isArray(obj)) {
        // @ts-ignore
        return obj.map((v) => omitUndefined(v));
    }
    if (typeof obj === "object") {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined)
                continue;
            out[k] = omitUndefined(v);
        }
        return out;
    }
    return obj;
}
// ---------- โหลดข้อมูล admin จาก Firestore ----------
async function loadAdminByEmailLower(emailLower) {
    if (!admin.apps.length)
        admin.initializeApp();
    const db = admin.firestore();
    const id = emailKey(emailLower);
    if (!id)
        return null;
    const snap = await db.collection("admins").doc(id).get();
    if (!snap.exists)
        return null;
    const data = (snap.data() || {});
    // normalize
    const role = String((data.role || "")).toLowerCase();
    return {
        ...data,
        emailLower: id,
        role,
        enabled: typeof data.enabled === "boolean" ? data.enabled : true,
        caps: data.caps || {},
    };
}
// ---------- ตรวจสิทธิ์ manage_users ----------
function hasManageUsers(a) {
    if (!a)
        return false;
    const role = String(a.role || "").toLowerCase();
    if (role === "superadmin")
        return true;
    // ✅ เช็คจาก caps เดิมก่อน
    const caps = (a.caps || {});
    if (caps.manageUsers === true || caps.manage_users === true)
        return true;
    // ✅ Fallback จาก pagePermissions
    const pp = a.pagePermissions;
    if (pp?.users?.canEdit || pp?.users?.canCreate || pp?.users?.canDelete)
        return true;
    return false;
}
/**
 * ใช้ในฟังก์ชัน onRequest ช่วงต้น
 * ผ่านแล้วคืน AdminDoc ของ requester; ไม่ผ่านจะตอบ 403 และคืน null
 */
async function requireManageUsers(req, res) {
    const requester = readRequester(req);
    if (!requester) {
        res.status(403).json({ ok: false, error: "forbidden: missing requester" });
        return null;
    }
    const a = await loadAdminByEmailLower(requester);
    if (!a || a.enabled === false) {
        res.status(403).json({ ok: false, error: "forbidden: requester disabled or not found" });
        return null;
    }
    if (!hasManageUsers(a)) {
        res.status(403).json({ ok: false, error: "forbidden: need manage_users" });
        return null;
    }
    return a;
}
// ---------- ช่วยตอบ CORS ขั้นพื้นฐาน (ถ้ายังไม่ได้ใช้ middleware อื่น) ----------
const ALLOW_ORIGINS = new Set([
    "http://localhost:5173",
    "https://staging.imperialworld.asia",
    "https://imperialworld.asia",
]);
function applyCors(req, res) {
    const origin = originOf(req);
    if (origin && ALLOW_ORIGINS.has(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
    }
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, x-api-key, x-requester-email");
    res.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    res.set("Access-Control-Max-Age", "600");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true; // จบที่ preflight
    }
    return false;
}
// ---------- ตัวช่วยตอบ JSON มาตรฐาน ----------
function jsonOK(res, data = {}) {
    res.json({ ok: true, ...data });
}
function jsonErr(res, status, message, extra) {
    res.status(status).json({ ok: false, error: message, ...(extra || {}) });
}
