"use strict";
// ======================================================================
// File: functions/src/adminUsers.ts (ปรับปรุงให้ listadmins ส่ง pagePermissions)
// เวอร์ชัน: 2025-10-15
// เปลี่ยนแปลง: เพิ่มการแนบคีย์ pagePermissions ในผลลัพธ์ listadmins
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
exports.removeAdmin = exports.updateAdminRole = exports.addAdmin = exports.listadmins = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const withCors_1 = require("./withCors");
const authz_1 = require("./authz");
// เช็คก่อนว่ามีการเปิด Firebase แล้วหรือยัง (ป้องกันเปิดซ้ำ)
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const auth = (0, auth_1.getAuth)();
// --- Config ---
const REGION = "asia-southeast1";
// ---------- Helpers ----------
function whoRequested(req) {
    const r = req.body?.requester ||
        req.query?.requester ||
        req.headers["x-requester-email"];
    return typeof r === "string" && r.includes("@") ? r : undefined;
}
function normalizeEmail(v) {
    const s = String(v || "").trim().toLowerCase();
    return /.+@.+\..+/.test(s) ? s : "";
}
function emailId(email) {
    return email.replace(/\//g, "_");
}
function ok(res, data) {
    res.json({ ok: true, data });
}
function fail(res, error, code = 400) {
    res.status(code).json({ ok: false, error });
}
function presetCaps(role) {
    const viewer = {
        view_permits: true,
        view_dashboard: true,
    };
    const approver = {
        ...viewer,
        review_requests: true,
        approve_requests: true,
        reject_requests: true,
        view_reports: true,
        view_logs: true,
    };
    const admin = {
        ...approver,
        manage_settings: true,
        export_sensitive: true,
    };
    const superadmin = {
        ...admin,
        manage_users: true,
        delete_requests: true,
    };
    switch ((role || "").toLowerCase()) {
        case "approver":
            return approver;
        case "admin":
            return admin;
        case "superadmin":
        case "super_admin":
            return superadmin;
        default:
            return viewer;
    }
}
function normalizeCapKey(k) {
    const m = (k || "").trim();
    switch (m) {
        case "viewAll":
        case "view_all":
            return "view_all";
        case "approve":
            return "approve_requests";
        case "reject":
            return "reject_requests";
        case "manageUsers":
            return "manage_users";
        case "manageRequests":
            return "review_requests";
        default:
            return m;
    }
}
function mergeCapsByRole(role, caps) {
    const base = presetCaps(role);
    if (!caps || typeof caps !== "object")
        return base;
    const extra = {};
    for (const [k, v] of Object.entries(caps)) {
        const key = normalizeCapKey(k);
        if (!key)
            continue;
        if (key === "view_all" && v) {
            extra.view_permits = true;
            extra.view_dashboard = true;
            extra.view_reports = true;
            extra.view_logs = true;
            continue;
        }
        extra[key] = !!v;
    }
    return { ...base, ...extra };
}
function errToString(e) {
    return e && (e.stack || e.message) ? e.stack || e.message : String(e);
}
// ======================================================================
// 1) listadmins (GET/POST)
//    ✅ เพิ่ม pagePermissions แนบไปกับแต่ละ item
// ======================================================================
exports.listadmins = (0, https_1.onRequest)({ region: REGION }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (!["GET", "POST"].includes(req.method))
            return fail(res, "method_not_allowed", 405);
        // ตรวจ ID Token + ต้องมี manage_users
        const gate = await (0, authz_1.checkCanManageUsers)(req);
        if (!gate.ok)
            return fail(res, gate.error || "forbidden", gate.status || 403);
        const snap = await db.collection("admins").orderBy("role").get();
        const items = snap.docs.map((d) => {
            const data = d.data();
            return {
                email: (data.email || d.id || "").toLowerCase(),
                role: data.role,
                caps: data.caps,
                name: data.name || undefined,
                uid: data.uid || undefined,
                source: data.source || "manual",
                enabled: typeof data.enabled === "boolean" ? data.enabled : true,
                updatedBy: data.updatedBy || undefined,
                firstLoginAt: data.firstLoginAt || null,
                lastLoginAt: data.lastLoginAt || null,
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
                // -------------------------------
                // ✅ ส่ง pagePermissions มาด้วย
                // ถ้าในเอกสารยังไม่มี ให้เป็น null เพื่อให้ฝั่งหน้าเว็บจัดการต่อได้
                // หมายเหตุ: Firestore รองรับการเก็บข้อมูลซ้อนเป็น map อยู่แล้ว
                // -------------------------------
                pagePermissions: data.pagePermissions ?? null,
            };
        });
        ok(res, { items });
    }
    catch (e) {
        logger.error("[listadmins] internal_error", { err: errToString(e) });
        res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
}));
// ======================================================================
// 2) addAdmin (POST) — เพิ่มผู้ใช้ + ให้สิทธิ์ + ออกลิงก์ตั้งรหัส
// ======================================================================
exports.addAdmin = (0, https_1.onRequest)({ region: REGION }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (req.method !== "POST")
            return fail(res, "method_not_allowed", 405);
        // ตรวจ ID Token + ต้องมี manage_users
        const gate = await (0, authz_1.checkCanManageUsers)(req);
        if (!gate.ok)
            return fail(res, gate.error || "forbidden", gate.status || 403);
        const email = normalizeEmail(req.body?.email ?? req.query?.email);
        if (!email)
            return fail(res, "invalid_email");
        const roleIn = String(req.body?.role || "viewer").toLowerCase();
        const capsIn = req.body?.caps && typeof req.body.caps === "object" ? req.body.caps : undefined;
        const caps = mergeCapsByRole(roleIn, capsIn);
        const nameIn = typeof req.body?.name === "string" ? req.body.name : undefined;
        const sourceIn = typeof req.body?.source === "string" ? req.body.source : "manual";
        const enabledIn = typeof req.body?.enabled === "boolean" ? req.body.enabled : true;
        const updatedBy = whoRequested(req);
        // 2.1 หา/สร้างผู้ใช้ใน Auth
        let user;
        try {
            user = await auth.getUserByEmail(email);
        }
        catch (e) {
            if (e?.code === "auth/user-not-found") {
                user = await auth.createUser({ email, displayName: nameIn });
            }
            else {
                throw e;
            }
        }
        const uid = user.uid;
        // 2.2 ตั้ง custom claims (role + caps)
        await auth.setCustomUserClaims(uid, {
            role: roleIn,
            caps,
            is_admin: true,
        });
        // 2.3 เขียน Firestore (admins/{email})
        const id = emailId(email);
        const ref = db.collection("admins").doc(id);
        const existed = await ref.get();
        if (existed.exists) {
            // ถ้ามีอยู่แล้วให้ merge สิทธิ์/บทบาท (กันเคสเพิ่มซ้ำ)
            await ref.set({
                role: roleIn,
                caps,
                uid,
                source: sourceIn,
                enabled: enabledIn,
                updatedBy: updatedBy || null,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        else {
            await ref.set({
                email,
                role: roleIn,
                caps,
                uid,
                source: sourceIn,
                enabled: enabledIn,
                updatedBy: updatedBy || null,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        // 2.4 ออกลิงก์ตั้งรหัส (เผื่อผู้ใช้ยังไม่มีรหัส)
        let link = undefined;
        try {
            link = await auth.generatePasswordResetLink(email);
        }
        catch (e) {
            logger.warn("[admins] add: cannot generate reset link", { email, err: errToString(e) });
        }
        ok(res, { email, role: roleIn, caps, uid, enabled: enabledIn, link });
    }
    catch (e) {
        logger.error("[addAdmin] internal_error", { err: errToString(e) });
        res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
}));
// ======================================================================
// 3) updateAdminRole (POST)
// ======================================================================
exports.updateAdminRole = (0, https_1.onRequest)({ region: REGION }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (req.method !== "POST")
            return fail(res, "method_not_allowed", 405);
        // ตรวจ ID Token + ต้องมี manage_users
        const gate = await (0, authz_1.checkCanManageUsers)(req);
        if (!gate.ok)
            return fail(res, gate.error || "forbidden", gate.status || 403);
        const email = normalizeEmail(req.body?.email ?? req.query?.email);
        if (!email)
            return fail(res, "invalid_email");
        const ref = db.collection("admins").doc(emailId(email));
        const prev = (await ref.get()).data();
        const roleIn = String(req.body?.role || prev?.role || "viewer").toLowerCase();
        const nextRole = roleIn;
        const capsIn = req.body?.caps;
        let nextCaps;
        if (capsIn && typeof capsIn === "object") {
            nextCaps = mergeCapsByRole(nextRole, capsIn);
        }
        else if (typeof roleIn === "string" && roleIn.trim()) {
            nextCaps = mergeCapsByRole(nextRole);
        }
        else {
            nextCaps = prev?.caps ?? mergeCapsByRole(nextRole);
        }
        const enabledIn = typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
        const updatedBy = whoRequested(req);
        const updates = {
            role: nextRole,
            caps: nextCaps,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (typeof enabledIn === "boolean")
            updates.enabled = enabledIn;
        if (updatedBy)
            updates.updatedBy = updatedBy;
        await ref.set(updates, { merge: true });
        logger.info("[admins] update", { email, role: nextRole, enabled: updates.enabled, by: updatedBy });
        // ตั้ง claims ให้สอดคล้อง (ถ้ามี uid ใน doc)
        try {
            const uid = prev?.uid || (await auth.getUserByEmail(email)).uid;
            await auth.setCustomUserClaims(uid, {
                role: nextRole,
                caps: nextCaps,
                is_admin: true,
            });
        }
        catch (e) {
            logger.warn("[admins] update: cannot set claims", { email, err: errToString(e) });
        }
        ok(res, { email, role: nextRole, caps: nextCaps, enabled: updates.enabled ?? prev?.enabled ?? true });
    }
    catch (e) {
        logger.error("[updateAdminRole] internal_error", { err: errToString(e) });
        res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
}));
// ======================================================================
// 4) removeAdmin (POST/DELETE)
// ======================================================================
exports.removeAdmin = (0, https_1.onRequest)({ region: REGION }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (!["POST", "DELETE"].includes(req.method))
            return fail(res, "method_not_allowed", 405);
        // ตรวจ ID Token + ต้องมี manage_users
        const gate = await (0, authz_1.checkCanManageUsers)(req);
        if (!gate.ok)
            return fail(res, gate.error || "forbidden", gate.status || 403);
        const email = normalizeEmail(req.body?.email ?? req.query?.email);
        if (!email)
            return fail(res, "invalid_email");
        const by = whoRequested(req);
        await db.collection("admins").doc(emailId(email)).delete();
        // ไม่ลบบัญชี Auth อัตโนมัติ (กันลบผิด)
        logger.info("[admins] remove", { email, by });
        ok(res, { email, removed: true });
    }
    catch (e) {
        logger.error("[removeAdmin] internal_error", { err: errToString(e) });
        res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
}));
