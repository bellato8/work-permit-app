"use strict";
// ======================================================================
// File: functions/src/inviteAdmin.ts
// เวอร์ชัน: 27/09/2025 02:55
// หน้าที่: ออกลิงก์ "ตั้ง/รีเซ็ตรหัสผ่าน" ให้ผู้ดูแล + บันทึก audit + หย่อนจดหมายลง mail
// เชื่อม auth ผ่าน "อะแดปเตอร์" 2 ทางเลือก:
//   1) มีบัตร (Authorization: Bearer ...)
//   2) มีกุญแจทีม + อีเมลผู้กด (เข้ากันได้กับของเดิม)
// หมายเหตุ: หลังได้ลิงก์ จะเพิ่มเอกสารลงคอลเลกชัน mail ตามรูปแบบที่ส่วนขยายต้องการ
// วันที่/เดือน/ปี เวลา
// ======================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.inviteAdmin = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const withCors_1 = require("./withCors");
const REGION = "asia-southeast1";
const APPROVER_KEY = (0, params_1.defineSecret)("APPROVER_KEY");
if (!admin.apps.length)
    admin.initializeApp();
function readKey(req) {
    return String(req.get("x-api-key") ||
        req.get("x-approver-key") ||
        req.query?.key ||
        req.body?.key ||
        "").trim();
}
function readRequester(req) {
    return String(req.get("x-requester-email") ||
        req.query?.requester ||
        req.body?.requester ||
        "")
        .trim()
        .toLowerCase();
}
function isEmail(s) {
    return /.+@.+\..+/.test(s);
}
function bearerFrom(req) {
    const raw = String(req.get("authorization") || "");
    const m = raw.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : "";
}
// ทางเลือก A: มี “บัตร”
async function gateByBearer(req) {
    try {
        const token = bearerFrom(req);
        if (!token)
            return { ok: false, status: 401, error: "missing_bearer" };
        const decoded = await admin.auth().verifyIdToken(token, true);
        const email = (decoded.email || "").toLowerCase();
        if (!email)
            return { ok: false, status: 401, error: "bearer_no_email" };
        const db = admin.firestore();
        const snap = await db
            .collection("admins")
            .where("email", "==", email)
            .where("enabled", "==", true)
            .limit(1)
            .get();
        if (snap.empty)
            return { ok: false, status: 403, error: "requester_not_admin" };
        const doc = snap.docs[0].data();
        const caps = Array.isArray(doc?.caps) ? doc.caps : [];
        const role = String(doc?.role || "");
        const can = role === "superadmin" ||
            caps.includes("*") ||
            caps.includes("manage_users");
        if (!can)
            return { ok: false, status: 403, error: "forbidden_caps" };
        return { ok: true, email };
    }
    catch {
        return { ok: false, status: 401, error: "invalid_bearer" };
    }
}
// ทางเลือก B: มีกุญแจทีม + อีเมลผู้กด
async function gateByKeyAndRequester(req) {
    const provided = readKey(req);
    const requester = readRequester(req);
    const secret = APPROVER_KEY.value() || process.env.APPROVER_KEY || "";
    if (!provided)
        return { ok: false, status: 401, error: "missing_key" };
    if (provided !== secret)
        return { ok: false, status: 401, error: "bad_key" };
    if (!isEmail(requester))
        return { ok: false, status: 400, error: "invalid_requester" };
    const db = admin.firestore();
    const snap = await db
        .collection("admins")
        .where("email", "==", requester)
        .where("enabled", "==", true)
        .limit(1)
        .get();
    if (snap.empty)
        return { ok: false, status: 403, error: "requester_not_admin" };
    const doc = snap.docs[0].data();
    const caps = Array.isArray(doc?.caps) ? doc.caps : [];
    const role = String(doc?.role || "");
    const can = role === "superadmin" || caps.includes("*") || caps.includes("manage_users");
    if (!can)
        return { ok: false, status: 403, error: "forbidden_caps" };
    return { ok: true, email: requester };
}
function ipOf(req) {
    const x = String(req.headers["x-forwarded-for"] || "");
    return (x.split(",")[0] || req.socket?.remoteAddress || "").trim() || undefined;
}
function uaOf(req) {
    return String(req.headers["user-agent"] || "") || undefined;
}
exports.inviteAdmin = (0, https_1.onRequest)({ region: REGION, secrets: [APPROVER_KEY] }, (0, withCors_1.withCors)(async (req, res) => {
    try {
        if (req.method !== "POST") {
            res.status(405).json({ ok: false, error: "method_not_allowed" });
            return;
        }
        // ด่านตรวจ: A ถ้ามี “บัตร”, ถ้าไม่มี → B ใช้กุญแจทีม + อีเมลผู้กด
        let gate = await gateByBearer(req);
        if (!gate.ok && gate.error === "missing_bearer") {
            gate = await gateByKeyAndRequester(req);
        }
        if (!gate.ok) {
            res.status(gate.status).json({ ok: false, error: `unauthorized: ${gate.error}` });
            return;
        }
        const requesterEmail = gate.email;
        // อ่านอีเมลของคนที่เราจะส่งลิงก์ให้
        const targetEmail = String(req.body?.email || req.query?.email || "")
            .trim()
            .toLowerCase();
        if (!isEmail(targetEmail)) {
            res.status(400).json({ ok: false, error: "invalid_email" });
            return;
        }
        // เตรียมผู้ใช้ใน Auth (ไม่เจอ → สร้างเปล่า)
        const auth = admin.auth();
        let uid;
        try {
            const u = await auth.getUserByEmail(targetEmail);
            uid = u.uid;
        }
        catch {
            const u = await auth.createUser({
                email: targetEmail,
                emailVerified: false,
                disabled: false,
            });
            uid = u.uid;
        }
        // 1) สร้างลิงก์ (ยังไม่ส่ง)
        const link = await auth.generatePasswordResetLink(targetEmail); // 
        // 2) หย่อนจดหมายลง mail (รูปแบบที่ส่วนขยายต้องการ) 
        const db = admin.firestore();
        let mailDocId = null;
        try {
            const mailRef = await db.collection("mail").add({
                to: [targetEmail],
                message: {
                    subject: "ลิงก์ตั้งรหัสผ่านสำหรับ Work Permit App",
                    html: `
              <p>เรียนผู้ใช้งาน,</p>
              <p>คลิกปุ่มด้านล่างเพื่อสร้าง/รีเซ็ตรหัสผ่านของคุณ:</p>
              <p><a href="${link}" style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;border:1px solid #0b57d0">ตั้งรหัสผ่าน</a></p>
              <p>หากกดปุ่มไม่ได้ ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:</p>
              <p>${link}</p>
              <hr/>
              <small>อีเมลนี้ส่งจากระบบอัตโนมัติ โปรดอย่าตอบกลับ</small>
            `,
                },
                meta: {
                    createdBy: requesterEmail,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    reason: "admin_invite_link_created",
                },
            });
            mailDocId = mailRef.id;
            // log: mail_enqueued
            await db.collection("audit_logs").add({
                action: "mail_enqueued",
                by: requesterEmail,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                details: { target: targetEmail, mailDocId },
            });
        }
        catch (e) {
            // log: mail_enqueue_error
            await db.collection("audit_logs").add({
                action: "mail_enqueue_error",
                by: requesterEmail,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                details: { target: targetEmail, error: String(e && e.message ? e.message : e) },
            });
        }
        // 3) log: admin_invite_link_created
        await db.collection("audit_logs").add({
            action: "admin_invite_link_created",
            by: requesterEmail,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: { target: targetEmail, ip: ipOf(req), ua: uaOf(req), method: "POST", ok: true },
        });
        res.json({ ok: true, link, mailDocId });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
}));
