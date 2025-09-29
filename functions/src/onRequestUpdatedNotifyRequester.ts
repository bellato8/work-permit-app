// ======================================================================
// ไฟล์: functions/src/onRequestUpdatedNotifyRequester.ts
// วันที่/เวลา: 2025-09-01
// ผู้เขียน (Written by): GPT-5 Thinking
// หน้าที่ไฟล์: Firestore trigger (on update) ส่งผลอนุมัติ/ไม่อนุมัติให้ "ผู้ขอ"
// ฟังก์ชัน:
//   - onRequestUpdatedNotifyRequester: ยิงเมื่อเอกสารถูกแก้ไข แล้ว "สถานะ" เปลี่ยน
// หมายเหตุสำคัญ:
//   - ใช้ Secrets: SMTP_USER / SMTP_PASS / SMTP_FROM / APP_BASE_URL
//   - ไม่สร้าง nodemailer ไว้นอก handler เพื่อลดโอกาส timeout ตอนโหลดโค้ด
// ======================================================================

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getApps, initializeApp } from "firebase-admin/app";
import nodemailer from "nodemailer";

// กัน initializeApp ซ้ำ (ไฟล์อื่นอาจ init ไปแล้ว)
if (!getApps().length) {
  initializeApp();
}

// ---------- Secrets ----------
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const SMTP_FROM = defineSecret("SMTP_FROM");
const APP_BASE_URL = defineSecret("APP_BASE_URL");

// ---------- Helpers ----------
function toThaiStatus(s: string) {
  const t = (s || "").toLowerCase();
  if (t.includes("approve") || t.includes("อนุมัติ")) return "อนุมัติแล้ว";
  if (t.includes("reject") || t.includes("ไม่อนุมัติ") || t.includes("ปฏิเสธ")) return "ไม่อนุมัติ";
  return s || "-";
}
function maskLast4FromAnyPhone(x: any): string {
  const raw = String(x ?? "").replace(/\D/g, "");
  return raw.length >= 4 ? raw.slice(-4) : "XXXX";
}

export const onRequestUpdatedNotifyRequester = onDocumentUpdated(
  {
    document: "requests/{rid}",
    region: "asia-southeast1",
    secrets: [SMTP_USER, SMTP_PASS, SMTP_FROM, APP_BASE_URL],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const before = event.data?.before?.data() as any;
    const after  = event.data?.after?.data() as any;
    if (!before || !after) return;

    const rid: string = after?.rid || event.params.rid;

    // เช็คว่า “สถานะ” เปลี่ยนจริงไหม
    const statusBefore = String(before.status || before.decision?.status || "");
    const statusAfter  = String(after.status  || after.decision?.status  || "");
    if (statusBefore === statusAfter) {
      logger.info("[updated:notifyRequester] skip (no status change)", { rid });
      return;
    }

    const thaiStatus = toThaiStatus(statusAfter);
    if (thaiStatus === "-" || thaiStatus === statusBefore) {
      logger.info("[updated:notifyRequester] skip (status not final)", { rid, statusAfter });
      return;
    }

    // หาอีเมลผู้ยื่นจากฟิลด์ที่เป็นไปได้
    const requesterEmail: string | undefined =
      after?.email ||
      after?.contact?.email ||
      after?.requester?.email ||
      after?.user?.email;

    if (!requesterEmail) {
      logger.info("[updated:notifyRequester] skip (no requester email)", { rid });
      return;
    }

    // หาเลขท้าย 4 ตัวสำหรับลิงก์ตรวจสอบ
    const last4 =
      maskLast4FromAnyPhone(
        after?.phone || after?.contact?.phone || after?.requester?.phone
      ) || "XXXX";

    const reason: string = after?.decision?.reason || after?.reason || "";

    const statusUrl = `${APP_BASE_URL.value()}/status?rid=${encodeURIComponent(
      rid
    )}&last4=${last4}`;

    try {
      // สร้าง transporter ข้างใน handler ทุกครั้งเพื่อความเสถียร
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
      });

      await transport.sendMail({
        from: SMTP_FROM.value(),
        to: requesterEmail,
        subject: `ผลการพิจารณาคำขอเข้าทำงาน • ${rid} • ${thaiStatus}`,
        html: `
          <p><b>เลขคำขอ:</b> ${rid}</p>
          <p><b>ผลการพิจารณา:</b> ${thaiStatus}</p>
          ${reason ? `<p><b>เหตุผล:</b> ${reason}</p>` : ""}
          <p>ตรวจสอบสถานะได้ที่:</p>
          <p><a href="${statusUrl}">${statusUrl}</a></p>
          <p>— ระบบ Work Permit</p>
        `,
      });

      logger.info("[updated:notifyRequester] sent", { rid, to: requesterEmail, thaiStatus });
    } catch (err: any) {
      logger.error("[updated:notifyRequester] send fail", { rid, err: err?.message });
      throw err;
    }
  }
);
