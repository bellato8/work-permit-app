// ======================================================================
// File: functions/src/authz.ts
// เวอร์ชัน: 2025-10-08 (Recommended Final Version)
// หน้าที่: ตัวกลางตรวจสอบสิทธิ์ (Authorization Middleware) สำหรับ Cloud Functions
// ======================================================================

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// --- สำคัญ! ---
// เราได้ย้าย admin.initializeApp() ไปไว้ที่ไฟล์ index.ts ซึ่งเป็นไฟล์เริ่มต้น
// ไฟล์นี้จึงไม่ต้อง initialize เองอีกต่อไป

const CHECK_REVOKED = process.env.CHECK_REVOKED !== "0";

export type GateOk = {
  ok: true;
  status: 200;
  email: string;
  uid: string;
  role?: string;
  caps: Record<string, any>;
};
export type GateFail = { ok: false; status: number; error: string };
export type GateResult = GateOk | GateFail;

function emailKey(email: string): string {
  return (email || "").trim().toLowerCase();
}

function normalizeCaps(caps: any): Record<string, any> {
  const c = typeof caps === "object" && caps ? caps : {};
  return {
    ...c,
    viewAll: typeof c.viewAll === "boolean" ? c.viewAll : !!c.view_all,
    manageUsers: typeof c.manageUsers === "boolean" ? c.manageUsers : !!c.manage_users,
    manageRequests:
      typeof c.manageRequests === "boolean" ? c.manageRequests : !!c.manage_requests,
    approve: typeof c.approve === "boolean" ? c.approve : !!c.can_approve,
    decide: typeof c.decide === "boolean" ? c.decide : !!c.can_decide,
  };
}

export async function readAdminDoc(email: string) {
  const id = emailKey(email);
  const snap = await admin.firestore().collection("admins").doc(id).get();
  return snap.exists ? (snap.data() as any) : undefined;
}

export function getRequesterEmail(req: any): string | undefined {
  const h = String(
    req.get?.("x-requester-email") || req.headers?.["x-requester-email"] || ""
  ).trim();
  const q = String(req.query?.requester || "").trim();
  const b = String(req.body?.requester || "").trim();
  const v = (h || q || b || "").toLowerCase();
  return /.+@.+\..+/.test(v) ? v : undefined;
}

function decodePayloadUnsafe(token?: string): any | undefined {
  try {
    if (!token) return;
    const seg = (token.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(seg, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return;
  }
}

export async function requireFirebaseUser(req: any): Promise<GateOk | GateFail> {
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
  } catch (e: any) {
    const code = e?.code || e?.errorInfo?.code || "verify_failed";
    const msg = e?.message || e?.errorInfo?.message || String(e);
    logger.error("[authz] verify_failed", { code, msg });
    return { ok: false, status: 401, error: `unauthorized: ${code}` };
  }
}

export async function requireCaps(
  req: any,
  anyOfCaps: Array<"approve" | "decide" | "manage_requests" | "manageRequests">
): Promise<GateResult> {
  const who = await requireFirebaseUser(req);
  if (!who.ok) return who;

  const { role, caps } = who;
  if (role === "superadmin") return who;
  
  const granted =
    !!caps.approve ||
    !!caps.decide ||
    !!caps.manageRequests ||
    !!(caps as any).manage_requests;
    
  if (!granted) {
    return { ok: false, status: 403, error: "forbidden: missing_required_caps" };
  }
  return who;
}

export async function checkCanManageUsers(req: any): Promise<GateResult> {
  const who = await requireFirebaseUser(req);
  if (!who.ok) return who;
  
  const { role, caps } = who;
  if (role === "superadmin" || !!caps.manageUsers) return who;
  
  return { ok: false, status: 403, error: "forbidden: need_manage_users" };
}