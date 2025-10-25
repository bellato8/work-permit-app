// ======================================================================
// File: functions/src/adminUsers.ts (ปรับปรุงให้ listadmins ส่ง pagePermissions)
// เวอร์ชัน: 2025-10-15
// เปลี่ยนแปลง: เพิ่มการแนบคีย์ pagePermissions ในผลลัพธ์ listadmins
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { withCors } from "./withCors";
import { checkCanManageUsers } from "./authz";

// เช็คก่อนว่ามีการเปิด Firebase แล้วหรือยัง (ป้องกันเปิดซ้ำ)
if (!getApps().length) initializeApp();

const db = getFirestore();
const auth = getAuth();

// --- Config ---
const REGION = "asia-southeast1";

// ---------- Helpers ----------
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

// ----- สิทธิ์ตามบทบาท (Preset) + รวมกับที่ส่งมาได้ -----
type Caps = Record<string, boolean>;
function presetCaps(role: string): Caps {
  const viewer: Caps = {
    view_permits: true,
    view_dashboard: true,
  };
  const approver: Caps = {
    ...viewer,
    review_requests: true,
    approve_requests: true,
    reject_requests: true,
    view_reports: true,
    view_logs: true,
  };
  const admin: Caps = {
    ...approver,
    manage_settings: true,
    export_sensitive: true,
  };
  const superadmin: Caps = {
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

function normalizeCapKey(k: string): string {
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

function mergeCapsByRole(role: string, caps?: Record<string, any>): Caps {
  const base = presetCaps(role);
  if (!caps || typeof caps !== "object") return base;

  const extra: Caps = {};
  for (const [k, v] of Object.entries(caps)) {
    const key = normalizeCapKey(k);
    if (!key) continue;
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

function errToString(e: any) {
  return e && (e.stack || e.message) ? e.stack || e.message : String(e);
}

// ======================================================================
// 1) listadmins (GET/POST)
//    ✅ เพิ่ม pagePermissions แนบไปกับแต่ละ item
// ======================================================================
export const listadmins = onRequest(
  { region: REGION },
  withCors(async (req, res) => {
    try {
      if (!["GET", "POST"].includes(req.method)) return fail(res, "method_not_allowed", 405);

      // ตรวจ ID Token + ต้องมี manage_users หรือ logs.canView
      const gate = await checkCanManageUsers(req as any);
      
      // ถ้าไม่ผ่าน manage_users ให้ลองเช็คว่ามีสิทธิ์ดู logs หรือไม่
      if (!gate.ok) {
        const { requireFirebaseUser, readAdminDoc } = require("./authz");
        const who = await requireFirebaseUser(req);
        if (!who.ok) return fail(res, who.error || "forbidden", who.status || 403);
        
        // อ่านเอกสาร admin เพื่อเช็ค pagePermissions
        const doc = await readAdminDoc(who.email);
        const canViewLogs = doc?.pagePermissions?.logs?.canView === true;
        
        if (!canViewLogs) {
          return fail(res, "forbidden: need_manage_users_or_view_logs", 403);
        }
        
        // ถ้ามีสิทธิ์ดู logs ให้ผ่าน (แต่เป็น read-only)
        logger.info("[listadmins] allowed via logs.canView", { email: who.email });
      }

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

          // -------------------------------
          // ✅ ส่ง pagePermissions มาด้วย
          // ถ้าในเอกสารยังไม่มี ให้เป็น null เพื่อให้ฝั่งหน้าเว็บจัดการต่อได้
          // หมายเหตุ: Firestore รองรับการเก็บข้อมูลซ้อนเป็น map อยู่แล้ว
          // -------------------------------
          pagePermissions: data.pagePermissions ?? null,
        };
      });

      ok(res, { items });
    } catch (e) {
      logger.error("[listadmins] internal_error", { err: errToString(e) });
      res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
  })
);

// ======================================================================
// 2) addAdmin (POST) — เพิ่มผู้ใช้ + ให้สิทธิ์ + ออกลิงก์ตั้งรหัส
// ======================================================================
export const addAdmin = onRequest(
  { region: REGION },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") return fail(res, "method_not_allowed", 405);

      // ตรวจ ID Token + ต้องมี manage_users
      const gate = await checkCanManageUsers(req as any);
      if (!gate.ok) return fail(res, gate.error || "forbidden", gate.status || 403);

      const email = normalizeEmail(req.body?.email ?? req.query?.email);
      if (!email) return fail(res, "invalid_email");

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
      } catch (e: any) {
        if (e?.code === "auth/user-not-found") {
          user = await auth.createUser({ email, displayName: nameIn });
        } else {
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
        await ref.set(
          {
            role: roleIn,
            caps,
            uid,
            source: sourceIn,
            enabled: enabledIn,
            updatedBy: updatedBy || null,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await ref.set({
          email,
          role: roleIn,
          caps,
          uid,
          source: sourceIn,
          enabled: enabledIn,
          updatedBy: updatedBy || null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 2.4 ออกลิงก์ตั้งรหัส (เผื่อผู้ใช้ยังไม่มีรหัส)
      let link: string | undefined = undefined;
      try {
        link = await auth.generatePasswordResetLink(email);
      } catch (e) {
        logger.warn("[admins] add: cannot generate reset link", { email, err: errToString(e) });
      }

      ok(res, { email, role: roleIn, caps, uid, enabled: enabledIn, link });
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
  { region: REGION },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST") return fail(res, "method_not_allowed", 405);

      // ตรวจ ID Token + ต้องมี manage_users
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

      // ตั้ง claims ให้สอดคล้อง (ถ้ามี uid ใน doc)
      try {
        const uid = (prev?.uid as string) || (await auth.getUserByEmail(email)).uid;
        await auth.setCustomUserClaims(uid, {
          role: nextRole,
          caps: nextCaps,
          is_admin: true,
        });
      } catch (e) {
        logger.warn("[admins] update: cannot set claims", { email, err: errToString(e) });
      }

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
  { region: REGION },
  withCors(async (req, res) => {
    try {
      if (!["POST", "DELETE"].includes(req.method)) return fail(res, "method_not_allowed", 405);

      // ตรวจ ID Token + ต้องมี manage_users
      const gate = await checkCanManageUsers(req as any);
      if (!gate.ok) return fail(res, gate.error || "forbidden", gate.status || 403);

      const email = normalizeEmail(req.body?.email ?? req.query?.email);
      if (!email) return fail(res, "invalid_email");

      const by = whoRequested(req);
      await db.collection("admins").doc(emailId(email)).delete();

      // ไม่ลบบัญชี Auth อัตโนมัติ (กันลบผิด)
      logger.info("[admins] remove", { email, by });
      ok(res, { email, removed: true });
    } catch (e) {
      logger.error("[removeAdmin] internal_error", { err: errToString(e) });
      res.status(500).json({ ok: false, error: "internal_error", reason: errToString(e) });
    }
  })
);
