// ======================================================================
// File: functions/src/logAuth.ts
// เวอร์ชัน: 19/09/2025 03:20 (แก้ชนิดรีเทิร์นให้เป็น void, เพิ่ม type Request/Response, คง sanitize ลึก)
// หน้าที่: รับ POST แล้วเขียนเหตุการณ์ auth ลง auditLogs (append-only) ผ่าน emitAudit
// เชื่อม auth ผ่าน: Secret APPROVER_KEY + ต้องมี requester (หัวข้อหรือพารามิเตอร์)
// หมายเหตุ: ห้าม `return res.json(...)`; ให้ `res.json(...); return;` เพื่อให้ตรงกับ withCors(req,res)=>Promise<void>|void
// วันที่/เวลา: 19/09/2025 03:20
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Request, Response } from "express";
import { withCors } from "./withCors";
import { emitAudit } from "./lib/emitAudit";

if (!getApps().length) initializeApp();
// ใช้เพื่อ initial Firestore (ไม่ใช้ตรง ๆ ในไฟล์นี้ แต่ช่วยให้ admin พร้อม)
getFirestore();

const REGION = "asia-southeast1";
const APPROVER_KEY = defineSecret("APPROVER_KEY"); // ผูก secret ระดับฟังก์ชัน (v2) — อ่านค่าด้วย .value()

/** ล้างค่า undefined ทุกชั้น (ไม่แตะค่าที่เป็น "" หรือ null) */
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

function readKey(req: Request): string {
  const h = req.headers as Record<string, any>;
  return (
    (req.query?.key as string) ||
    (req.body && (req.body as any).key) ||
    (h["x-api-key"] as string) ||
    ""
  ).toString().trim();
}

function readRequester(req: Request): string {
  const h = req.headers as Record<string, any>;
  return (
    (req.query?.requester as string) ||
    (req.body && (req.body as any).requester) ||
    (h["x-requester-email"] as string) ||
    ""
  ).toString().trim();
}

export const logAuth = onRequest(
  { region: REGION, secrets: [APPROVER_KEY], timeoutSeconds: 60, memory: "256MiB" },
  withCors(async (req: Request, res: Response) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
      }

      const key = readKey(req);
      const requester = readRequester(req);

      // ตรวจ Secret จาก defineSecret() (อ่านค่าด้วย APPROVER_KEY.value())
      if (!key || key !== APPROVER_KEY.value()) {
        res.status(403).json({ ok: false, error: "forbidden" });
        return;
      }
      if (!requester) {
        res.status(400).json({ ok: false, error: "requester_required" });
        return;
      }

      // ดึง body แบบปลอดภัย
      const b: any = typeof req.body === "object" && req.body ? req.body : {};
      const action = String(b.action ?? "manual").toLowerCase();
      const acctEmail = typeof b.email === "string" ? b.email : "";
      const acctName = typeof b.name === "string" ? b.name : "";
      const rid = typeof b.rid === "string" ? b.rid : "";
      const note = typeof b.note === "string" ? b.note : "";

      // ip / ua / method
      const xfwd = req.headers["x-forwarded-for"];
      const xfwdFirst =
        Array.isArray(xfwd) ? xfwd[0] : String(xfwd || "").split(",")[0].trim();
      const ip =
        (typeof b.ip === "string" && b.ip.trim()) ||
        (xfwdFirst ? xfwdFirst : undefined);

      const ua =
        typeof req.headers["user-agent"] === "string"
          ? (req.headers["user-agent"] as string)
          : undefined;

      // by = คนสั่งบันทึก (ผู้ดูแล/ระบบ)
      const by = trimUndefDeep({
        email: requester || undefined,
        role: "superadmin", // ถ้าอนาคตมี role จริง ค่อยแมพตาม claims
      });

      // target = เป้าหมายเหตุการณ์ (auth)
      const target = trimUndefDeep({
        type: "auth",
        rid: rid || undefined,
        id: acctEmail || undefined, // อีเมลบัญชีที่เกี่ยวข้อง (ถ้ามี)
      });

      // extra = ข้อมูลเสริม สำหรับ debug/ตรวจสอบภายหลัง
      const extra = trimUndefDeep({
        email: acctEmail || undefined,
        name: acctName || undefined,
        ip,
        ua,
        method: req.method,
      });

      // บันทึกลง auditLogs (append-only)
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
