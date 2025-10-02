// ======================================================================
// File: functions/src/getRequestAdmin.ts
// เวอร์ชัน: 2025-10-02
// หน้าที่: ดึงรายละเอียดคำขอ (RID) สำหรับหน้า Admin/PermitDetails
// ปรับรอบนี้:
//   • อนุญาต "ดูรายละเอียด" ถ้ามีอย่างน้อยหนึ่งในสิทธิ์: viewAll | view_all | approve | viewPermits
//     หรือเป็น superadmin (viewer ที่ถูกติ๊กสิทธิ์ก็เปิดดูได้)
//   • ออก Signed URL (v4) ให้รูปหลัก/รูปทีมงานแบบชั่วคราว (หมดอายุอัตโนมัติ) เพื่อให้รูปขึ้นแน่นอน
//   • ตอบ 403 ด้วย code: "need_view_permits" เมื่อยืนยันตัวตนได้ แต่ยังไม่มีสิทธิ์ดูรายละเอียด
//   • รองรับ API key แบบเก่าเป็น compat ชั่วคราว
//   • ปรับ “เริ่มใช้งานบริการ” เป็นแบบค่อยเรียกเมื่อจำเป็น (lazy) ลดอาการเริ่มช้า
// หมายเหตุอ้างอิง:
//   - Signed URL v4 (Google Cloud Storage)  : https://cloud.google.com/storage/docs/samples/storage-generate-signed-url-v4
//   - Admin Storage: default bucket          : https://firebase.google.com/docs/storage/admin/start
//   - Verify ID Token (Admin SDK)            : https://firebase.google.com/docs/auth/admin/verify-id-tokens
//   - HTTP onRequest (Functions v2)          : https://firebase.google.com/docs/functions/http-events
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { emitAudit } from "./lib/emitAudit";

// ----- lazy helpers -----
function ensureApp() {
  if (!getApps().length) {
    initializeApp(); // ใช้ค่าคอนฟิกจากสภาพแวดล้อมของ Firebase
  }
}
function db() {
  ensureApp();
  return getFirestore();
}
function bucket() {
  ensureApp();
  return getStorage().bucket(); // default bucket ของโปรเจกต์
}

const APPROVER_KEY = defineSecret("APPROVER_KEY");

function setCorsHeaders(req: any, res: any) {
  const allowedOrigins = [
    "https://imperialworld.asia",
    "https://staging.imperialworld.asia",
    "http://localhost:5173",
    "https://work-permit-app-1e9f0.web.app",
    "https://work-permit-app-1e9f0.firebaseapp.com",
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, x-requester-email"
  );
  res.setHeader("Access-Control-Max-Age", "3600");
}

const str = (v: any) => (v == null ? "" : String(v));

function getClientIp(req: any): { ip?: string; ipRaw?: string } {
  const xff = str(req.headers["x-forwarded-for"]);
  const first = xff ? xff.split(",")[0].trim() : "";
  const ipRaw =
    xff ||
    str(req.headers["x-real-ip"]) ||
    str(req.ip) ||
    str(req.connection?.remoteAddress) ||
    str(req.socket?.remoteAddress);
  return { ip: first || undefined, ipRaw: ipRaw || undefined };
}

// ---------------- สิทธิ์/ตัวตน ----------------
type AuthzResult = {
  authorized: boolean;
  adminEmail?: string;
  adminRole?: string;
  canView?: boolean;
  caps?: Record<string, any> | null;
};

function toEmailId(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

async function loadAdminCapsByEmail(email: string) {
  const d = await db().collection("admins").doc(toEmailId(email)).get();
  if (d.exists) return d.data() || null;

  // เผื่อกรณีข้อมูลเก่าเก็บแบบ query field 'email'
  const q = await db().collection("admins").where("email", "==", email).limit(1).get();
  if (!q.empty) return q.docs[0].data() || null;

  return null;
}

async function checkAuthorization(req: any): Promise<AuthzResult> {
  // 1) เส้นทางหลัก: Bearer token
  const authHeader = str(req.headers.authorization);
  if (authHeader.startsWith("Bearer ")) {
    try {
      ensureApp();
      const idToken = authHeader.slice("Bearer ".length);
      const decoded = await getAuth().verifyIdToken(idToken);
      const email = decoded.email;
      if (email) {
        const admin = (await loadAdminCapsByEmail(email)) || {};
        const enabled = admin.enabled === true;
        const role = String(admin.role || "");
        const caps = admin.caps || {};

        // กติกา "ดูรายละเอียดได้"
        const canView =
          role === "superadmin" ||
          caps.viewAll === true ||
          caps.view_all === true ||
          caps.approve === true ||
          caps.viewPermits === true;

        if (enabled) {
          return {
            authorized: true,
            adminEmail: email,
            adminRole: role,
            canView,
            caps,
          };
        }
      }
    } catch (e) {
      console.error("Token verification failed:", e);
    }
  }

  // 2) ทางสำรองชั่วคราว: API key (compat)
  const apiKey =
    str(req.headers["x-api-key"]) ||
    str(req.body?.apiKey) ||
    str(req.query?.apiKey) ||
    str(req.query?.key) ||
    str(req.body?.key);
  const keyOk = apiKey && apiKey === APPROVER_KEY.value();
  if (keyOk) {
    const requesterEmail =
      str(req.headers["x-requester-email"]) ||
      str(req.query?.requester) ||
      str(req.body?.requester);
    return {
      authorized: true,
      adminEmail: requesterEmail || undefined,
      adminRole: "admin",
      canView: true,
      caps: null,
    };
  }

  return { authorized: false };
}

// -------------- ออก Signed URL แบบปลอดภัย --------------
const SIGN_URL_TTL_MS = 60 * 60 * 1000; // 1 ชั่วโมง

async function signedUrlIfExists(path?: string): Promise<string | undefined> {
  if (!path) return undefined;
  try {
    const file = bucket().file(path);
    const [exists] = await file.exists();
    if (!exists) return undefined;
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + SIGN_URL_TTL_MS,
      version: "v4",
    });
    return url;
  } catch (e) {
    console.error("signedUrlIfExists error:", path, e);
    return undefined;
  }
}

// ----------------- ฟังก์ชันหลัก -----------------
export const getRequestAdmin = onRequest(
  {
    region: "asia-southeast1",
    secrets: [APPROVER_KEY],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      // 1) ยืนยันตัวตน + สิทธิ์
      const { authorized, adminEmail, adminRole, canView } = await checkAuthorization(req);
      if (!authorized) {
        res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Valid Bearer token or API key required",
        });
        return;
      }
      if (canView === false) {
        res.status(403).json({
          success: false,
          code: "need_view_permits",
          message:
            "บัญชีนี้ยังไม่มีสิทธิ์ดูรายละเอียดใบงาน (ต้องมีอย่างน้อยหนึ่ง: viewAll/view_all/approve/viewPermits)",
        });
        return;
      }

      // 2) รับ RID
      const requestId =
        str(req.params?.[0]) ||
        str(req.body?.requestId) ||
        str(req.query?.requestId) ||
        str(req.query?.rid);
      if (!requestId) {
        res.status(400).json({
          success: false,
          error: "missing_request_id",
          message: "Please provide requestId in URL, query params, or request body",
        });
        return;
      }

      // 3) อ่านเอกสารคำขอ
      const docSnap = await db().collection("requests").doc(requestId).get();
      if (!docSnap.exists) {
        res.status(404).json({
          success: false,
          error: "not_found",
          message: `No request found with ID: ${requestId}`,
        });
        return;
      }
      const data = docSnap.data() || {};
      const rid = docSnap.id;

      // 4) ออกลิงก์รูป (แนบทั้ง path และ url กลับไป)
      const images = data.images || {};
      const idCardCleanPath = images.idCardCleanPath || `requests/${rid}/idcard_clean.jpg`;
      const idCardStampedPath = images.idCardStampedPath || `requests/${rid}/idcard_stamped.jpg`;
      const idCardCleanUrl = await signedUrlIfExists(idCardCleanPath);
      const idCardStampedUrl = await signedUrlIfExists(idCardStampedPath);

      let workersOut: any[] | undefined = undefined;
      const workersIn = Array.isArray(images.workers) ? images.workers : null;
      if (workersIn && workersIn.length) {
        workersOut = [];
        for (const w of workersIn) {
          const cleanPath = w?.cleanPath || w?.pathClean || undefined;
          const stampedPath = w?.stampedPath || w?.pathStamped || undefined;
          const cleanUrl = await signedUrlIfExists(cleanPath);
          const stampedUrl = await signedUrlIfExists(stampedPath);
          workersOut.push({ ...w, cleanPath, stampedPath, cleanUrl, stampedUrl });
        }
      }

      const imagesOut = {
        ...images,
        idCardCleanPath,
        idCardStampedPath,
        ...(idCardCleanUrl ? { idCardCleanUrl } : {}),
        ...(idCardStampedUrl ? { idCardStampedUrl } : {}),
        ...(workersOut ? { workers: workersOut } : {}),
      };

      // 5) enrich metadata + คำนวณช่วยอ่าน
      const enrichedData = {
        ...data,
        id: rid,
        images: imagesOut,
        _metadata: {
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
          lastModified: new Date().toISOString(),
          accessedBy: adminEmail || "API_KEY",
          documentPath: `requests/${rid}`,
        },
        _computed: {
          statusText: getStatusText(data.status),
          daysFromSubmission: data.createdAt
            ? Math.floor(
                (Date.now() -
                  (data.createdAt?.toDate
                    ? data.createdAt.toDate().getTime()
                    : new Date(data.createdAt).getTime())) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
          hasAttachments: Boolean(data.attachments?.length),
        },
      };

      // 6) log การเข้าถึง
      const { ip, ipRaw } = getClientIp(req);
      const ua = str(req.headers["user-agent"]);
      await emitAudit(
        "get_request_admin",
        adminEmail ? { email: adminEmail, role: adminRole || "admin" } : "unknown",
        { type: "request", id: rid },
        "view request in admin",
        { ip, ipRaw, ua, method: req.method, route: "getRequestAdmin" }
      );
      await db().collection("audit_logs").add({
        action: "get_request_admin",
        requestId: rid,
        adminEmail: adminEmail || "unknown",
        timestamp: FieldValue.serverTimestamp(),
        userAgent: ua,
        ip: ip || ipRaw,
        method: req.method,
      });

      // 7) ส่งกลับ
      res.status(200).json({ success: true, data: enrichedData, requestId: rid });
    } catch (error) {
      console.error("getRequestAdmin error:", error);
      res.status(500).json({
        success: false,
        error: "internal_error",
        message: "Failed to retrieve request data",
      });
    }
  }
);

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: "รอดำเนินการ",
    reviewing: "กำลังพิจารณา",
    approved: "อนุมัติ",
    rejected: "ไม่อนุมัติ",
    expired: "หมดอายุ",
    cancelled: "ยกเลิก",
  };
  return map[status] || status;
}
