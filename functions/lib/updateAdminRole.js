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
exports.updateAdminRole = void 0;
// ============================================================================
// File: functions/src/updateAdminRole.ts
// Version: 2025-10-03  (CORS ปรับให้ยืดหยุ่น + อนุญาต x-requester-email/x-api-key)
// หน้าที่: อัปเดตบทบาท/สิทธิ์ผู้ดูแล (admins/*) โดยยึด “บัตรผ่าน (Bearer ID token)”
//          + เปิดสมุดสิทธิ์ Firestore ทุกครั้ง ตอบกลับภาษาคน
// นโยบายหลัก:
//   1) ใช้เฉพาะ Authorization: Bearer <ID_TOKEN> (ไม่พึ่ง x-requester-email เพื่อยืนยันตัวตน)
//   2) สิทธิ์จริงตัดสินจาก Firestore (admins/{emailLower}) ทุกคำขอ
//   3) 401 เมื่อยังไม่ล็อกอิน/บัตรหมดอายุ, 403 เมื่อสิทธิ์ไม่พอ
// ============================================================================
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const emitAudit_1 = require("./lib/emitAudit");
if (!admin.apps.length)
    admin.initializeApp();
// ---------- CORS ----------
const ALLOW_ORIGINS = new Set([
    "http://localhost:5173",
    "https://staging.imperialworld.asia",
    "https://imperialworld.asia",
]);
function mergeAllowHeaders(req) {
    // รวม whitelist พื้นฐาน + หัวข้อที่เบราว์เซอร์บอกว่าจะส่งมาในรอบเปิดทาง
    const base = [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "x-requester-email",
        "x-api-key",
    ];
    const asked = String(req.headers["access-control-request-headers"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const set = new Set([...base, ...asked]);
    return Array.from(set).join(", ");
}
function applyCors(req, res) {
    const origin = String(req.headers.origin || "");
    const allow = origin && ALLOW_ORIGINS.has(origin) ? origin : "*";
    res.setHeader("Access-Control-Allow-Origin", allow);
    res.setHeader("Vary", "Origin"); // กันคาเช่ผิดโดเมน
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", mergeAllowHeaders(req));
    res.setHeader("Access-Control-Max-Age", "600");
}
// ---------- ภาษาคนสำหรับข้อผิดพลาด ----------
function reply401(res, code, detail) {
    const catalog = {
        "auth/unauthenticated": { message: "ยังไม่ได้เข้าสู่ระบบ", hint: "กรุณาเข้าสู่ระบบแล้วลองใหม่" },
        "auth/invalid_token": { message: "ยืนยันตัวตนไม่สำเร็จ", hint: "กรุณาเข้าสู่ระบบใหม่" },
        "auth/expired": { message: "หมดเวลาใช้งานแล้ว", hint: "กรุณาเข้าสู่ระบบใหม่" },
        "auth/wrong_project": { message: "บัตรผ่านไม่ใช่ของระบบนี้", hint: "กรุณาออกจากระบบ แล้วเข้าสู่ระบบใหม่" },
    };
    const c = catalog[code] || catalog["auth/unauthenticated"];
    res.status(401).json({ ok: false, code, message: c.message, hint: c.hint, detail });
}
function reply403(res, code, need) {
    const catalog = {
        "auth/forbidden": { message: "คุณไม่มีสิทธิ์ทำรายการนี้", hint: "ติดต่อผู้ดูแลเพื่อขอสิทธิ์เพิ่ม" },
        "auth/need_manage_users": { message: "คุณไม่มีสิทธิ์จัดการผู้ใช้", hint: "ติดต่อผู้ดูแลเพื่อขอสิทธิ์ “จัดการผู้ใช้”" },
        "auth/disabled": { message: "บัญชีของคุณถูกปิดใช้งาน", hint: "ติดต่อผู้ดูแลระบบ" },
    };
    const c = catalog[code] || catalog["auth/forbidden"];
    res.status(403).json({ ok: false, code, message: c.message, hint: c.hint, need });
}
function reply400(res, code, field) {
    const catalog = {
        "bad_request": { message: "คำขอไม่ถูกต้อง", hint: "กรุณาลองใหม่" },
        "missing_email": { message: "กรุณาระบุอีเมลเป้าหมาย", hint: "ตรวจสอบช่องอีเมลแล้วลองใหม่" },
        "method_not_allowed": { message: "วิธีเรียกใช้งานไม่ถูกต้อง", hint: "ใช้แบบ POST เท่านั้น" },
    };
    const c = catalog[code] || catalog["bad_request"];
    res.status(code === "method_not_allowed" ? 405 : 400)
        .json({ ok: false, code, message: c.message, hint: c.hint, field });
}
// ---------- ยูทิล ----------
const emailKey = (email) => (email || "").trim().toLowerCase();
const ipOf = (req) => {
    const x = String(req.headers["x-forwarded-for"] || "");
    return (x.split(",")[0] || req.socket?.remoteAddress || "").trim() || undefined;
};
const uaOf = (req) => String(req.headers["user-agent"] || "") || undefined;
function cleanObject(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
        const v = obj[k];
        if (v !== undefined)
            out[k] = v;
    });
    return out;
}
// ตรวจสิทธิ์: ต้องเป็น superadmin หรือมี manageUsers/manage_users และ enabled ไม่เป็น false
async function ensureCanManageUsersByEmail(email) {
    const id = emailKey(email);
    const snap = await admin.firestore().collection("admins").doc(id).get();
    if (!snap.exists)
        return { ok: false, code: "auth/forbidden", reason: "not_in_admins" };
    const data = snap.data() || {};
    if (data.enabled === false)
        return { ok: false, code: "auth/disabled", reason: "requester_disabled" };
    const role = String(data.role || "").toLowerCase();
    const caps = (data.caps && typeof data.caps === "object") ? data.caps : {};
    const can = role === "superadmin" || !!caps.manageUsers || !!caps.manage_users;
    if (!can)
        return { ok: false, code: "auth/need_manage_users", reason: "need_manage_users" };
    return { ok: true };
}
// ดึงและตรวจบัตรผ่าน (ID token) จาก header แล้วคืนอีเมลผู้ร้องขอ
async function getRequesterEmailFromBearer(req) {
    const authz = String(req.get("Authorization") || req.get("authorization") || "");
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (!m)
        return null;
    const token = m[1];
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        const email = (decoded.email || "").toLowerCase();
        return email || null;
    }
    catch (e) {
        const msg = String(e?.message || "").toLowerCase();
        if (msg.includes("expired"))
            throw Object.assign(new Error("expired"), { code: "auth/expired" });
        if (msg.includes("project") || msg.includes("iss") || msg.includes("aud"))
            throw Object.assign(new Error("wrong_project"), { code: "auth/wrong_project" });
        throw Object.assign(new Error("invalid_token"), { code: "auth/invalid_token" });
    }
}
exports.updateAdminRole = (0, https_1.onRequest)({ region: "asia-southeast1" }, async (req, res) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        reply400(res, "method_not_allowed");
        return;
    }
    try {
        // 1) ตรวจบัตรผ่าน
        let requesterEmail = null;
        try {
            requesterEmail = await getRequesterEmailFromBearer(req);
            if (!requesterEmail) {
                reply401(res, "auth/unauthenticated");
                return;
            }
        }
        catch (e) {
            reply401(res, e?.code || "auth/invalid_token");
            return;
        }
        // 2) เปิดสมุดสิทธิ์ของผู้ร้องขอ
        const gate = await ensureCanManageUsersByEmail(requesterEmail);
        if (!gate.ok) {
            reply403(res, gate.code, gate.reason);
            return;
        }
        // 3) อ่านคำขอและตรวจเบื้องต้น
        const { email, role, caps, enabled, displayName } = req.body || {};
        if (!email || typeof email !== "string") {
            reply400(res, "missing_email", "email");
            return;
        }
        const emailLower = emailKey(email);
        // 4) (ไม่บังคับ) สร้าง/อัปเดตผู้ใช้ใน Firebase Auth ตาม displayName
        const auth = admin.auth();
        let uid;
        try {
            const u = await auth.getUserByEmail(emailLower);
            uid = u.uid;
            if (displayName && u.displayName !== displayName) {
                await auth.updateUser(uid, { displayName });
            }
        }
        catch {
            const u = await auth.createUser({
                email: emailLower,
                displayName: displayName || undefined,
                emailVerified: false,
                disabled: false,
            });
            uid = u.uid;
        }
        // 5) บันทึก Firestore (merge เฉพาะคีย์ที่ส่งมา)
        const updateData = {
            email: emailLower,
            emailLower: emailLower,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: requesterEmail,
        };
        if (typeof enabled === "boolean")
            updateData.enabled = enabled;
        if (role && typeof role === "string") {
            const normalized = role.toLowerCase().replace(/^super$/, "superadmin");
            updateData.role = ["superadmin", "admin", "approver", "viewer"].includes(normalized) ? normalized : "viewer";
        }
        if (caps && typeof caps === "object")
            updateData.caps = cleanObject(caps);
        await admin.firestore().collection("admins").doc(emailLower).set(updateData, { merge: true });
        // 6) จดบันทึกเหตุการณ์ (audit)
        await (0, emitAudit_1.emitAudit)("admin_caps_update", { email: requesterEmail }, { type: "admin", id: uid || emailLower, rid: emailLower }, "update admin caps/role", { ip: ipOf(req), ua: uaOf(req), role: updateData.role, enabled: updateData.enabled, caps: updateData.caps });
        res.json({ ok: true, email: emailLower, uid: uid || null });
    }
    catch (e) {
        res.status(500).json({
            ok: false,
            code: "server/error",
            message: "ระบบขัดข้องชั่วคราว",
            hint: "กรุณาลองใหม่อีกครั้ง",
            detail: String(e?.message || e),
        });
    }
});
