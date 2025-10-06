// ======================================================================
// File: functions/src/logAuth.ts
// เวอร์ชัน: 2025-10-06 (Asia/Bangkok)
// หน้าที่: รับ POST แล้วเขียนเหตุการณ์ auth ลง auditLogs (append-only) ผ่าน emitAudit
// การยืนยันตัวตน: ใช้ Authorization: Bearer <ID_TOKEN> (ไม่ใช้ x-api-key แล้ว)
// หมายเหตุ: ให้ใช้ res.json(...); return; เพื่อความชัดเจนใน onRequest (v2)
// อ้างอิงแนวทาง: เว็บแนบ ID Token → ฝั่งเซิร์ฟเวอร์ verifyIdToken ด้วย Admin SDK
//   - Verify ID Tokens (Admin SDK): https://firebase.google.com/docs/auth/admin/verify-id-tokens
//   - HTTP Cloud Functions v2 (onRequest): https://firebase.google.com/docs/functions/http-events
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import type { Request, Response } from "express";

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { withCors } from "./withCors";
import { emitAudit } from "./lib/emitAudit";

// initialize admin (ครั้งเดียวพอ)
if (!getApps().length) initializeApp();
// ให้ Firestore พร้อมใช้งานสำหรับ emitAudit ภายใน
getFirestore();

const REGION = "asia-southeast1";

/** ดึง Bearer token จากหัวข้อ Authorization */
function readBearer(req: Request): string | null {
  const authz = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  if (!authz) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authz);
  return m?.[1]?.trim() || null;
}

/** ล้างค่า undefined ทุกชั้น (ไม่แตะ "" หรือ null) */
function trimUndefDeep<T = any>(v: T): T {
  if (Array.isArray(v)) {
    return v.map((x) => trimUndefDeep(x)).filter((x) => x !== undefined) as any;
  }
  if (v && typeof v === "object") {
    const out: any = {};
    for (const [k, val] of Object.entries(v as any)) {
      const t = trimUndefDeep(val);
      if (t !== undefined) out[k] = t;
    }
    return out;
  }
  return v as any;
}

/** เอา IP ตัวแรกจาก X-Forwarded-For (ตัวลูกค้าจริงตามลำดับผ่าน LB) */
function readClientIp(req: Request): string | undefined {
  const xff = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : String(xff || "");
  const first = raw.split(",")[0]?.trim();
  return first || undefined;
}

export const logAuth = onRequest(
  { region: REGION, timeoutSeconds: 60, memory: "256MiB" },
  withCors(async (req: Request, res: Response) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
      }

      // ===== 1) ตรวจบัตรผ่าน (ID Token) =====
      const bearer = readBearer(req);
      if (!bearer) {
        res.status(401).json({ ok: false, error: "missing_authorization" });
        return;
      }

      let decoded: any;
      try {
        decoded = await getAuth().verifyIdToken(bearer); // ตรวจลายเซ็น/อายุบัตร
      } catch (e: any) {
        logger.warn("[logAuth] invalid_id_token", { err: e?.message });
        res.status(401).json({ ok: false, error: "invalid_authorization" });
        return;
      }

      const requesterEmail: string | undefined =
        (decoded && decoded.email) || (req.headers["x-requester-email"] as string | undefined);

      if (!requesterEmail) {
        res.status(403).json({ ok: false, error: "requester_email_required" });
        return;
      }

      // ===== 2) อ่านเนื้อหาจาก body (แบบปลอดภัย) =====
      const b: any = typeof req.body === "object" && req.body ? req.body : {};
      const action = String(b.action ?? "manual").toLowerCase();

      const acctEmail = typeof b.email === "string" ? b.email.trim() : "";
      const acctName  = typeof b.name === "string"  ? b.name.trim()  : "";
      const rid       = typeof b.rid === "string"   ? b.rid.trim()   : "";
      const note      = typeof b.note === "string"  ? b.note.trim()  : "";

      // ===== 3) รวบรวมรายละเอียดเสริม =====
      const ip = readClientIp(req);
      const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;

      // by = ผู้สั่งบันทึก (เชื่อถือจากโทเคน)
      const by = trimUndefDeep({
        email: requesterEmail,
        // ถ้ามีเคยใส่ role ใน custom claims ก็อ่านได้จาก decoded (ไม่บังคับ)
        role: decoded?.role || decoded?.roles?.role || undefined,
      });

      // target = เป้าหมายเหตุการณ์ (auth)
      const target = trimUndefDeep({
        type: "auth",
        rid: rid || undefined,
        id: acctEmail || undefined, // อีเมลบัญชีที่เกี่ยวข้อง (ถ้ามี)
      });

      const extra = trimUndefDeep({
        email: acctEmail || undefined,
        name: acctName || undefined,
        ip,
        ua,
        method: req.method,
        byUid: decoded?.uid || undefined,
      });

      // ===== 4) บันทึกลง auditLogs =====
      const id = await emitAudit(action, by, target, note || undefined, extra);

      res.status(200).json({ ok: true, id });
      return;
    } catch (e: any) {
      logger.error("[logAuth] internal_error", { err: e?.message || String(e) });
      res.status(500).json({ ok: false, error: "internal_error" });
      return;
    }
  })
);
