"use strict";
// ============================================================
// ไฟล์: functions/src/listRequests.ts (Firebase Functions v2)
// ผู้เขียน: AI Helper - Fixed Secret Conflict
// เวลา: 2025-09-08 20:05 (Asia/Bangkok)
// การแก้ไข: ใช้ defineSecret แทน process.env เพื่อแก้ deploy error
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRequests = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
// เริ่มต้น Firebase Admin
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// ✅ ใช้ defineSecret
const APPROVER_KEY = (0, params_1.defineSecret)("APPROVER_KEY");
// ตัวช่วย CORS
function setCorsHeaders(req, res) {
    const allowedOrigins = [
        "https://imperialworld.asia",
        "https://staging.imperialworld.asia",
        "http://localhost:5173",
        "https://work-permit-app-1e9f0.web.app",
        "https://work-permit-app-1e9f0.firebaseapp.com"
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
// ✅ ฟังก์ชันหลัก
exports.listRequests = (0, https_1.onRequest)({
    region: "asia-southeast1",
    secrets: [APPROVER_KEY],
    timeoutSeconds: 60,
    memory: "256MiB"
}, async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    let isAuthorized = false;
    // 1. ตรวจสอบ Bearer Token
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split("Bearer ")[1];
        try {
            const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(idToken);
            const email = decodedToken.email;
            if (email) {
                const adminSnap = await db.collection("admins").where("email", "==", email).limit(1).get();
                if (!adminSnap.empty) {
                    const adminData = adminSnap.docs[0].data();
                    if (adminData.enabled && ["admin", "approver", "superadmin"].includes(adminData.role)) {
                        isAuthorized = true;
                    }
                }
            }
        }
        catch (error) {
            console.error("Token verification failed:", error);
        }
    }
    // 2. ตรวจสอบ API Key (fallback)
    if (!isAuthorized) {
        const keyFromQuery = req.query.key;
        const keyFromHeader = req.headers["x-api-key"];
        const keyFromBody = req.body?.key;
        const providedKey = keyFromHeader || keyFromQuery || keyFromBody;
        // ✅ ใช้ APPROVER_KEY.value() แทน process.env.APPROVER_KEY
        if (providedKey && providedKey === APPROVER_KEY.value()) {
            isAuthorized = true;
        }
    }
    if (!isAuthorized) {
        res.status(403).json({ ok: false, error: "Forbidden" });
        return;
    }
    // ดึงข้อมูลจาก Firestore
    try {
        const limit = parseInt(req.query.limit) || 100;
        // ✅ ดึงข้อมูลครบถ้วนจาก Firestore
        const snapshot = await db
            .collection("requests")
            .orderBy("createdAt", "desc")
            .limit(Math.min(limit, 1000))
            .get();
        const items = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                rid: doc.id,
                id: doc.id,
                // ✅ เพิ่ม mapping ให้ครบถ้วน
                status: data.status || "pending",
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                approvedAt: data.decision?.at || data.approvedAt,
                rejectedAt: data.decision?.at || data.rejectedAt,
                // ✅ ดึงข้อมูล requester ออกมาเป็น flat structure
                contractorName: data.requester?.fullname || data.requester?.name || "",
                requesterName: data.requester?.fullname || data.requester?.name || "",
                contractorCompany: data.requester?.company || "",
                // ✅ ดึงข้อมูล work ออกมาเป็น flat structure  
                workType: data.work?.type || "",
                jobType: data.work?.category || data.work?.type || "",
                permitType: data.work?.type || "",
                // เก็บ nested structure ไว้ด้วย (เผื่อ frontend บางส่วนใช้)
                requester: data.requester,
                work: data.work,
                // ข้อมูลอื่น ๆ
                ...data
            };
        });
        res.status(200).json({
            ok: true,
            data: {
                items,
                count: items.length
            }
        });
    }
    catch (error) {
        console.error("Error fetching requests:", error);
        res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
});
