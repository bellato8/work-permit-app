// ============================================================================
// File: functions/src/updateAdminRole.ts
// Version: 2025-10-02
// หน้าที่: อัปเดตบทบาท/สิทธิ์ผู้ดูแล (admins/*) โดยยึดแนว “บัตรผ่าน (Bearer ID token)
//          + เปิดสมุดสิทธิ์ Firestore ทุกครั้ง” และตอบกลับด้วยข้อความภาษาคน
// นโยบายหลัก:
//   1) ใช้เฉพาะ Authorization: Bearer <ID_TOKEN> (Firebase) — ไม่ใช้ x-api-key อีกต่อไป
//   2) อ่านอีเมลผู้ร้องขอจาก “บัตรที่ตรวจสอบแล้ว” เท่านั้น (ไม่อ่าน x-requester-email)
//   3) สิทธิ์จริงตัดสินจาก Firestore (admins/{emailLower}) ทุกคำขอ (RBAC ล้วน)
//   4) มาตรฐานตอบกลับ: 401 (ยังไม่ได้เข้าสู่ระบบ/บัตรหมดเวลา) , 403 (สิทธิ์ไม่พอ)
//      โดยคืน JSON ที่มี message/hint แบบภาษาคน + code สำหรับนักพัฒนา
// อ้างอิงแนวทาง:
//   - แนบ ID token ที่ฝั่งเว็บ แล้วฝั่งเซิร์ฟเวอร์ verifyIdToken() ทุกคำขอ
//     https://cloud.google.com/run/docs/authenticating/end-users
//     https://firebase.google.com/docs/auth/admin/verify-id-tokens
//   - ความหมายของ 401/403 (MDN)
//     https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401
//     https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/403
// ผู้เขียน: เพื่อนคู่คิด (โหมดภาษาคน)
// ============================================================================

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { emitAudit } from "./lib/emitAudit";

if (!admin.apps.length) admin.initializeApp();

// ---------- CORS ----------
const ALLOW_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "https://staging.imperialworld.asia",
  "https://imperialworld.asia",
]);

function applyCors(req: any, res: any) {
  const origin = String(req.headers.origin || "");
  const allow = origin && ALLOW_ORIGINS.has(origin) ? origin : "*";
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Max-Age", "600");
}

// ---------- ภาษาคนสำหรับข้อผิดพลาด ----------
function reply401(res: any, code: string, detail?: string) {
  // ตัวอย่างโค้ด: auth/unauthenticated, auth/invalid_token, auth/expired, auth/wrong_project
  const catalog: Record<string, { message: string; hint?: string }> = {
    "auth/unauthenticated": {
      message: "ยังไม่ได้เข้าสู่ระบบ",
      hint: "กรุณาเข้าสู่ระบบแล้วลองใหม่",
    },
    "auth/invalid_token": {
      message: "ยืนยันตัวตนไม่สำเร็จ",
      hint: "กรุณาเข้าสู่ระบบใหม่",
    },
    "auth/expired": {
      message: "หมดเวลาใช้งานแล้ว",
      hint: "กรุณาเข้าสู่ระบบใหม่",
    },
    "auth/wrong_project": {
      message: "บัตรผ่านไม่ใช่ของระบบนี้",
      hint: "กรุณาออกจากระบบ แล้วเข้าสู่ระบบใหม่",
    },
  };
  const c = catalog[code] || catalog["auth/unauthenticated"];
  res.status(401).json({ ok: false, code, message: c.message, hint: c.hint, detail });
}

function reply403(res: any, code: string, need?: string) {
  // ตัวอย่างโค้ด: auth/forbidden, auth/need_manage_users, auth/disabled
  const catalog: Record<string, { message: string; hint?: string }> = {
    "auth/forbidden": {
      message: "คุณไม่มีสิทธิ์ทำรายการนี้",
      hint: "ติดต่อผู้ดูแลเพื่อขอสิทธิ์เพิ่ม",
    },
    "auth/need_manage_users": {
      message: "คุณไม่มีสิทธิ์จัดการผู้ใช้",
      hint: "ติดต่อผู้ดูแลเพื่อขอสิทธิ์ “จัดการผู้ใช้”",
    },
    "auth/disabled": {
      message: "บัญชีของคุณถูกปิดใช้งาน",
      hint: "ติดต่อผู้ดูแลระบบ",
    },
  };
  const c = catalog[code] || catalog["auth/forbidden"];
  res.status(403).json({ ok: false, code, message: c.message, hint: c.hint, need });
}

function reply400(res: any, code: string, field?: string) {
  const catalog: Record<string, { message: string; hint?: string }> = {
    "bad_request": { message: "คำขอไม่ถูกต้อง", hint: "กรุณาลองใหม่" },
    "missing_email": { message: "กรุณาระบุอีเมลเป้าหมาย", hint: "ตรวจสอบช่องอีเมลแล้วลองใหม่" },
    "method_not_allowed": { message: "วิธีเรียกใช้งานไม่ถูกต้อง", hint: "ใช้แบบ POST เท่านั้น" },
  };
  const c = catalog[code] || catalog["bad_request"];
  res.status(code === "method_not_allowed" ? 405 : 400)
    .json({ ok: false, code, message: c.message, hint: c.hint, field });
}

// ---------- ยูทิล ----------
function emailKey(email: string) {
  return (email || "").trim().toLowerCase();
}
function ipOf(req: any) {
  const x = String(req.headers["x-forwarded-for"] || "");
  return (x.split(",")[0] || req.socket?.remoteAddress || "").trim() || undefined;
}
function uaOf(req: any) {
  return String(req.headers["user-agent"] || "") || undefined;
}
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  Object.keys(obj || {}).forEach((k) => {
    const v = (obj as any)[k];
    if (v !== undefined) out[k] = v;
  });
  return out as Partial<T>;
}

// ตรวจสิทธิ์: ต้องเป็น superadmin หรือมี caps.manageUsers/manage_users และ enabled ไม่เป็น false
async function ensureCanManageUsersByEmail(email: string) {
  const id = emailKey(email);
  const snap = await admin.firestore().collection("admins").doc(id).get();
  if (!snap.exists) return { ok: false as const, code: "auth/forbidden", reason: "not_in_admins" };
  const data: any = snap.data() || {};
  if (data.enabled === false) return { ok: false as const, code: "auth/disabled", reason: "requester_disabled" };
  const role = String(data.role || "").toLowerCase();
  const caps = (data.caps && typeof data.caps === "object") ? data.caps : {};
  const can = role === "superadmin" || !!caps.manageUsers || !!caps.manage_users;
  if (!can) return { ok: false as const, code: "auth/need_manage_users", reason: "need_manage_users" };
  return { ok: true as const };
}

// ดึงและตรวจบัตรผ่าน (ID token) จาก header แล้วคืนอีเมลผู้ร้องขอ
async function getRequesterEmailFromBearer(req: any): Promise<string | null> {
  const authz = String(req.get("Authorization") || req.get("authorization") || "");
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // หมายเหตุ: verifyIdToken จะตรวจรูปแบบ/ลายเซ็น/อายุบัตรตามคู่มือ Firebase Admin
    // https://firebase.google.com/docs/auth/admin/verify-id-tokens
    const email = (decoded.email || "").toLowerCase();
    return email || null;
  } catch (e: any) {
    // ถ้าอยากละเอียด: แยกกรณี expired/invalid ได้จากข้อความผิดพลาดของ SDK
    const msg = String(e?.message || "").toLowerCase();
    if (msg.includes("expired")) throw Object.assign(new Error("expired"), { code: "auth/expired" });
    if (msg.includes("project") || msg.includes("iss") || msg.includes("aud")) {
      throw Object.assign(new Error("wrong_project"), { code: "auth/wrong_project" });
    }
    throw Object.assign(new Error("invalid_token"), { code: "auth/invalid_token" });
  }
}

export const updateAdminRole = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    try {
      applyCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        reply400(res, "method_not_allowed");
        return;
      }

      // ---- 1) ตรวจ “บัตรผ่าน” (Bearer ID token) ----
      let requesterEmail: string | null = null;
      try {
        requesterEmail = await getRequesterEmailFromBearer(req);
        if (!requesterEmail) {
          reply401(res, "auth/unauthenticated");
          return;
        }
      } catch (e: any) {
        const c = e?.code || "auth/invalid_token";
        reply401(res, c);
        return;
      }

      // ---- 2) เปิดสมุดสิทธิ์ Firestore ของผู้ร้องขอ ----
      const gate = await ensureCanManageUsersByEmail(requesterEmail);
      if (!gate.ok) {
        reply403(res, gate.code!, gate.reason);
        return;
      }

      // ---- 3) อ่านคำขอ และ validate ขั้นพื้นฐาน ----
      const { email, role, caps, enabled, displayName } = req.body || {};
      if (!email || typeof email !== "string") {
        reply400(res, "missing_email", "email");
        return;
      }
      const emailLower = emailKey(email);

      // ---- 4) (ไม่บังคับ) สร้าง/อัปเดตผู้ใช้ใน Firebase Auth ตาม displayName ----
      // หมายเหตุ: ไม่ตั้ง custom claims ใด ๆ อีกแล้ว (ยึด Firestore เป็นแหล่งสิทธิ์)
      const auth = admin.auth();
      let uid: string | undefined;
      try {
        const u = await auth.getUserByEmail(emailLower);
        uid = u.uid;
        if (displayName && u.displayName !== displayName) {
          await auth.updateUser(uid, { displayName });
        }
      } catch {
        // ถ้าไม่พบ ให้สร้างบัญชีพื้นฐาน (อีเมลยังยืนยันไม่ก็ได้)
        const u = await auth.createUser({
          email: emailLower,
          displayName: displayName || undefined,
          emailVerified: false,
          disabled: false,
        });
        uid = u.uid;
      }

      // ---- 5) บันทึก Firestore (merge เฉพาะคีย์ที่ส่งมา) ----
      const updateData: any = {
        email: emailLower,
        emailLower: emailLower,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: requesterEmail,
      };
      if (typeof enabled === "boolean") updateData.enabled = enabled;
      if (role && typeof role === "string") {
        const normalized = role.toLowerCase().replace(/^super$/, "superadmin");
        updateData.role = ["superadmin", "admin", "approver", "viewer"].includes(normalized)
          ? normalized
          : "viewer";
      }
      if (caps && typeof caps === "object") {
        updateData.caps = cleanObject(caps);
      }

      await admin.firestore().collection("admins").doc(emailLower).set(updateData, { merge: true });

      // ---- 6) จดบันทึกเหตุการณ์ (audit) ----
      await emitAudit(
        "admin_caps_update",
        { email: requesterEmail },
        { type: "admin", id: uid || emailLower, rid: emailLower },
        "update admin caps/role",
        { ip: ipOf(req), ua: uaOf(req), role: updateData.role, enabled: updateData.enabled, caps: updateData.caps }
      );

      res.json({ ok: true, email: emailLower, uid: uid || null });
    } catch (e: any) {
      // ไม่เผยรายละเอียดเกินจำเป็น แต่ยังบอกเป็นภาษาคน
      res.status(500).json({
        ok: false,
        code: "server/error",
        message: "ระบบขัดข้องชั่วคราว",
        hint: "กรุณาลองใหม่อีกครั้ง",
        detail: String(e?.message || e),
      });
    }
  }
);
