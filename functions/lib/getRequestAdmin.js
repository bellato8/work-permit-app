"use strict";
// functions/src/getRequestAdmin.ts
// ============================================================
// ผู้เขียน: AI Helper (ปรับปรุงร่วมกับเพื่อนจับมือทำ)
// หน้าที่: ดึงข้อมูลคำขอเฉพาะ ID สำหรับหน้า Admin/PermitDetails
// ปรับรอบนี้:
//   • แก้ "ผู้ทำ = unknown" (กรณีใช้ API KEY) ให้ดึงจาก x-requester-email/query/body
//   • บันทึก log แบบกลางผ่าน emitAudit → คอลเลกชัน "auditLogs" (field "at" เป็น serverTimestamp)
//   • คงเขียนซ้ำลง "audit_logs" (เดิม) แต่ใช้ serverTimestamp เช่นกัน
//   • เก็บ IP แบบเลือกตัวแรกจาก X-Forwarded-For + เก็บค่า RAW เผื่อเทียบ
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestAdmin = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const emitAudit_1 = require("./lib/emitAudit");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const APPROVER_KEY = (0, params_1.defineSecret)("APPROVER_KEY");
function setCorsHeaders(req, res) {
    const allowedOrigins = [
        "https://imperialworld.asia",
        "https://staging.imperialworld.asia",
        "http://localhost:5173",
        "https://work-permit-app-1e9f0.web.app",
        "https://work-permit-app-1e9f0.firebaseapp.com",
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, x-requester-email");
    res.setHeader("Access-Control-Max-Age", "3600");
}
const str = (v) => (v == null ? "" : String(v));
function getClientIp(req) {
    const xff = str(req.headers["x-forwarded-for"]);
    const first = xff ? xff.split(",")[0].trim() : "";
    const ipRaw = xff ||
        str(req.headers["x-real-ip"]) ||
        str(req.ip) ||
        str(req.connection?.remoteAddress) ||
        str(req.socket?.remoteAddress);
    return { ip: first || undefined, ipRaw: ipRaw || undefined };
}
async function checkAuthorization(req) {
    const authHeader = str(req.headers.authorization);
    if (authHeader.startsWith("Bearer ")) {
        try {
            const idToken = authHeader.slice("Bearer ".length);
            const decoded = await (0, auth_1.getAuth)().verifyIdToken(idToken);
            const email = decoded.email;
            if (email) {
                const snap = await db
                    .collection("admins")
                    .where("email", "==", email)
                    .limit(1)
                    .get();
                if (!snap.empty) {
                    const admin = snap.docs[0].data();
                    if (admin.enabled && ["admin", "approver", "superadmin"].includes(admin.role)) {
                        return { authorized: true, adminEmail: email, adminRole: admin.role };
                    }
                }
            }
        }
        catch (e) {
            console.error("Token verification failed:", e);
        }
    }
    const apiKey = str(req.headers["x-api-key"]) ||
        str(req.body?.apiKey) ||
        str(req.query?.apiKey) ||
        str(req.query?.key) ||
        str(req.body?.key);
    const keyOk = apiKey && apiKey === APPROVER_KEY.value();
    if (keyOk) {
        const requesterEmail = str(req.headers["x-requester-email"]) ||
            str(req.query?.requester) ||
            str(req.body?.requester);
        if (requesterEmail) {
            return { authorized: true, adminEmail: requesterEmail, adminRole: "admin" };
        }
        return { authorized: true };
    }
    return { authorized: false };
}
exports.getRequestAdmin = (0, https_1.onRequest)({
    region: "asia-southeast1",
    secrets: [APPROVER_KEY],
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    try {
        const { authorized, adminEmail, adminRole } = await checkAuthorization(req);
        if (!authorized) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Valid Bearer token or API key required",
            });
            return;
        }
        const requestId = str(req.params?.[0]) ||
            str(req.body?.requestId) ||
            str(req.query?.requestId) ||
            str(req.query?.rid);
        if (!requestId) {
            res.status(400).json({
                error: "Missing Request ID",
                message: "Please provide requestId in URL, query params, or request body",
            });
            return;
        }
        const requestDoc = await db.collection("requests").doc(requestId).get();
        if (!requestDoc.exists) {
            res.status(404).json({ error: "Request not found", message: `No request found with ID: ${requestId}` });
            return;
        }
        const requestData = requestDoc.data() || {};
        const enrichedData = {
            ...requestData,
            id: requestDoc.id,
            _metadata: {
                createdAt: requestData.createdAt?.toDate?.()?.toISOString() || requestData.createdAt,
                updatedAt: requestData.updatedAt?.toDate?.()?.toISOString() || requestData.updatedAt,
                lastModified: new Date().toISOString(),
                accessedBy: adminEmail || "API_KEY",
                documentPath: `requests/${requestDoc.id}`,
            },
            _computed: {
                statusText: getStatusText(requestData.status),
                daysFromSubmission: requestData.createdAt
                    ? Math.floor((Date.now() -
                        (requestData.createdAt?.toDate
                            ? requestData.createdAt.toDate().getTime()
                            : new Date(requestData.createdAt).getTime())) /
                        (1000 * 60 * 60 * 24))
                    : null,
                hasAttachments: Boolean(requestData.attachments?.length),
            },
        };
        const { ip, ipRaw } = getClientIp(req);
        const ua = str(req.headers["user-agent"]);
        await (0, emitAudit_1.emitAudit)("get_request_admin", adminEmail ? { email: adminEmail, role: adminRole || "admin" } : "unknown", { type: "request", id: requestId }, "view request in admin", {
            ip,
            ipRaw,
            ua,
            method: req.method,
            route: "getRequestAdmin",
        });
        await db.collection("audit_logs").add({
            action: "get_request_admin",
            requestId,
            adminEmail: adminEmail || "unknown",
            timestamp: firestore_1.FieldValue.serverTimestamp(),
            userAgent: ua,
            ip: ip || ipRaw,
            method: req.method,
        });
        res.status(200).json({ success: true, data: enrichedData, requestId });
    }
    catch (error) {
        console.error("getRequestAdmin error:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to retrieve request data",
            details: process.env.NODE_ENV === "development"
                ? error instanceof Error
                    ? error.message
                    : String(error)
                : undefined,
        });
    }
});
function getStatusText(status) {
    const map = {
        pending: "รอดำเนินการ",
        reviewing: "กำลังพิจารณา",
        approved: "อนุมัติ",
        rejected: "ไม่อนุมัติ",
        expired: "หมดอายุ",
        cancelled: "ยกเลิก",
    };
    return map[status] || status;
}
