"use strict";
// ======================================================================
// File: functions/src/onRequestCreated.ts
// เวอร์ชัน: 2025-10-25 (แก้ไข: เพิ่มการส่ง email ยืนยันไปหาผู้กรอกฟอร์ม)
// หน้าที่: Firestore Trigger (on create) ส่งอีเมล 2 ฉบับ:
//          1) ยืนยันรับคำขอไปหาผู้กรอกฟอร์ม (requester)
//          2) แจ้งผู้อนุมัติ + แอดมินทั้งหมด
// จุดเด่น: table-based + inline CSS, preheader, bulletproof button (VML),
//          plain-text fallback, QR (CID), idempotent send (transaction lock)
// ======================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRequestCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const firestore_2 = require("firebase-admin/firestore");
const admin_1 = require("./admin");
const nodemailer_1 = __importDefault(require("nodemailer"));
const qrcode_1 = __importDefault(require("qrcode"));
// ---------- Secrets ----------
const SMTP_USER = (0, params_1.defineSecret)("SMTP_USER");
const SMTP_PASS = (0, params_1.defineSecret)("SMTP_PASS");
const SMTP_FROM = (0, params_1.defineSecret)("SMTP_FROM");
const APP_BASE_URL = (0, params_1.defineSecret)("APP_BASE_URL"); // เช่น https://imperialworld.asia
// ---------- Helpers ----------
const safe = (v) => {
    const s = (v ?? "").toString().trim();
    return s.length ? s : "-";
};
const toDate = (val) => {
    try {
        if (!val)
            return null;
        if (val.seconds)
            return new Date(val.seconds * 1000);
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    catch {
        return null;
    }
};
const fmtDate = (dt) => {
    if (!dt)
        return "-";
    try {
        return dt.toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    catch {
        const y = dt.getFullYear();
        const m = `${dt.getMonth() + 1}`.padStart(2, "0");
        const d = `${dt.getDate()}`.padStart(2, "0");
        const hh = `${dt.getHours()}`.padStart(2, "0");
        const mm = `${dt.getMinutes()}`.padStart(2, "0");
        return `${y}-${m}-${d} ${hh}:${mm}`;
    }
};
const durationText = (from, to) => {
    if (!from || !to)
        return "-";
    const ms = Math.max(0, to.getTime() - from.getTime());
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h} ชม ${m} นาที` : `${m} นาที`;
};
function uniqEmails(arr) {
    const s = new Set();
    for (const e of arr) {
        const v = (e ?? "").toString().trim().toLowerCase();
        if (v)
            s.add(v);
    }
    return Array.from(s);
}
// ดึงแอดมิน/ผู้อนุมัติทั้งหมดที่ enabled
async function getAdminRecipients() {
    const snap = await admin_1.db.collection("admins").where("enabled", "==", true).get();
    const emails = [];
    snap.forEach((doc) => {
        const data = doc.data() || {};
        const role = (data.role || "").toString();
        const caps = Array.isArray(data.caps) ? data.caps : [];
        const email = (data.email || doc.id || "").toString();
        const isAdminRole = ["superadmin", "admin", "approver"].includes(role);
        const canApprove = caps.includes("approve");
        if ((isAdminRole || canApprove) && email)
            emails.push(email);
    });
    return uniqEmails(emails);
}
exports.onRequestCreated = (0, firestore_1.onDocumentCreated)({
    region: "asia-southeast1",
    document: "requests/{rid}",
    secrets: [SMTP_USER, SMTP_PASS, SMTP_FROM, APP_BASE_URL],
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const rid = event.params.rid;
    const rec = snap.data() || {};
    // ---------- STEP 1: transaction lock (กันยิงซ้ำ) ----------
    const reqRef = admin_1.db.collection("requests").doc(rid);
    const locked = await admin_1.db.runTransaction(async (tx) => {
        const doc = await tx.get(reqRef);
        const mailLog = doc.get("mailLog") || {};
        const hasSent = !!mailLog?.createdNoticeSentAt;
        const hasLock = !!mailLog?.createdNoticeLock;
        if (hasSent || hasLock)
            return true;
        tx.set(reqRef, { mailLog: { createdNoticeLock: firestore_2.FieldValue.serverTimestamp() } }, { merge: true });
        return false;
    });
    if (locked)
        return;
    // ---------- STEP 2: เก็บข้อมูลจากเอกสาร ----------
    const requesterName = rec?.requester?.fullname ||
        [rec?.requester?.firstname, rec?.requester?.lastname].filter(Boolean).join(" ") ||
        rec?.requesterName || "-";
    const requesterEmail = rec?.requester?.email || rec?.requesterEmail || "";
    const requesterPhone = rec?.requester?.phone || rec?.requesterPhone || "";
    const company = rec?.requester?.company ?? rec?.company ?? "-";
    const area = rec?.work?.area ?? rec?.area ?? "-";
    const building = rec?.work?.building ?? rec?.building ?? "";
    const floor = rec?.work?.floor ?? rec?.floor ?? "-";
    const locationLine = [area, building, floor ? `ชั้น ${floor}` : ""].filter(Boolean).join(" • ");
    const jobType = rec?.work?.type ?? rec?.work?.jobType ?? rec?.type ?? "-";
    const jobDetail = rec?.work?.detail ?? rec?.detail ?? rec?.description ?? "";
    const timeFrom = toDate(rec?.work?.from ?? rec?.from);
    const timeTo = toDate(rec?.work?.to ?? rec?.to);
    const timeFromStr = fmtDate(timeFrom);
    const timeToStr = fmtDate(timeTo);
    const durStr = durationText(timeFrom, timeTo);
    const workers = (rec?.work?.people ?? rec?.people ?? rec?.workers ?? []);
    const workersCount = Array.isArray(workers) ? workers.length : Number(rec?.workersCount ?? 0);
    const firstWorkers = (Array.isArray(workers) ? workers : [])
        .slice(0, 6)
        .map((w) => w?.name || w?.fullname || `${w?.firstname || ""} ${w?.lastname || ""}`.trim())
        .filter(Boolean);
    const supervisor = rec?.work?.supervisor?.name ?? rec?.supervisor?.name ?? rec?.supervisor ?? "";
    const hotWork = !!(rec?.work?.hotWork ?? rec?.hotWork);
    const riskNotes = rec?.work?.riskNotes ?? rec?.riskNotes ?? "";
    const hasAttachments = (!!rec?.attachments && rec.attachments.length > 0) ||
        (!!rec?.files && rec.files.length > 0) ||
        (!!rec?.images && rec.images.length > 0);
    // ลิงก์สถานะ + ลิงก์หน้า "ตัดสินผล" (ต้องล็อกอิน) + QR (CID)
    const appBase = APP_BASE_URL.value() || "";
    const statusLink = `${appBase}/status?rid=${encodeURIComponent(rid)}`;
    const decisionPage = `${appBase}/admin/permits?rid=${encodeURIComponent(rid)}`; // ← หน้าเว็บต้องล็อกอิน
    const qrPng = await qrcode_1.default.toBuffer(statusLink, { type: "png", width: 200 });
    // รายชื่อผู้รับ (admin + approver) → BCC
    const recipients = await getAdminRecipients();
    const bccList = uniqEmails(recipients);
    if (bccList.length === 0)
        bccList.push((SMTP_FROM.value() || "").toString());
    // สร้าง transporter
    const transporter = nodemailer_1.default.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
    // ========== EMAIL 1: ส่งให้ผู้กรอกฟอร์ม (Requester) ==========
    if (requesterEmail) {
        const requesterSubject = `ระบบได้รับคำขอของคุณแล้ว ✅ • เลขคำขอ: ${rid}`;
        const requesterPreheader = `เลขคำขอ: ${rid} • ตรวจสอบสถานะได้ที่ลิงก์ด้านล่าง`;
        const bulletproofBtnRequester = (href, label) => `
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="12%" stroke="f" fillcolor="#10b981">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">
            ${label}
          </center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${href}" target="_blank" rel="noopener"
           style="background:#10b981;border-radius:12px;color:#ffffff;display:inline-block;font-weight:700;
                  line-height:44px;text-align:center;text-decoration:none;width:260px;">
          ${label}
        </a>
        <!--<![endif]-->
      `;
        const requesterHtml = `
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${requesterSubject}</title>
  <style>
    .preheader { display:none!important; visibility:hidden; mso-hide:all;
      font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; }
    a { text-decoration:none; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div class="preheader">${requesterPreheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:20px 24px;background:#10b981;color:#ffffff;font:bold 20px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
              ระบบได้รับคำขอของคุณแล้ว ✅
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
                เรียน คุณ${safe(requesterName)}
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
                ระบบได้รับคำขอเข้าทำงานของคุณเรียบร้อยแล้ว
              </p>
              <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin:0 0 16px;">
                <div style="font-weight:600;margin-bottom:8px;color:#166534;">เลขคำขอ: ${rid}</div>
                <div style="color:#166534;">บริษัท: ${safe(company)}</div>
                <div style="color:#166534;">สถานที่: ${safe(locationLine)}</div>
                <div style="color:#166534;">ช่วงเวลา: ${safe(timeFromStr)} — ${safe(timeToStr)}</div>
              </div>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">
                ตรวจสอบสถานะได้ที่ลิงก์นี้:
              </p>
              <div style="text-align:center;margin:0 0 24px;">
                ${bulletproofBtnRequester(statusLink, "ตรวจสอบสถานะ")}
              </div>
              <div style="text-align:center;margin:0 0 16px;">
                <img src="cid:status-qr" alt="QR for status" width="150" height="150"
                     style="border:1px solid #e5e7eb;border-radius:8px;display:inline-block;">
                <div style="margin-top:8px;font-size:12px;color:#6b7280;">
                  สแกน QR Code เพื่อตรวจสอบสถานะ
                </div>
              </div>
              <div style="font-size:14px;color:#6b7280;line-height:1.5;">
                หรือคัดลอกลิงก์: <a href="${statusLink}" style="color:#2563eb">${statusLink}</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;">
              — ระบบ Work Permit<br>
              อีเมลนี้ถูกส่งอัตโนมัติ • RID: ${rid} • เวลา: ${fmtDate(new Date())} (ICT)
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
        const requesterText = [
            `ระบบได้รับคำขอของคุณแล้ว ✅`,
            ``,
            `เลขคำขอ: ${rid}`,
            ``,
            `ตรวจสอบสถานะได้ที่ลิงก์นี้:`,
            `${statusLink}`,
            ``,
            `— ระบบ Work Permit`,
        ].join("\n");
        try {
            await transporter.sendMail({
                from: SMTP_FROM.value(),
                to: requesterEmail,
                subject: requesterSubject,
                html: requesterHtml,
                text: requesterText,
                attachments: [
                    {
                        filename: `qr-${rid}.png`,
                        content: qrPng,
                        contentType: "image/png",
                        cid: "status-qr",
                    },
                ],
            });
            console.log(`✅ Email ยืนยันส่งไปหา ${requesterEmail} แล้ว`);
        }
        catch (err) {
            console.error(`❌ ส่ง email ยืนยันไปหา ${requesterEmail} ไม่สำเร็จ:`, err);
        }
    }
    // ========== EMAIL 2: ส่งให้ Admin/Approver ==========
    const adminPreheader = `RID ${rid} • ${company} • ${locationLine} • ${timeFromStr}–${timeToStr} (${durStr})`;
    const adminSubject = `คำขอเข้าทำงานใหม่ • RID: ${rid} • ${company} • ${locationLine}`;
    const bulletproofBtnAdmin = (href, label) => `
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="12%" stroke="f" fillcolor="#111827">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;">
          ${label}
        </center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${href}" target="_blank" rel="noopener"
         style="background:#111827;border-radius:12px;color:#ffffff;display:inline-block;font-weight:700;
                line-height:44px;text-align:center;text-decoration:none;width:260px;">
        ${label}
      </a>
      <!--<![endif]-->
    `;
    const adminHtml = `
<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${adminSubject}</title>
  <style>
    .preheader { display:none!important; visibility:hidden; mso-hide:all;
      font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; }
    a { text-decoration:none; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div class="preheader">${adminPreheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:20px 24px;background:#111827;color:#ffffff;font:bold 20px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;">
              คำขอเข้าทำงานใหม่ <span style="opacity:.8;font-weight:400">• RID: ${rid}</span>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding:16px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
                    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="width:34%;font-weight:600;background:#eef2ff;">บริษัท</td>
                        <td>${safe(company)}</td>
                      </tr>
                      <tr>
                        <td style="font-weight:600;background:#eef2ff;">สถานที่</td>
                        <td>${safe(locationLine)}</td>
                      </tr>
                      <tr>
                        <td style="font-weight:600;background:#eef2ff;">ช่วงเวลา</td>
                        <td>${safe(timeFromStr)} — ${safe(timeToStr)} <span style="color:#6b7280">(${durStr})</span></td>
                      </tr>
                      <tr>
                        <td style="font-weight:600;background:#eef2ff;">ประเภทงาน</td>
                        <td>${safe(jobType)}</td>
                      </tr>
                      <tr>
                        <td style="font-weight:600;background:#eef2ff;">ผู้ยื่น</td>
                        <td>${safe(requesterName)}
                          ${requesterPhone ? `• <span style="color:#6b7280">${safe(requesterPhone)}</span>` : ""}
                          ${requesterEmail ? `• <a href="mailto:${requesterEmail}" style="color:#2563eb">${requesterEmail}</a>` : ""}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-weight:600;background:#eef2ff;">หัวหน้างาน</td>
                        <td>${safe(supervisor)}</td>
                      </tr>
                      <tr>
                        <td style="font-weight:600;background:#eef2ff;">จำนวนคนทำงาน</td>
                        <td>${workersCount || firstWorkers.length ? (workersCount || firstWorkers.length) : "-"} คน
                          ${firstWorkers.length ? `<div style="margin-top:6px;color:#374151;font-size:13px;">${firstWorkers.join(", ")}${workersCount > firstWorkers.length ? ` … (+${workersCount - firstWorkers.length})` : ""}</div>` : ""}
                        </td>
                      </tr>
                      <tr>
                        <td style="font-weight:600;background:#eef2ff;">ความเสี่ยง/หมายเหตุ</td>
                        <td>${riskNotes ? safe(riskNotes) : (hotWork ? "งานเสี่ยง (Hot Work)" : "-")}</td>
                      </tr>
                      <tr>
                        <td style="font-weight:600;background:#eef2ff;">ไฟล์แนบ</td>
                        <td>${hasAttachments ? "มี" : "ไม่มี"}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Job detail -->
          <tr>
            <td style="padding:0 24px 6px;">
              <div style="font-weight:600;margin-bottom:6px;">รายละเอียดงาน</div>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
                ${safe(jobDetail)}
              </div>
            </td>
          </tr>

          <!-- QR + button -->
          <tr>
            <td style="padding:18px 24px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="margin:0 0 6px;">QR ไปหน้าตรวจสอบสถานะ</div>
                    <img src="cid:status-qr" alt="QR for status" width="120" height="120"
                         style="border:1px solid #e5e7eb;border-radius:8px;display:block;">
                    <div style="margin-top:8px;font-size:12px;">
                      หรือเปิดลิงก์: <a href="${statusLink}" style="color:#2563eb">${statusLink}</a>
                    </div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    ${bulletproofBtnAdmin(decisionPage, "เปิดหน้าตัดสิน (อนุมัติ/ไม่อนุมัติ)")}
                    <div style="font-size:12px;color:#6b7280;margin-top:6px;">
                      * ต้อง <b>ล็อกอิน</b> ก่อนตัดสินผล เพื่อระบุผู้อนุมัติที่แท้จริง
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px 24px;color:#6b7280;font-size:12px;">
              อีเมลนี้ถูกส่งอัตโนมัติจากระบบ Work Permit<br>
              RID: ${rid} • เวลาระบบ: ${fmtDate(new Date())} (ICT)
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
    const adminText = [
        `คำขอเข้าทำงานใหม่ | RID: ${rid}`,
        `บริษัท: ${safe(company)}`,
        `สถานที่: ${safe(locationLine)}`,
        `ช่วงเวลา: ${safe(timeFromStr)} — ${safe(timeToStr)} (${durStr})`,
        `ประเภทงาน: ${safe(jobType)}`,
        `ผู้ยื่น: ${safe(requesterName)} ${requesterPhone ? `| ${safe(requesterPhone)}` : ""} ${requesterEmail ? `| ${requesterEmail}` : ""}`,
        `หัวหน้างาน: ${safe(supervisor)}`,
        `จำนวนคนทำงาน: ${workersCount || firstWorkers.length ? (workersCount || firstWorkers.length) : "-"}`,
        `ความเสี่ยง/หมายเหตุ: ${riskNotes ? safe(riskNotes) : (hotWork ? "งานเสี่ยง (Hot Work)" : "-")}`,
        `ไฟล์แนบ: ${hasAttachments ? "มี" : "ไม่มี"}`,
        ``,
        `รายละเอียดงาน:`,
        safe(jobDetail),
        ``,
        `ดูสถานะ: ${statusLink}`,
        `ตัดสินผล (ต้องล็อกอิน): ${decisionPage}`,
    ].join("\n");
    const info = await transporter.sendMail({
        from: SMTP_FROM.value(),
        to: SMTP_FROM.value(), // กล่องระบบ (กันโดนมองว่าไม่มีผู้รับหลัก)
        bcc: bccList, // แอดมิน/ผู้อนุมัติทั้งหมด
        subject: adminSubject,
        html: adminHtml,
        text: adminText,
        attachments: [
            {
                filename: `qr-${rid}.png`,
                content: qrPng,
                contentType: "image/png",
                cid: "status-qr",
            },
        ],
    });
    // ---------- STEP 5: ปลดล็อก + บันทึก log ----------
    await reqRef.set({
        mailLog: {
            createdNoticeSentAt: firestore_2.FieldValue.serverTimestamp(),
            createdNoticeLock: firestore_2.FieldValue.delete(),
            lastMessageId: info?.messageId || null,
            recipientsCount: bccList.length,
            requesterEmailSent: !!requesterEmail,
        },
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    }, { merge: true });
});
