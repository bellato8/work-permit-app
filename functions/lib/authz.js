"use strict";
// ======================================================================
// File: functions/src/authz.ts
// เวอร์ชัน: 2025-09-19 21:35
// หน้าที่: ตัวช่วย Authorization (ออโทไรเซชัน/ส่วนอนุญาต) + RBAC (อาร์บีเอซี/สิทธิ์ตามบทบาท)
// เชื่อม auth ผ่าน "firebase-admin" (เวอริไฟโทเค็น/verifyIdToken)
// หมายเหตุ:
//   - อ่าน admins/{emailLower} เพื่อตรวจ enabled + role + caps (แคปส์/สิทธิ์ย่อย)
//   - รองรับ alias ของสิทธิ์: approve|decide|manage_requests (สะกดเดิม) และ manageRequests (คาเมลเคส)
//   - ตรวจ Firebase ID Token จาก Authorization (ออโทรไรเซชัน/ส่วนอนุญาต): Bearer <idToken>
//   - ถ้ามี header x-requester-email (เอ็กซ์-รีเควสเตอร์-อีเมล) ต้องตรงกับ email ใน token
//   - คงฟังก์ชันเดิม: checkCanManageUsers() เพื่อเข้ากันได้กับโค้ดเก่า
// วันที่/เดือน/ปี เวลา: 19/09/2025 21:35 (เวลาไทย)
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
exports.readAdminDoc = readAdminDoc;
exports.getRequesterEmail = getRequesterEmail;
exports.requireFirebaseUser = requireFirebaseUser;
exports.requireCaps = requireCaps;
exports.checkCanManageUsers = checkCanManageUsers;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
// ---------- utils เล็ก ๆ ----------
function emailKey(email) {
    return (email || "").trim().toLowerCase();
}
function normalizeCaps(caps) {
    const c = typeof caps === "object" && caps ? caps : {};
    return {
        ...c,
        // แปลง alias ให้เป็นคีย์มาตรฐาน (เพื่ออ่านง่ายทั้งเก่า/ใหม่)
        viewAll: typeof c.viewAll === "boolean" ? c.viewAll : !!c.view_all,
        manageUsers: typeof c.manageUsers === "boolean" ? c.manageUsers : !!c.manage_users,
        manageRequests: typeof c.manageRequests === "boolean" ? c.manageRequests : !!c.manage_requests,
        approve: typeof c.approve === "boolean" ? c.approve : !!c.can_approve,
        decide: typeof c.decide === "boolean" ? c.decide : !!c.can_decide,
    };
}
async function readAdminDoc(email) {
    const id = emailKey(email);
    const snap = await admin.firestore().collection("admins").doc(id).get();
    return snap.exists ? snap.data() : undefined;
}
/** อ่านอีเมลผู้เรียกจาก header/query/body หากไม่ใช่อีเมลให้คืน undefined */
function getRequesterEmail(req) {
    const h = String(req.get?.("x-requester-email") || req.headers?.["x-requester-email"] || "").trim();
    const q = String(req.query?.requester || "").trim();
    const b = String(req.body?.requester || "").trim();
    const v = (h || q || b || "").toLowerCase();
    return /.+@.+\..+/.test(v) ? v : undefined;
}
/** ตรวจสอบ Firebase ID Token และคืนข้อมูลผู้ใช้ที่ยืนยันแล้ว (ฝั่งเซิร์ฟเวอร์) */
async function requireFirebaseUser(req) {
    try {
        const authz = String(req.headers?.authorization || "");
        const m = authz.match(/^Bearer\s+(.+)$/i);
        if (!m)
            return { ok: false, status: 401, error: "unauthorized: missing_bearer" };
        const decoded = await admin.auth().verifyIdToken(m[1], true);
        const email = (decoded.email || "").toLowerCase();
        if (!email)
            return { ok: false, status: 401, error: "unauthorized: no_email_in_token" };
        // ถ้ามี header x-requester-email ต้องตรงกับ email ใน token
        const hdr = getRequesterEmail(req);
        if (hdr && hdr !== email) {
            return { ok: false, status: 403, error: "forbidden: header_email_mismatch" };
        }
        // โหลดเอกสาร admin
        const doc = await readAdminDoc(email);
        if (!doc)
            return { ok: false, status: 403, error: "forbidden: not_admin" };
        if (doc.enabled === false)
            return { ok: false, status: 403, error: "forbidden: disabled" };
        return {
            ok: true,
            status: 200,
            email,
            uid: decoded.uid,
            role: String(doc.role || "").toLowerCase(),
            caps: normalizeCaps(doc.caps),
        };
    }
    catch (e) {
        // หมายเหตุ: โทเค็นหมดอายุ/ไม่ถูกต้อง → 401
        return { ok: false, status: 401, error: "unauthorized: bad_token" };
    }
}
/**
 * บังคับ RBAC: ต้องมีอย่างน้อยหนึ่งในสิทธิ์ที่ระบุ (หรือเป็น superadmin)
 * ตัวอย่าง anyOfCaps = ["approve","decide","manage_requests"]
 * หมายเหตุ: รองรับทั้ง manage_requests และ manageRequests (compat)
 */
async function requireCaps(req, anyOfCaps) {
    const who = await requireFirebaseUser(req);
    if (!who.ok)
        return who;
    const { role, caps } = who;
    if (role === "superadmin")
        return who;
    // ให้ผ่านเมื่อมีสิทธิ์อย่างน้อยหนึ่งตัวในกลุ่ม "อนุมัติ/ตัดสินใจ/จัดการคำขอ"
    const granted = !!caps.approve ||
        !!caps.decide ||
        !!caps.manageRequests ||
        !!caps.manage_requests;
    if (!granted) {
        return { ok: false, status: 403, error: "forbidden: missing_required_caps" };
    }
    return who;
}
/** เข้ากันได้กับโค้ดเก่า: ต้องมีสิทธิ์ manageUsers หรือเป็น superadmin */
async function checkCanManageUsers(req) {
    const who = await requireFirebaseUser(req);
    if (!who.ok)
        return who;
    const { role, caps } = who;
    if (role === "superadmin" || !!caps.manageUsers)
        return who;
    return { ok: false, status: 403, error: "forbidden: need_manage_users" };
}
