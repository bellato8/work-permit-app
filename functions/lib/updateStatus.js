"use strict";
// ======================================================================
// File: functions/src/updateStatus.ts
// เวอร์ชัน: 25/10/2025 (RBAC Fix - รองรับ pagePermissions)
// หน้าที่:
//   Endpoint อนุมัติ/ไม่อนุมัติ/ส่งกลับคำขอ (requests/{rid}) แบบ RBAC แท้จริง
//   - ยืนยันตัวตนจาก Authorization: Bearer <ID_TOKEN> → verifyIdToken() (Admin SDK)
//   - ✅ ตรวจสิทธิ์จาก Firestore admins collection (รองรับ pagePermissions)
//   - อัปเดตสถานะ + บันทึกผู้กระทำ + เขียน audit log
// ไฮไลต์:
//   • แก้ TS18048 โดยใช้ "discriminated union" ให้ TypeScript แคบชนิดได้หลังเช็ค gate.ok
//   • ใช้ CORS ของ v2: onRequest({ cors: [...] }) (ลดความซับซ้อน)
// อ้างอิงแนวทาง:
//   - Verify ID Token (Firebase Admin) :contentReference[oaicite:3]{index=3}
//   - Custom Claims / RBAC บน Firebase :contentReference[oaicite:4]{index=4}
//   - CORS options บน v2 onRequest :contentReference[oaicite:5]{index=5}
//   - TypeScript Narrowing / Discriminated Unions (แก้ 'possibly undefined') :contentReference[oaicite:6]{index=6}
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStatus = void 0;
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const emitAudit_1 = require("./lib/emitAudit");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// -------------------------- Config --------------------------
const ALLOW_ORIGINS = [
    "http://localhost:5173",
    "https://staging.imperialworld.asia",
    "https://imperialworld.asia",
];
// -------------------------- Utils --------------------------
function getClientIp(req) {
    const xf = String(req.headers?.["x-forwarded-for"] || "");
    return xf.split(",")[0].trim() || req.socket?.remoteAddress || "";
}
function getUA(req) {
    return String(req.headers?.["user-agent"] || "");
}
function mustReason(s) {
    const v = (s ?? "").trim();
    return v.length >= 2 ? v : "";
}
/** สังเคราะห์ caps จาก pagePermissions */
function synthesizeCaps(admin) {
    const caps = {};
    const role = String(admin?.role || "").toLowerCase();
    const pp = admin?.pagePermissions;
    if (role === "superadmin") {
        return {
            approve: true,
            decide: true,
            reject: true,
            manage_requests: true,
        };
    }
    // อ่านจาก caps เดิม
    const oldCaps = admin?.caps || {};
    Object.assign(caps, oldCaps);
    // Fallback จาก pagePermissions
    if (pp) {
        if (pp.approvals?.canApprove)
            caps.approve = true;
        if (pp.approvals?.canReject)
            caps.reject = true;
        if (pp.approvals?.canReject)
            caps.decide = true;
        if (pp.permits?.canEdit)
            caps.manage_requests = true;
    }
    return caps;
}
// --------------------- AuthN + AuthZ (สำคัญ) ---------------------
// AuthN = Authentication (ยืนยันตัวตน) / AuthZ = Authorization (สิทธิ์)
async function verifyAndAuthorize(req) {
    const authHeader = req.get("authorization") || req.get("Authorization") || "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return { ok: false, status: 401, error: "missing_bearer_token" };
    }
    try {
        const decoded = await (0, auth_1.getAuth)().verifyIdToken(m[1]);
        const email = (decoded.email || "").toLowerCase();
        // ✅ อ่านจาก Firestore แทน custom claims (เพื่อรองรับ pagePermissions)
        const adminDoc = await db.collection("admins").doc(email).get();
        const admin = adminDoc.exists ? adminDoc.data() : null;
        if (!admin || admin.enabled === false) {
            return { ok: false, status: 403, error: "insufficient_permissions" };
        }
        const role = String(admin.role || "").toLowerCase();
        const caps = synthesizeCaps(admin);
        const can = role === "superadmin" ||
            caps.approve === true ||
            caps.decide === true ||
            caps.manage_requests === true;
        if (!can) {
            return { ok: false, status: 403, error: "insufficient_permissions" };
        }
        const actor = {
            uid: decoded.uid,
            email: email || null,
            displayName: decoded.name ?? null,
        };
        return { ok: true, actor, role: role ?? null, caps };
    }
    catch (e) {
        // โทเค็นไม่ถูกต้อง/หมดอายุ → 401
        return { ok: false, status: 401, error: "invalid_token" };
    }
}
// -------------------------- Handler --------------------------
async function handler(req, res) {
    // รับเฉพาะ POST
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    // ยืนยันตัวตน + สิทธิ์ (หลังบรรทัดนี้ TypeScript แคบชนิดได้ว่า gate เป็น GateOk)
    const gate = await verifyAndAuthorize(req);
    if (!gate.ok) {
        res.status(gate.status).json({ ok: false, error: gate.error });
        return;
    }
    // รับพารามิเตอร์
    const { rid, status, reason } = (req.body || {});
    if (!rid || !status) {
        res.status(400).json({ ok: false, error: "bad_request", hint: "ต้องมี rid และ status" });
        return;
    }
    if ((status === "rejected" || status === "returned") && !mustReason(reason)) {
        res
            .status(400)
            .json({ ok: false, error: "need_reason", hint: "กรอกเหตุผลอย่างน้อย 2 ตัวอักษร" });
        return;
    }
    const docRef = db.collection("requests").doc(rid);
    const result = await db.runTransaction(async (trx) => {
        const snap = await trx.get(docRef);
        if (!snap.exists)
            return { notFound: true };
        const prev = snap.data() || {};
        const previousStatus = String(prev.status || prev?.decision?.status || "pending");
        // idempotent: ไม่เขียนซ้ำถ้าสถานะเดิม = ใหม่
        if (previousStatus === status) {
            return { previousStatus, idempotent: true };
        }
        const now = firestore_1.FieldValue.serverTimestamp();
        // actorObject: เก็บผู้กระทำแบบออบเจกต์
        const actorObject = {
            uid: gate.actor.uid,
            email: gate.actor.email,
            displayName: gate.actor.displayName,
            at: now,
            reason: status === "rejected" || status === "returned" ? reason || "" : undefined,
        };
        // patch หลัก + คงฟิลด์ legacy เพื่อความเข้ากันได้
        const patch = {
            status,
            updatedAt: now,
            decision: {
                status,
                byEmail: gate.actor.email ?? undefined,
                reason: status === "approved" ? "" : (reason || ""),
                at: now,
            },
        };
        if (status === "approved") {
            patch.approvedBy = actorObject;
            patch.approvedByEmail = gate.actor.email ?? null; // legacy
            patch.rejectedBy = firestore_1.FieldValue.delete();
            patch.rejectedByEmail = firestore_1.FieldValue.delete();
            patch.rejectionReason = firestore_1.FieldValue.delete();
        }
        else {
            patch.rejectedBy = actorObject;
            patch.rejectedByEmail = gate.actor.email ?? null; // legacy
            patch.rejectionReason = reason || "";
            patch.approvedBy = firestore_1.FieldValue.delete();
            patch.approvedByEmail = firestore_1.FieldValue.delete();
        }
        trx.set(docRef, patch, { merge: true });
        return { previousStatus };
    });
    if ("notFound" in result) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
    }
    // เขียน audit log (อย่าให้พังงานหลัก ถ้าพังแค่เตือน)
    try {
        const action = status === "approved"
            ? "status_update_approved"
            : status === "rejected"
                ? "status_update_rejected"
                : "status_update_returned";
        // จัดรูปแบบให้เป็น { email?: string; role?: string } เพื่อหลีกเลี่ยง TS2322 (null → undefined)
        const actorForAudit = {};
        if (gate.actor.email)
            actorForAudit.email = gate.actor.email;
        if (gate.role)
            actorForAudit.role = gate.role;
        await (0, emitAudit_1.emitAudit)(action, actorForAudit, { rid }, reason || "", { ip: getClientIp(req), ua: getUA(req), previousStatus: result.previousStatus });
    }
    catch (e) {
        console.warn("[emitAudit] failed:", e);
    }
    res.status(200).json({
        ok: true,
        data: {
            rid,
            status,
            by: {
                uid: gate.actor.uid,
                email: gate.actor.email,
                displayName: gate.actor.displayName,
            },
            previousStatus: result.previousStatus,
            idempotent: "idempotent" in result ? true : undefined,
        },
    });
}
// -------------------------- Export --------------------------
exports.updateStatus = (0, https_1.onRequest)({
    region: "asia-southeast1",
    // ใช้ CORS ของ Functions v2: ใส่ origin ที่อนุญาตเท่านั้น (dev + staging + prod)
    cors: ALLOW_ORIGINS,
}, async (req, res) => {
    try {
        await handler(req, res);
    }
    catch (e) {
        console.error("updateStatus error:", e);
        res.status(500).json({ ok: false, error: "internal_error" });
    }
});
