"use strict";
// ไฟล์: functions/src/onRequestCreatedNotifyApprovers.ts
// เวลา: 2025-09-10 16:55
// แก้อะไร: จัดหน้าอีเมลใหม่ (โทนเดียวกับหน้า Admin/PermitDetails) + แก้ปุ่มไป /admin/permits/{rid}
// Written by: Work Permit System Tutor
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRequestCreatedNotifyApprovers = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const firebase_functions_1 = require("firebase-functions");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const nodemailer_1 = __importDefault(require("nodemailer"));
const qrcode_1 = __importDefault(require("qrcode"));
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
// ---------- Secrets ----------
const SMTP_USER = (0, params_1.defineSecret)("SMTP_USER");
const SMTP_PASS = (0, params_1.defineSecret)("SMTP_PASS");
const SMTP_FROM = (0, params_1.defineSecret)("SMTP_FROM");
const APP_BASE_URL = (0, params_1.defineSecret)("APP_BASE_URL");
const APPROVER_EMAIL = (0, params_1.defineSecret)("APPROVER_EMAIL");
// ---------- Helpers ----------
const text = (v) => (v == null || v === "" ? "-" : String(v));
const boolText = (v) => {
    const s = String(v ?? "").toLowerCase();
    if (v === true)
        return "มี";
    if (v === false)
        return "ไม่มี";
    if (["มี", "yes", "true", "1", "hot", "hotwork"].includes(s))
        return "มี";
    if (["ไม่มี", "no", "false", "0"].includes(s))
        return "ไม่มี";
    return s || "-";
};
const maskId = (id) => {
    const s = String(id ?? "").replace(/\s+/g, "");
    if (!s)
        return "-";
    const digits = s.replace(/\D/g, "");
    const last4 = digits.slice(-4);
    return s.replace(/./g, "•").slice(0, Math.max(0, s.length - 4)) + last4;
};
const last4FromPhone = (p) => {
    const d = String(p ?? "").replace(/\D/g, "");
    return d.length >= 4 ? d.slice(-4) : "XXXX";
};
function formatFloor(any) {
    const s = String(any ?? "").toUpperCase().trim();
    if (!s)
        return "-";
    if (s === "BF")
        return "B1";
    if (/^[1-8]$/.test(s))
        return "F" + s;
    if (/^(B1|F[1-8])$/.test(s))
        return s;
    return s;
}
function systemsToText(bs) {
    if (!bs || typeof bs !== "object")
        return "-";
    const map = {
        electric: "ระบบไฟฟ้า",
        electricity: "ระบบไฟฟ้า",
        amp: "กำลังไฟ/แอมป์",
        lighting: "ระบบแสงสว่าง",
        hvac: "ระบบปรับอากาศ",
        air: "ระบบปรับอากาศ",
        water: "ระบบน้ำ",
        plumbing: "ระบบประปา",
        gas: "ระบบแก๊ส",
        fire: "ระบบป้องกันอัคคีภัย",
    };
    const labels = [];
    for (const [k, v] of Object.entries(bs)) {
        const key = k.toLowerCase().replace(/[^a-z]/g, "");
        if ((v === true || String(v).toLowerCase() === "true") && map[key])
            labels.push(map[key]);
    }
    if (bs.amp) {
        const amp = String(bs.amp).trim();
        if (amp && !labels.find(l => l.startsWith("ระบบไฟฟ้า")))
            labels.unshift(`ระบบไฟฟ้า (${amp})`);
    }
    return labels.length ? labels.join(", ") : "-";
}
function equipmentToText(eq) {
    if (!eq || typeof eq !== "object")
        return "-";
    if (eq.has === true || String(eq.has).toLowerCase() === "มี" || String(eq.has).toLowerCase() === "true") {
        const items = Array.isArray(eq.items) ? eq.items.filter(Boolean).join(", ") : "";
        if (eq.details && items)
            return `${eq.details} • ${items}`;
        if (eq.details)
            return String(eq.details);
        if (items)
            return items;
        return "มี (ไม่ได้ระบุรายละเอียด)";
    }
    if (eq.has === false || String(eq.has).toLowerCase() === "ไม่มี" || String(eq.has).toLowerCase() === "false")
        return "ไม่มี";
    return "-";
}
function mkAddress(loc) {
    const parts = [loc?.detail, loc?.subdistrict, loc?.district, loc?.province].filter(Boolean).map(String);
    return parts.length ? parts.join(" • ") : "-";
}
function workersTableHTML(workers) {
    if (!Array.isArray(workers) || workers.length === 0) {
        return `<tr><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;color:#64748b">ไม่มีข้อมูลผู้ร่วมงาน</td></tr>`;
    }
    return workers
        .map((w, i) => {
        const name = text(w?.name || w?.fullname || [w?.firstname, w?.lastname].filter(Boolean).join(" "));
        const sup = w?.isSupervisor ? " <b>(ผู้ควบคุมงาน)</b>" : "";
        const cid = maskId(w?.citizenId ?? w?.citizenIdMasked ?? w?.documentId ?? w?.idNumber ?? "");
        return `<tr>
        <td style="text-align:center; padding:8px; border:1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding:8px; border:1px solid #e5e7eb;">${name}${sup}</td>
        <td style="padding:8px; border:1px solid #e5e7eb; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${cid}</td>
      </tr>`;
    })
        .join("");
}
const styles = `
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#f8fafc; color:#111827; margin:0}
  .wrap{max-width:820px;margin:20px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}
  .hd{padding:18px 24px;border-bottom:3px solid #2563eb}
  .hd h1{margin:0;font-size:20px;color:#2563eb}
  .sec{padding:16px 24px}
  .grid{display:grid;grid-template-columns:180px 1fr;gap:8px 16px}
  .k{color:#64748b}
  .v{color:#111827}
  .mono{font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; background:#f1f5f9; padding:2px 6px; border-radius:6px}
  .btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;border:1px solid #1d4ed8}
  .tbl{width:100%;border-collapse:collapse;margin-top:8px}
  .tbl th{background:#f8fafc;text-align:left;padding:8px;border:1px solid #e5e7eb}
  .tbl td{padding:8px;border:1px solid #e5e7eb}
  .foot{padding:16px 24px;border-top:1px solid #e5e7eb;color:#64748b;font-size:13px}
  .qr{display:flex;gap:14px;align-items:center;margin-top:10px}
`;
function emailTemplate(p) {
    return `<!doctype html>
<html><head><meta charset="utf-8"><style>${styles}</style><title>${p.rid}</title></head>
<body>
  <div class="wrap">
    <div class="hd"><h1>คำขอเข้าทำงานใหม่ (รอการพิจารณา)</h1></div>

    <div class="sec">
      <div class="grid">
        <div class="k">RID:</div><div class="v mono">${p.rid}</div>
        <div class="k">วันที่ยื่น:</div><div class="v">${p.createdAtText}</div>
      </div>
    </div>

    <div class="sec">
      <h3 style="margin:0 0 8px 0">1) ข้อมูลผู้ยื่น</h3>
      <div class="grid">
        <div class="k">ชื่อ-นามสกุล:</div><div class="v">${p.requesterName}</div>
        <div class="k">บริษัท:</div><div class="v">${p.company}</div>
        <div class="k">เบอร์โทรศัพท์:</div><div class="v">${p.phone}</div>
        <div class="k">อีเมล:</div><div class="v">${p.email}</div>
      </div>
    </div>

    <div class="sec">
      <h3 style="margin:0 0 8px 0">2) รายละเอียดงาน/สถานที่</h3>
      <div class="grid">
        <div class="k">ประเภทงาน:</div><div class="v">${p.jobType}</div>
        <div class="k">พื้นที่:</div><div class="v">${p.area}</div>
        <div class="k">ชั้น:</div><div class="v">${p.floor}</div>
        <div class="k">ที่อยู่/อาคาร:</div><div class="v">${p.address}</div>
        <div class="k">ช่วงเวลา:</div><div class="v">${p.timeFrom} - ${p.timeTo}</div>
      </div>
    </div>

    <div class="sec">
      <h3 style="margin:0 0 8px 0">3) ลักษณะงานพิเศษ</h3>
      <div class="grid">
        <div class="k">งานที่เกิดความร้อน:</div><div class="v">${p.hotWork}</div>
        <div class="k">งานเกี่ยวกับระบบอาคาร:</div><div class="v">${p.systems}</div>
        <div class="k">อุปกรณ์นำเข้า/ออก:</div><div class="v">${p.equipment}</div>
      </div>
    </div>

    <div class="sec">
      <h3 style="margin:0 0 8px 0">4) รายชื่อผู้ร่วมงาน (${p.workersCount} คน)</h3>
      <table class="tbl">
        <thead><tr><th>#</th><th>ชื่อ-นามสกุล</th><th>เลขเอกสารยืนยันตัวตน</th></tr></thead>
        <tbody>${p.workersTableRows}</tbody>
      </table>
    </div>

    <div class="sec">
      <a href="${p.humanUrl}" class="btn">เปิดหน้าตัดสินใจ (อนุมัติ / ไม่อนุมัติ)</a>
      <div style="margin-top:8px">หรือไปที่ <a href="${p.humanUrl}">${p.humanUrl}</a></div>
    </div>

    <div class="foot">
      <div>ตรวจสอบสถานะได้ที่: <a href="${p.statusUrl}">${p.statusUrl}</a></div>
      <div class="qr">
        <img src="${p.qrDataUrl}" alt="QR Code" style="width:100px;height:100px"/>
        <div>สแกนเพื่อตรวจสอบสถานะล่าสุดของคำขอ</div>
      </div>
    </div>
  </div>
</body></html>`;
}
// ---------- Trigger ----------
exports.onRequestCreatedNotifyApprovers = (0, firestore_1.onDocumentCreated)({
    document: "requests/{rid}",
    region: "asia-southeast1",
    secrets: [SMTP_USER, SMTP_PASS, SMTP_FROM, APP_BASE_URL, APPROVER_EMAIL],
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const db = (0, firestore_2.getFirestore)();
    const data = snap.data();
    const rid = data?.rid || event.params.rid;
    const requester = data?.requester ?? {};
    const work = data?.work ?? {};
    const location = work?.location ?? data?.location ?? {};
    const bs = work?.buildingSystems ?? data?.buildingSystems ?? {};
    const eq = work?.equipments ?? data?.equipments ?? {};
    const workers = Array.isArray(data?.workers) ? data.workers
        : Array.isArray(work?.workers) ? work.workers
            : Array.isArray(data?.team) ? data.team : [];
    const payload = {
        rid,
        createdAtText: (data?.createdAt?.toDate?.()?.toLocaleString?.("th-TH")) ||
            new Date().toLocaleString("th-TH"),
        requesterName: text(requester.fullname ?? requester.name ?? data?.contractorName),
        company: text(requester.company ?? data?.company),
        phone: text(requester.phone ?? data?.phone),
        email: text(requester.email ?? data?.email),
        jobType: text(work?.type ?? data?.type ?? data?.jobType),
        area: text(work?.area ?? data?.area),
        floor: text(formatFloor(work?.floor ?? data?.floor)),
        address: text(mkAddress(location)),
        timeFrom: text(work?.from ?? data?.from ?? work?.time?.start ?? data?.time?.start),
        timeTo: text(work?.to ?? data?.to ?? work?.time?.end ?? data?.time?.end),
        hotWork: boolText(work?.hotWork ?? data?.hotWork),
        systems: systemsToText(bs),
        equipment: text(equipmentToText(eq)),
        workersCount: Array.isArray(workers) ? workers.length : 0,
        workersTableRows: workersTableHTML(workers),
        statusUrl: "",
        humanUrl: "",
        qrDataUrl: "",
    };
    // ลิงก์ Status
    const base = (APP_BASE_URL.value() || "").replace(/\/+$/, "");
    const last4 = last4FromPhone(requester.phone ?? data?.phone);
    payload.statusUrl = `${base}/status?rid=${encodeURIComponent(rid)}&last4=${last4}`;
    // (แก้ไข) ปุ่มไปหน้า Admin ที่ถูกต้อง: /admin/permits/{rid}
    payload.humanUrl = `${base}/admin/permits/${encodeURIComponent(rid)}`;
    // QR
    payload.qrDataUrl = await qrcode_1.default.toDataURL(payload.statusUrl, { errorCorrectionLevel: "low" });
    // เลือกอีเมลผู้อนุมัติ
    let approvers = (APPROVER_EMAIL.value() || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (!approvers.length) {
        const adminSnap = await db.collection("admins").get();
        approvers = adminSnap.docs.map((d) => d.id).filter((x) => /@/.test(x));
    }
    if (!approvers.length) {
        firebase_functions_1.logger.warn("[approver:notify] no approver emails; skip", { rid });
        return;
    }
    // ส่งอีเมล
    try {
        const transport = nodemailer_1.default.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
        });
        const html = emailTemplate(payload);
        const info = await transport.sendMail({
            from: SMTP_FROM.value(),
            to: approvers,
            subject: `คำขอเข้าทำงานใหม่: ${payload.jobType} โดย ${payload.company}`,
            html,
        });
        firebase_functions_1.logger.info("[approver:notify] sent", { rid, to: approvers.length, msgId: info.messageId });
    }
    catch (err) {
        firebase_functions_1.logger.error("[approver:notify] send fail", { rid, err: err?.message });
        throw err;
    }
});
