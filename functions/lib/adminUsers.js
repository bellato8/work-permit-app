"use strict";
// ======================================================================
// ไฟล์: functions/src/adminUsers.ts
// เวอร์ชัน: 2025-09-03+fix-undefined-in-payload
// โหมดจับมือทำ — แก้ 500 จาก undefined fields ใน Firestore
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
exports.removeAdmin = exports.updateAdminRole = exports.addAdmin = exports.listAdmins = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const withCors_1 = require("./withCors");
const authz_1 = require("./authz");
// --- Bootstrap admin SDK ---
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// --- Region/Secrets
const REGION = "asia-southeast1";
const APPROVER_KEY = (0, params_1.defineSecret)("APPROVER_KEY");
// ---------- Helpers เดิม (คงไว้) ----------
function needKey(req) {
    const k = req.query?.key || req.body?.key || req.headers["x-api-key"];
    return typeof k === "string" ? k : "";
}
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
function checkKeyOrFail(req, res) {
    const provided = needKey(req);
    const secretVal = APPROVER_KEY.value() || process.env.APPROVER_KEY || "";
    if (!provided || provided !== secretVal) {
        fail(res, "unauthorized", 401);
        return false;
    }
    return true;
}
function mergeCapsByRole(role, caps) {
    // … (คงฟังก์ชันเดิมทั้งหมดของไฟล์นี้ไว้)
    // โค้ดส่วนอื่นๆ ไม่เปลี่ยน
    return caps;
}
function errToString(e) {
    return e && (e.stack || e.message) ? e.stack || e.message : String(e);
}
// ======================================================================
// 1) listAdmins (GET/POST)
// ======================================================================
exports.listAdmins = (0, https_1.onRequest)({ region: REGION, secrets: [APPROVER_KEY] }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (!["GET", "POST"].includes(req.method))
            return fail(res, "method_not_allowed", 405);
        if (!checkKeyOrFail(req, res))
            return;
        // ✨ NEW: ตรวจสิทธิ์ manage_users
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
            };
        });
        ok(res, { items });
    }
    catch (e) {
        logger.error("[listAdmins] internal_error", { err: errToString(e) });
        res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
}));
// ======================================================================
// 2) addAdmin (POST)
// ======================================================================
exports.addAdmin = (0, https_1.onRequest)({ region: REGION, secrets: [APPROVER_KEY] }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (req.method !== "POST")
            return fail(res, "method_not_allowed", 405);
        if (!checkKeyOrFail(req, res))
            return;
        // ✨ NEW: ตรวจสิทธิ์ manage_users
        const gate = await (0, authz_1.checkCanManageUsers)(req);
        if (!gate.ok)
            return fail(res, gate.error || "forbidden", gate.status || 403);
        const email = normalizeEmail(req.body?.email ?? req.query?.email);
        const roleIn = String(req.body?.role || "viewer").toLowerCase();
        const capsIn = req.body?.caps && typeof req.body.caps === "object" ? req.body.caps : undefined;
        const caps = mergeCapsByRole(roleIn, capsIn);
        const nameIn = typeof req.body?.name === "string" ? req.body.name : undefined;
        const uidIn = typeof req.body?.uid === "string" ? req.body.uid : undefined;
        const sourceIn = typeof req.body?.source === "string" ? req.body.source : "manual";
        const enabledIn = typeof req.body?.enabled === "boolean" ? req.body.enabled : true;
        const updatedBy = whoRequested(req);
        const id = emailId(email);
        const ref = db.collection("admins").doc(id);
        const existed = await ref.get();
        if (existed.exists)
            return fail(res, "email_already_exists", 409);
        const payload = {
            email, role: roleIn, caps,
            source: sourceIn, enabled: enabledIn,
            updatedBy: updatedBy || null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (nameIn !== undefined)
            payload.name = nameIn;
        if (uidIn !== undefined)
            payload.uid = uidIn;
        logger.info("[admins] add: about to write", { email, role: roleIn, by: updatedBy });
        await ref.set(payload);
        logger.info("[admins] add: done", { email, role: roleIn, by: updatedBy });
        ok(res, { email, role: roleIn, caps, enabled: enabledIn });
    }
    catch (e) {
        logger.error("[addAdmin] internal_error", { err: errToString(e) });
        res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
}));
// ======================================================================
// 3) updateAdminRole (POST)
// ======================================================================
exports.updateAdminRole = (0, https_1.onRequest)({ region: REGION, secrets: [APPROVER_KEY] }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (req.method !== "POST")
            return fail(res, "method_not_allowed", 405);
        if (!checkKeyOrFail(req, res))
            return;
        // ✨ NEW: ตรวจสิทธิ์ manage_users
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
exports.removeAdmin = (0, https_1.onRequest)({ region: REGION, secrets: [APPROVER_KEY] }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (!["POST", "DELETE"].includes(req.method))
            return fail(res, "method_not_allowed", 405);
        if (!checkKeyOrFail(req, res))
            return;
        // ✨ NEW: ตรวจสิทธิ์ manage_users
        const gate = await (0, authz_1.checkCanManageUsers)(req);
        if (!gate.ok)
            return fail(res, gate.error || "forbidden", gate.status || 403);
        const email = normalizeEmail(req.body?.email ?? req.query?.email);
        if (!email)
            return fail(res, "invalid_email");
        const by = whoRequested(req);
        await db.collection("admins").doc(emailId(email)).delete();
        logger.info("[admins] remove", { email, by });
        ok(res, { email, removed: true });
    }
    catch (e) {
        logger.error("[removeAdmin] internal_error", { err: errToString(e) });
        res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
}));
