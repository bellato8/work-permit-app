"use strict";
// ======================================================================
// File: functions/src/authz.ts
// เวอร์ชัน: 2025-10-08 (Recommended Final Version)
// หน้าที่: ตัวกลางตรวจสอบสิทธิ์ (Authorization Middleware) สำหรับ Cloud Functions
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
const logger = __importStar(require("firebase-functions/logger"));
// --- สำคัญ! ---
// เราได้ย้าย admin.initializeApp() ไปไว้ที่ไฟล์ index.ts ซึ่งเป็นไฟล์เริ่มต้น
// ไฟล์นี้จึงไม่ต้อง initialize เองอีกต่อไป
const CHECK_REVOKED = process.env.CHECK_REVOKED !== "0";
function emailKey(email) {
    return (email || "").trim().toLowerCase();
}
function normalizeCaps(caps) {
    const c = typeof caps === "object" && caps ? caps : {};
    return {
        ...c,
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
function getRequesterEmail(req) {
    const h = String(req.get?.("x-requester-email") || req.headers?.["x-requester-email"] || "").trim();
    const q = String(req.query?.requester || "").trim();
    const b = String(req.body?.requester || "").trim();
    const v = (h || q || b || "").toLowerCase();
    return /.+@.+\..+/.test(v) ? v : undefined;
}
function decodePayloadUnsafe(token) {
    try {
        if (!token)
            return;
        const seg = (token.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/");
        const json = Buffer.from(seg, "base64").toString("utf8");
        return JSON.parse(json);
    }
    catch {
        return;
    }
}
async function requireFirebaseUser(req) {
    try {
        const authz = String(req.headers?.authorization || "");
        const m = authz.match(/^Bearer\s+(.+)$/i);
        if (!m) {
            logger.warn("[authz] missing_bearer");
            return { ok: false, status: 401, error: "unauthorized: missing_bearer" };
        }
        const token = m[1].trim();
        const pre = decodePayloadUnsafe(token);
        if (pre?.iss || pre?.aud) {
            logger.debug("[authz] token_payload", { iss: pre.iss, aud: pre.aud, email: pre.email });
        }
        const decoded = await admin.auth().verifyIdToken(token, CHECK_REVOKED);
        const email = (decoded.email || "").toLowerCase();
        if (!email) {
            logger.warn("[authz] no_email_in_token");
            return { ok: false, status: 401, error: "unauthorized: no_email_in_token" };
        }
        const hdr = getRequesterEmail(req);
        if (hdr && hdr !== email) {
            logger.warn("[authz] header_email_mismatch", { hdr, email });
            return { ok: false, status: 403, error: "forbidden: header_email_mismatch" };
        }
        const doc = await readAdminDoc(email);
        if (!doc) {
            logger.warn("[authz] not_admin_doc", { email });
            return { ok: false, status: 403, error: "forbidden: not_admin" };
        }
        if (doc.enabled === false) {
            logger.warn("[authz] admin_disabled", { email });
            return { ok: false, status: 403, error: "forbidden: disabled" };
        }
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
        const code = e?.code || e?.errorInfo?.code || "verify_failed";
        const msg = e?.message || e?.errorInfo?.message || String(e);
        logger.error("[authz] verify_failed", { code, msg });
        return { ok: false, status: 401, error: `unauthorized: ${code}` };
    }
}
async function requireCaps(req, anyOfCaps) {
    const who = await requireFirebaseUser(req);
    if (!who.ok)
        return who;
    const { role, caps } = who;
    if (role === "superadmin")
        return who;
    const granted = !!caps.approve ||
        !!caps.decide ||
        !!caps.manageRequests ||
        !!caps.manage_requests;
    if (!granted) {
        return { ok: false, status: 403, error: "forbidden: missing_required_caps" };
    }
    return who;
}
async function checkCanManageUsers(req) {
    const who = await requireFirebaseUser(req);
    if (!who.ok)
        return who;
    const { role, caps } = who;
    if (role === "superadmin" || !!caps.manageUsers)
        return who;
    return { ok: false, status: 403, error: "forbidden: need_manage_users" };
}
