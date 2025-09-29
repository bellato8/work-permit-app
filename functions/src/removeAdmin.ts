/* ============================================================================
 * ไฟล์: functions/src/removeAdmin.ts
 * เวอร์ชัน: 2025-09-17
 * บทบาทไฟล์ (role):
 *   ถอนสิทธิ์แอดมิน (ลบสิทธิ์ออกจาก Auth custom claims + ปิดใช้งานในคอลเลกชัน admins)
 *   รองรับทั้งแบบ "soft delete" (ปิดใช้งาน/ล้าง caps) และ "hard delete" (ลบเอกสาร)
 *   บันทึก auditLogs และตอบ CORS/OPTIONS ให้เรียบร้อย
 *
 * เปลี่ยนแปลงรอบนี้:
 *   • ครอบ CORS ด้วย withCors (คอร์ส) → รองรับ preflight OPTIONS
 *   • เพิ่มตรวจสิทธิ์ manage_users ด้วย checkCanManageUsers(req)
 *   • คงตรวจ x-api-key (APPROVER_KEY) + รองรับ fallback process.env สำหรับ dev
 *   • ลบ custom claims.role ออกจาก Firebase Auth + revoke refresh tokens
 *   • ปรับ softDelete -> set { enabled:false, role:'viewer', caps:{} }
 *
 * คำสำคัญ (English → Thai/phonetic/meaning/role):
 *   • Soft delete (ซอฟท์-ดีลิท) = ปิดใช้งาน/ซ่อนข้อมูลโดยไม่ลบถาวร, หน้าที่: พอกลับคืนได้ง่าย
 *   • Hard delete (ฮาร์ด-ดีลิท) = ลบถาวรจากฐานข้อมูล, หน้าที่: เคลียร์ข้อมูลออกจริง
 *   • Custom Claims (คัสตอม-เคลมส์) = ค่าพิเศษบนผู้ใช้ Firebase Auth, หน้าที่: เก็บ role/flags เสริม
 *   • Revoke Tokens (รีโวค-โทเคนส์) = ยกเลิกโทเคนเดิมทั้งหมด, หน้าที่: บังคับให้ล็อกอินใหม่
 *
 * หมายเหตุความปลอดภัย:
 *   • ตรวจสิทธิ์ซ้ำที่ฝั่งเซิร์ฟเวอร์เสมอ (manage_users) แม้ฝั่ง client จะซ่อนปุ่มแล้ว
 *   • อนุญาตต้นทางผ่าน CORS เฉพาะโดเมนระบบเราเท่านั้น
 * ผู้เขียน: AI ผู้ช่วย (โหมดจับมือทำ)
 * ========================================================================== */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { emitAudit } from "./lib/emitAudit";
import { withCors } from "./withCors";
import { checkCanManageUsers, getRequesterEmail } from "./authz";

const APPROVER_KEY = defineSecret("APPROVER_KEY");
if (!admin.apps.length) admin.initializeApp();

function readKey(req: any) {
  return String(
    req.get("x-api-key") ||
    req.get("x-approver-key") ||
    req.query?.key ||
    req.body?.key ||
    ""
  );
}
function emailId(s: string) {
  return (s || "").trim().toLowerCase();
}
function ipOf(req: any) {
  const x = String(req.headers?.["x-forwarded-for"] || "");
  return (x.split(",")[0] || req.socket?.remoteAddress || "").trim() || undefined;
}
function uaOf(req: any) {
  return String(req.headers?.["user-agent"] || "") || undefined;
}

export const removeAdmin = onRequest(
  { region: "asia-southeast1", secrets: [APPROVER_KEY] },
  withCors(async (req, res) => {
    try {
      if (req.method !== "POST" && req.method !== "DELETE") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
      }

      // 1) ตรวจ key
      const provided = readKey(req);
      const secret = APPROVER_KEY.value() || process.env.APPROVER_KEY || "";
      if (!provided || provided !== secret) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
      }

      // 2) ตรวจสิทธิ์ manage_users
      const gate = await checkCanManageUsers(req as any);
      if (!gate.ok) {
        res.status(gate.status).json({ ok: false, error: gate.error });
        return;
      }

      // 3) อ่านอินพุต
      const body = (req as any).body || {};
      const email = emailId(String(body.email || req.query?.email || ""));
      if (!/.+@.+\..+/.test(email)) {
        res.status(400).json({ ok: false, error: "invalid_email" });
        return;
      }
      const softDelete = body.softDelete !== false; // default = true
      const requester = getRequesterEmail(req) || gate.email || undefined;

      // 4) จัดการ Firebase Auth (ลบ claims.role + revoke tokens ถ้ามีผู้ใช้)
      const auth = admin.auth();
      let uid: string | undefined = undefined;
      try {
        const u = await auth.getUserByEmail(email);
        uid = u.uid;
        const claims = { ...(u.customClaims || {}) } as Record<string, any>;
        delete (claims as any).role;
        await auth.setCustomUserClaims(u.uid, claims);
        await auth.revokeRefreshTokens(u.uid);
      } catch {
        // ไม่มีผู้ใช้ใน Auth ก็ข้ามได้
      }

      // 5) จัดการ Firestore
      const ref = admin.firestore().collection("admins").doc(email);
      if (softDelete) {
        await ref.set(
          {
            enabled: false,
            role: "viewer",
            caps: {},
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: requester || null,
          },
          { merge: true }
        );
      } else {
        await ref.delete();
      }

      // 6) audit log
      await emitAudit(
        "admin_removed",
        requester ? { email: requester } : "unknown",
        { type: "admin", id: uid, rid: email },
        softDelete ? "soft delete admin caps" : "delete admin doc",
        { ip: ipOf(req), ua: uaOf(req) }
      );

      res.json({ ok: true, email, uid, softDelete: !!softDelete });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  })
);
