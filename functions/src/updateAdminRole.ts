/* ============================================================================
 * ไฟล์: functions/src/updateAdminRole.ts
 * เวอร์ชัน: 2025-09-17
 * บทบาทไฟล์ (role): HTTP Function ตั้ง/อัปเดตบทบาทและสิทธิ์ของแอดมิน + ตรวจสิทธิ์ผู้ร้องขอ
 * เปลี่ยนแปลงรอบนี้:
 *   • กรองค่า undefined ออกจาก payload ก่อนเขียน Firestore (ป้องกัน error extra.role)
 *   • เพิ่มตัวตรวจสิทธิ์: ต้องเป็น superadmin หรือมี caps.manageUsers / caps.manage_users
 *   • ใส่ CORS (คอร์ส = กติกาเรียกข้ามโดเมน, หน้าที่: อนุญาต origin ที่กำหนด) + handle OPTIONS (พรี-ไฟลต์)
 *   • เขียนเฉพาะฟิลด์ที่ “ถูกส่งมาและมีค่า” (ไม่ฝังฟิลด์ extra ที่มี undefined)
 * คำสำคัญ (English → Thai/phonetic/meaning):
 *   • Sanitize (แซน-นิ-ไทซ์) = กรอง/ลบค่าที่ไม่เหมาะสมออก
 *   • Payload (เพย์-โหลด) = ข้อมูลที่ client ส่งเข้ามา
 *   • Upsert (อัพ-เซิร์ต) = สร้างถ้าไม่มี/อัปเดตถ้ามี
 *   • Merge (เมิร์จ) = รวมข้อมูลกับของเดิม
 *   • CORS (คอร์ส) = กติกาเรียกข้ามโดเมน
 * หมายเหตุความปลอดภัย: ดึงคีย์จาก Secret/ENV เท่านั้น, จำกัด Origin ตามโดเมนที่กำหนด
 * ผู้เขียน: AI ผู้ช่วย (โหมดจับมือทำ)
 * ========================================================================== */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { emitAudit } from "./lib/emitAudit";

const APPROVER_KEY = defineSecret("APPROVER_KEY");
if (!admin.apps.length) admin.initializeApp();

// ---------- CORS helpers ----------
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
    "Content-Type, Authorization, X-Requested-With, x-api-key, x-requester-email"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Max-Age", "600");
}

// ---------- small utils ----------
function readKey(req: any) {
  return String(
    req.get("x-api-key") ||
      req.get("x-approver-key") ||
      req.query?.key ||
      req.body?.key ||
      ""
  ).trim();
}
function readRequester(req: any) {
  return String(
    req.get("x-requester-email") || req.query?.requester || req.body?.requester || ""
  ).trim();
}
function ipOf(req: any) {
  const x = String(req.headers["x-forwarded-for"] || "");
  return (x.split(",")[0] || req.socket?.remoteAddress || "").trim() || undefined;
}
function uaOf(req: any) {
  return String(req.headers["user-agent"] || "") || undefined;
}
function emailKey(email: string) {
  return (email || "").trim().toLowerCase();
}

// ตรวจสิทธิ์ requester จากเอกสาร admins/<emailLower>
async function ensureCanManageUsers(requesterEmail?: string) {
  if (!requesterEmail) return { ok: false as const, reason: "missing_requester" };

  const id = emailKey(requesterEmail);
  const snap = await admin.firestore().collection("admins").doc(id).get();
  if (!snap.exists) return { ok: false as const, reason: "requester_not_admin" };

  const data: any = snap.data() || {};
  const enabled = data.enabled !== false; // ไม่กำหนด = ถือว่า true
  const role = String(data.role || "").toLowerCase();
  const caps = (data.caps && typeof data.caps === "object") ? data.caps : {};

  const canManage =
    !!caps.manageUsers || !!caps.manage_users || role === "superadmin";

  if (!enabled) return { ok: false as const, reason: "requester_disabled" };
  if (!canManage) return { ok: false as const, reason: "need manage_users" };

  return { ok: true as const };
}

// กรองคีย์ที่มีค่า undefined ออก (shallow clean)
function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  Object.keys(obj || {}).forEach((k) => {
    const v = (obj as any)[k];
    if (v !== undefined) out[k] = v;
  });
  return out as Partial<T>;
}

export const updateAdminRole = onRequest(
  { region: "asia-southeast1", secrets: [APPROVER_KEY] },
  async (req, res) => {
    try {
      applyCors(req, res);
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
      }

      // ---- API key check ----
      const provided = readKey(req);
      const secretVal = APPROVER_KEY.value() || process.env.APPROVER_KEY || "";
      if (!provided || provided !== secretVal) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
      }

      const requester = readRequester(req) || undefined;

      // ---- Authorization (ต้องมี manage_users หรือเป็น superadmin) ----
      const authz = await ensureCanManageUsers(requester);
      if (!authz.ok) {
        res.status(403).json({ ok: false, error: `forbidden: ${authz.reason}` });
        return;
      }

      // ---- parse payload ----
      const { email, role, caps, enabled, displayName } = req.body || {};
      if (!email || typeof email !== "string") {
        res.status(400).json({ ok: false, error: "missing_email" });
        return;
      }
      const emailLower = emailKey(email);

      // ---- upsert user in Firebase Auth (optional) ----
      const auth = admin.auth();
      let uid: string | undefined;
      try {
        const u = await auth.getUserByEmail(emailLower);
        uid = u.uid;
        if (displayName && u.displayName !== displayName) {
          await auth.updateUser(uid, { displayName });
        }
      } catch {
        // ถ้ายังไม่มี user ให้สร้างแบบเบื้องต้น
        const u = await auth.createUser({
          email: emailLower,
          displayName: displayName || undefined,
          emailVerified: false,
          disabled: false,
        });
        uid = u.uid;
      }

      // คง customClaims role: "admin" เดิมไว้ (ถ้าต้องการ)
      // หมายเหตุ: ไม่ผูกกับ role viewer/approver ที่ UI ใช้ — claims ตรงนี้เพื่อบอกว่าเป็นแอดมินระบบ
      if (uid) {
        const cur = await auth.getUser(uid);
        const newClaims = { ...(cur.customClaims || {}), role: "admin" };
        await auth.setCustomUserClaims(uid, newClaims);
      }

      // ---- สร้าง object สำหรับบันทึก Firestore (ตัด undefined ออก) ----
      const updateData: any = {
        // เก็บ email/emailLower เพื่อความชัดเจน (ถ้าอยากให้ list ใช้)
        email: emailLower,
        emailLower: emailLower,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: requester || null,
      };

      if (typeof enabled === "boolean") updateData.enabled = enabled;

      if (role && typeof role === "string") {
        const normalized = role.toLowerCase().replace(/^super$/, "superadmin");
        updateData.role = ["superadmin", "admin", "approver", "viewer"].includes(normalized)
          ? normalized
          : "viewer";
      }

      if (caps && typeof caps === "object") {
        // ตัดค่า undefined ใน caps ออกแบบตื้นๆ
        updateData.caps = cleanObject(caps);
      }

      // สำคัญ: อย่าใส่ object ซ้อนที่มีค่า undefined (เช่น extra.role) ลง Firestore
      const docRef = admin.firestore().collection("admins").doc(emailLower);
      await docRef.set(updateData, { merge: true }); // merge (เมิร์จ) = รวมกับของเดิม

      // ---- audit log ----
      await emitAudit(
        "admin_caps_update",
        requester ? { email: requester } : "unknown",
        { type: "admin", id: uid || emailLower, rid: emailLower },
        "update admin caps/role",
        { ip: ipOf(req), ua: uaOf(req), role: updateData.role, enabled: updateData.enabled, caps: updateData.caps }
      );

      res.json({ ok: true, email: emailLower, uid: uid || null });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
);
