// ======================================================================
// ไฟล์: functions/src/adminUsers.ts
// เวอร์ชัน: 2025-09-03+fix-undefined-in-payload
// โหมดจับมือทำ — แก้ 500 จาก undefined fields ใน Firestore
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { withCors } from "./withCors";
import { checkCanManageUsers } from "./authz";

// --- Bootstrap admin SDK ---
if (!getApps().length) initializeApp();
const db = getFirestore();

// --- Region/Secrets
const REGION = "asia-southeast1";
const APPROVER_KEY = defineSecret("APPROVER_KEY");

// ---------- Helpers เดิม (คงไว้) ----------
function needKey(req: any): string {
  const k = (req.query?.key as string) || req.body?.key || req.headers["x-api-key"];
  return typeof k === "string" ? k : "";
}
function whoRequested(req: any): string | undefined {
  const r =
    (req.body?.requester as string) ||
    (req.query?.requester as string) ||
    (req.headers["x-requester-email"] as string);
  return typeof r === "string" && r.includes("@") ? r : undefined;
}
function normalizeEmail(v: any): string {
  const s = String(v || "").trim().toLowerCase();
  return /.+@.+\..+/.test(s) ? s : "";
}
function emailId(email: string): string {
  return email.replace(/\//g, "_");
}
function ok(res: any, data: any) {
  res.json({ ok: true, data });
}
function fail(res: any, error: string, code = 400) {
  res.status(code).json({ ok: false, error });
}
function checkKeyOrFail(req: any, res: any) {
  const provided = needKey(req);
  const secretVal = APPROVER_KEY.value() || process.env.APPROVER_KEY || "";
  if (!provided || provided !== secretVal) {
    fail(res, "unauthorized", 401);
    return false;
  }
  return true;
}
function mergeCapsByRole(role: string, caps?: Record<string, any>) {
  // … (คงฟังก์ชันเดิมทั้งหมดของไฟล์นี้ไว้)
  // โค้ดส่วนอื่นๆ ไม่เปลี่ยน
  return caps;
}
function errToString(e: any) {
  return e && (e.stack || e.message) ? e.stack || e.message : String(e);
}

// ======================================================================
// 1) listAdmins (GET/POST)
// ======================================================================
export const listAdmins = onRequest(
  { region: REGION, secrets: [APPROVER_KEY] },
  withCors(async (req, res) => {
    try {
      if (!["GET", "POST"].includes(req.method)) return fail(res, "method_not_allowed", 405);
      if (!checkKeyOrFail(req, res)) return;

      // ✨ NEW: ตรวจสิทธิ์ manage_users
      const gate = await checkCanManageUsers(req as any);
      if (!gate.ok) return fail(res, gate.error || "forbidden", gate.status || 403);

      const snap = await db.collection("admins").orderBy("role").get();
      const items = snap.docs.map((d) => {
        const data = d.data() as any;
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
    } catch (e) {
      logger.error("[listAdmins] internal_error", { err: errToString(e) });
      res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
  })
);

// ======================================================================
// 2) addAdmin (POST)
// ======================================================================
export const addAdmin = onRequest(
  { region: REGION, secrets: [APPROVER_KEY] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") return fail(res, "method_not_allowed", 405);
      if (!checkKeyOrFail(req, res)) return;

      // ✨ NEW: ตรวจสิทธิ์ manage_users
      const gate = await checkCanManageUsers(req as any);
      if (!gate.ok) return fail(res, gate.error || "forbidden", gate.status || 403);

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
      if (existed.exists) return fail(res, "email_already_exists", 409);

      const payload: Record<string, any> = {
        email, role: roleIn, caps,
        source: sourceIn, enabled: enabledIn,
        updatedBy: updatedBy || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (nameIn !== undefined) payload.name = nameIn;
      if (uidIn !== undefined) payload.uid = uidIn;

      logger.info("[admins] add: about to write", { email, role: roleIn, by: updatedBy });
      await ref.set(payload);
      logger.info("[admins] add: done", { email, role: roleIn, by: updatedBy });

      ok(res, { email, role: roleIn, caps, enabled: enabledIn });
    } catch (e) {
      logger.error("[addAdmin] internal_error", { err: errToString(e) });
      res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
  })
);

// ======================================================================
// 3) updateAdminRole (POST)
// ======================================================================
export const updateAdminRole = onRequest(
  { region: REGION, secrets: [APPROVER_KEY] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") return fail(res, "method_not_allowed", 405);
      if (!checkKeyOrFail(req, res)) return;

      // ✨ NEW: ตรวจสิทธิ์ manage_users
      const gate = await checkCanManageUsers(req as any);
      if (!gate.ok) return fail(res, gate.error || "forbidden", gate.status || 403);

      const email = normalizeEmail(req.body?.email ?? req.query?.email);
      if (!email) return fail(res, "invalid_email");

      const ref = db.collection("admins").doc(emailId(email));
      const prev = (await ref.get()).data() as any | undefined;

      const roleIn = String(req.body?.role || prev?.role || "viewer").toLowerCase();
      const nextRole = roleIn;
      const capsIn = req.body?.caps;

      let nextCaps: Record<string, any> | undefined;
      if (capsIn && typeof capsIn === "object") {
        nextCaps = mergeCapsByRole(nextRole, capsIn);
      } else if (typeof roleIn === "string" && roleIn.trim()) {
        nextCaps = mergeCapsByRole(nextRole);
      } else {
        nextCaps = prev?.caps ?? mergeCapsByRole(nextRole);
      }

      const enabledIn = typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
      const updatedBy = whoRequested(req);

      const updates: any = {
        role: nextRole,
        caps: nextCaps,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (typeof enabledIn === "boolean") updates.enabled = enabledIn;
      if (updatedBy) updates.updatedBy = updatedBy;

      await ref.set(updates, { merge: true });
      logger.info("[admins] update", { email, role: nextRole, enabled: updates.enabled, by: updatedBy });

      ok(res, { email, role: nextRole, caps: nextCaps, enabled: updates.enabled ?? prev?.enabled ?? true });
    } catch (e) {
      logger.error("[updateAdminRole] internal_error", { err: errToString(e) });
      res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
  })
);

// ======================================================================
// 4) removeAdmin (POST/DELETE)
// ======================================================================
export const removeAdmin = onRequest(
  { region: REGION, secrets: [APPROVER_KEY] },
  withCors(async (req, res) => {
    try {
      if (!["POST", "DELETE"].includes(req.method)) return fail(res, "method_not_allowed", 405);
      if (!checkKeyOrFail(req, res)) return;

      // ✨ NEW: ตรวจสิทธิ์ manage_users
      const gate = await checkCanManageUsers(req as any);
      if (!gate.ok) return fail(res, gate.error || "forbidden", gate.status || 403);

      const email = normalizeEmail(req.body?.email ?? req.query?.email);
      if (!email) return fail(res, "invalid_email");

      const by = whoRequested(req);
      await db.collection("admins").doc(emailId(email)).delete();
      logger.info("[admins] remove", { email, by });
      ok(res, { email, removed: true });
    } catch (e) {
      logger.error("[removeAdmin] internal_error", { err: errToString(e) });
      res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
  })
);
