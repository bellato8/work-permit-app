"use strict";
// ======================================================================
// File: functions/src/authz.ts
// เวอร์ชัน: 2025-10-24 (No-dep timezone fix; DailyOps + pagePermissions fallback)
// ผู้เขียน: ChatGPT — ปรับปรุงด่านตรวจสิทธิ์ให้รองรับทั้ง caps และ pagePermissions
// จุดประสงค์:
//   1) ลด 403 'insufficient_permissions' เมื่อเอกสาร admin ไม่มี caps
//   2) เพิ่ม fallback mapping จาก pagePermissions/permissions → caps อัตโนมัติ
//   3) superadmin override ผ่านทุกด่านที่เกี่ยว
//   4) (อัปเดต) ไม่ใช้ luxon อีกต่อไป — ใช้ Intl.DateTimeFormat คำนวณ 'วันนี้' ตาม timezone
// การใช้งานร่วมกับ Endpoint:
//   - requireCaps(req, ['view_daily_ops']) ใช้แทนเดิมได้เลย (มี fallback map ให้)
//   - สำหรับ Daily Operations แนะนำใช้:
//       canViewDailyOps(adminDoc, dateISO)
//       canCheckInOut(adminDoc)
//       canViewDailyCalendar(adminDoc)
// หมายเหตุ:
//   - admin.initializeApp() ถูกย้ายไปไฟล์ index.ts ตามเดิมแล้ว
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
exports.canViewDailyOps = canViewDailyOps;
exports.canCheckInOut = canCheckInOut;
exports.canViewDailyCalendar = canViewDailyCalendar;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
// --- สำคัญ! ---
// เราได้ย้าย admin.initializeApp() ไปไว้ที่ไฟล์ index.ts ซึ่งเป็นไฟล์เริ่มต้น
// ไฟล์นี้จึงไม่ต้อง initialize เองอีกต่อไป
const CHECK_REVOKED = process.env.CHECK_REVOKED !== "0";
// ----------------------------- Utilities -------------------------------
function emailKey(email) {
    return (email || "").trim().toLowerCase();
}
/** map ฟิลด์ caps เก่า → ใหม่ (กรณีสะกดต่างรูปแบบ) */
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
/** อ่านเอกสาร admin ตามอีเมล */
async function readAdminDoc(email) {
    const id = emailKey(email);
    const snap = await admin.firestore().collection("admins").doc(id).get();
    return snap.exists ? snap.data() : undefined;
}
/** อ่าน x-requester-email จาก header/query/body (ใช้ตอน service-to-service หรือ debug) */
function getRequesterEmail(req) {
    const h = String(req.get?.("x-requester-email") || req.headers?.["x-requester-email"] || "").trim();
    const q = String(req.query?.requester || "").trim();
    const b = String(req.body?.requester || "").trim();
    const v = (h || q || b || "").toLowerCase();
    return /.+@.+\..+/.test(v) ? v : undefined;
}
/** decode payload แบบไม่ verify (เพื่อ log ช่วย debug เท่านั้น) */
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
/** คืน YYYY-MM-DD ของ 'ตอนนี้' ใน timezone ที่กำหนด โดยไม่พึ่งไลบรารีภายนอก */
function isoDateInZoneNow(tz) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value || "";
    const m = parts.find((p) => p.type === "month")?.value || "";
    const d = parts.find((p) => p.type === "day")?.value || "";
    return `${y}-${m}-${d}`; // รูปแบบ en-CA = YYYY-MM-DD
}
/** สร้างชุด caps ที่ 'สมเหตุสมผล' โดย map จาก pagePermissions/permissions หาก caps ขาด */
function synthesizeCaps(doc) {
    const out = {};
    const src = normalizeCaps(doc?.caps);
    // 1) เริ่มจาก caps ที่มีอยู่แล้ว
    for (const [k, v] of Object.entries(src))
        out[k] = v === true;
    // 2) superadmin override — ผ่านทุกด่านสำคัญ
    if (doc?.role === "superadmin") {
        out["view_daily_ops"] = true;
        out["view_calendar"] = true;
        out["checkInOut"] = true;
        out["view_dashboard"] = true;
        out["view_logs"] = true;
        out["view_permits"] = true;
        out["view_reports"] = true;
    }
    // 3) เติมจาก pagePermissions/permissions ถ้ายังไม่มีค่าใน caps
    const pOps = doc?.pagePermissions?.ops;
    const pDaily = doc?.pagePermissions?.dailyWork;
    const pOld = doc?.permissions;
    // Daily Operations (ดูรายการรายวัน)
    if (out["view_daily_ops"] !== true) {
        out["view_daily_ops"] = !!(pDaily?.canView ||
            pOps?.view_today ||
            pOps?.view_anyday ||
            pOld?.viewTodayWork ||
            pOld?.viewOtherDaysWork);
    }
    // ปฏิทินรายวัน (ใช้สิทธิ์ดู daily เป็นตัวแทน ถ้ายังไม่มีคีย์แยก)
    if (out["view_calendar"] !== true) {
        out["view_calendar"] = !!(pDaily?.canView || pOps?.view_today || pOps?.view_anyday);
    }
    // เช็กอิน/เอาต์
    if (out["checkInOut"] !== true) {
        out["checkInOut"] = !!(pOps?.checkin ||
            pOps?.checkout ||
            pDaily?.canCheckIn ||
            pDaily?.canCheckOut ||
            pOld?.checkInOut);
    }
    // Dashboard/logs/permits/reports (พื้นฐาน map ตาม canView)
    if (out["view_dashboard"] !== true)
        out["view_dashboard"] = !!doc?.pagePermissions?.dashboard?.canView;
    if (out["view_logs"] !== true)
        out["view_logs"] = !!doc?.pagePermissions?.logs?.canView;
    if (out["view_permits"] !== true)
        out["view_permits"] = !!doc?.pagePermissions?.permits?.canView;
    if (out["view_reports"] !== true)
        out["view_reports"] = !!doc?.pagePermissions?.reports?.canView;
    return out;
}
/** ตรวจสอบ token → โหลดเอกสาร admin → คืน GateOk/GateFail */
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
        // ป้องกันสวมรอย: หากมี header ผู้ร้องขอ ให้ตรงกับ token เสมอ
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
        // ✅ เติม caps ที่สังเคราะห์แล้ว (รวม superadmin override + fallback pagePermissions)
        const finalCaps = synthesizeCaps(doc);
        return {
            ok: true,
            status: 200,
            email,
            uid: decoded.uid,
            role: String(doc.role || "").toLowerCase(),
            caps: finalCaps,
            timezone: doc.timezone || "Asia/Bangkok",
            pagePermissions: doc.pagePermissions,
            permissions: doc.permissions,
        };
    }
    catch (e) {
        const code = e?.code || e?.errorInfo?.code || "verify_failed";
        const msg = e?.message || e?.errorInfo?.message || String(e);
        logger.error("[authz] verify_failed", { code, msg });
        return { ok: false, status: 401, error: `unauthorized: ${code}` };
    }
}
/** ตรวจว่ามี caps ที่ต้องการ 'อย่างน้อยหนึ่ง' หรือไม่ (รองรับ both camelCase/underscore) */
async function requireCaps(req, anyOfCaps // ใช้จริงตามที่ระบุมา (ต่างจากเวอร์ชันเดิม)
) {
    const who = await requireFirebaseUser(req);
    if (!who.ok)
        return who;
    const { role, caps } = who;
    if (role === "superadmin")
        return who; // ✅ superadmin ผ่านเสมอ
    // รองรับชื่อคีย์ 2 รูปแบบ เช่น "manageRequests" หรือ "manage_requests"
    const has = (key) => !!caps[key] || !!caps[key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)];
    const requiredList = Array.isArray(anyOfCaps) && anyOfCaps.length > 0
        ? anyOfCaps
        : ["approve", "decide", "manageRequests", "manage_requests"]; // fallback เดิม
    const granted = requiredList.some((k) => has(k));
    if (!granted) {
        logger.warn("[requireCaps] missing_required_caps", { email: who.email, requiredList });
        return { ok: false, status: 403, error: "forbidden: missing_required_caps" };
    }
    return who;
}
/** ตัวอย่างการเช็กสิทธิ์เฉพาะ use-case: จัดการผู้ใช้ */
async function checkCanManageUsers(req) {
    const who = await requireFirebaseUser(req);
    if (!who.ok)
        return who;
    const { role, caps } = who;
    if (role === "superadmin" || !!caps.manageUsers || !!caps["manage_users"])
        return who;
    return { ok: false, status: 403, error: "forbidden: need_manage_users" };
}
// ---------------------- Daily Ops Specific Helpers ---------------------
/** คืน true ถ้าผู้ใช้มองเห็นข้อมูลงานประจำวันของ dateISO ได้ (รองรับ timezone) */
function canViewDailyOps(adminDoc, dateISO) {
    if (!adminDoc)
        return false;
    if (adminDoc.role === "superadmin")
        return true;
    const caps = synthesizeCaps(adminDoc);
    if (caps["view_daily_ops"] === true)
        return true;
    // เทียบ 'วันนี้' ตาม timezone ผู้ใช้ (ไม่ใช้ luxon)
    const tz = adminDoc.timezone || "Asia/Bangkok";
    const today = isoDateInZoneNow(tz); // YYYY-MM-DD
    if (dateISO === today) {
        // ถ้าวันนี้ แต่สิทธิ์ดูเฉพาะวันนี้ (จาก pagePermissions) ก็ผ่าน
        const pOps = adminDoc.pagePermissions?.ops;
        const pDaily = adminDoc.pagePermissions?.dailyWork;
        const pOld = adminDoc.permissions;
        const viewToday = !!(pOps?.view_today || pDaily?.canView || pOld?.viewTodayWork);
        if (viewToday)
            return true;
    }
    // ถ้าไม่ใช่วันนี้ ต้องมีสิทธิ์ดูวันอื่น ๆ
    const pOps = adminDoc.pagePermissions?.ops;
    const pDaily = adminDoc.pagePermissions?.dailyWork;
    const pOld = adminDoc.permissions;
    const viewAny = !!(pOps?.view_anyday || pDaily?.canViewOtherDays || pOld?.viewOtherDaysWork);
    if (viewAny)
        return true;
    return false;
}
/** คืน true ถ้ามีสิทธิ์เช็กอิน/เช็กเอาต์ */
function canCheckInOut(adminDoc) {
    if (!adminDoc)
        return false;
    if (adminDoc.role === "superadmin")
        return true;
    const caps = synthesizeCaps(adminDoc);
    return !!caps["checkInOut"];
}
/** คืน true ถ้าเห็นมุมมองปฏิทินของงานประจำวัน */
function canViewDailyCalendar(adminDoc) {
    if (!adminDoc)
        return false;
    if (adminDoc.role === "superadmin")
        return true;
    const caps = synthesizeCaps(adminDoc);
    if (caps["view_calendar"] === true)
        return true;
    // ใช้สิทธิ์ดู daily เป็นตัวแทน
    return !!(adminDoc.pagePermissions?.dailyWork?.canView ||
        adminDoc.pagePermissions?.ops?.view_today ||
        adminDoc.pagePermissions?.ops?.view_anyday);
}
// ======================================================================
// จบไฟล์
// ตัวอย่างการใช้งานใน handler (แนวคิด):
//   const who = await requireCaps(req, ['view_daily_ops']);
//   if (!who.ok) return res.status(who.status).json({ code: who.error });
//
//   // หรือเฉพาะ Daily Ops:
//   const adminDoc = await readAdminDoc(who.email);
//   if (!canViewDailyOps(adminDoc, date)) return res.status(403).json({ code: 'insufficient_permissions' });
// ======================================================================
