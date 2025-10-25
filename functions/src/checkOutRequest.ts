// ======================================================================
// File: functions/src/checkOutRequest.ts
// เวอร์ชัน: 2025-10-13 (Task 15) - แก้ไข Bug เช็คสถานะ
// หน้าที่: Cloud Function สำหรับบันทึกการเช็คเอาท์ + อัปเดตสถานะงาน
// แก้ไข: รองรับ status ทั้งภาษาไทย "อนุมัติ" และอังกฤษ "approved"
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-southeast1";

/**
 * ข้อมูล Admin จาก Firestore
 */
interface AdminData {
  name?: string;
  email?: string;
  role?: string;
  permissions?: {
    checkInOut?: boolean;
    approval?: boolean;
    viewAll?: boolean;
  };
  pagePermissions?: {
    dailyWork?: {
      canView?: boolean;
      canViewOtherDays?: boolean;
      canCheckInOut?: boolean;
    };
    [key: string]: any;
  };
  createdAt?: any;
  updatedAt?: any;
}

// ==================== CORS ====================
function setCORS(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ==================== Permission Check ====================
async function checkPermissions(req: any): Promise<{
  ok: boolean;
  error?: string;
  uid?: string;
  email?: string;
  name?: string;
}> {
  const authHeader = req.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  
  if (!match) {
    return { ok: false, error: "missing_token" };
  }

  try {
    const token = match[1];
    const decoded = await getAuth().verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    
    if (!email) {
      return { ok: false, error: "invalid_email" };
    }

    // เช็คว่ามีสิทธิ์ checkInOut
    const adminDoc = await db.collection("admins").doc(email).get();
    
    if (!adminDoc.exists) {
      return { ok: false, error: "not_admin" };
    }

    const adminData = adminDoc.data() as AdminData | undefined;
    // หมายเหตุ: ทุกคนที่เข้าหน้า Daily Operations สามารถเช็คเอาท์ได้ (รวม Viewer)
    const hasPermission = 
      adminData?.role === "superadmin" ||
      adminData?.role === "admin" ||
      adminData?.role === "approver" ||
      adminData?.role === "viewer" ||
      adminData?.pagePermissions?.dailyWork?.canCheckInOut === true ||
      adminData?.permissions?.checkInOut === true; // fallback
    
    if (!hasPermission) {
      return { ok: false, error: "insufficient_permissions" };
    }

    return { 
      ok: true, 
      uid: decoded.uid, 
      email,
      name: decoded.name || adminData?.name || email
    };
  } catch (e: any) {
    return { ok: false, error: "invalid_token" };
  }
}

// ==================== Main Function ====================
export const checkOutRequest = onRequest(
  { region: REGION },
  async (req, res) => {
    setCORS(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    try {
      // ตรวจสอบสิทธิ์
      const auth = await checkPermissions(req);
      if (!auth.ok) {
        res.status(403).json({ ok: false, error: auth.error });
        return;
      }

      // รับพารามิเตอร์
      const { requestId, notes } = req.body;

      if (!requestId || typeof requestId !== "string") {
        res.status(400).json({ 
          ok: false, 
          error: "invalid_request_id",
          message: "กรุณาระบุ Request ID" 
        });
        return;
      }

      // เช็คว่างานนี้มีจริงหรือไม่
      const requestRef = db.collection("requests").doc(requestId);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        res.status(404).json({ 
          ok: false, 
          error: "request_not_found",
          message: "ไม่พบงานนี้" 
        });
        return;
      }

      const requestData = requestDoc.data()!;

      // ✅ แก้ไข: เช็คว่าได้รับอนุมัติแล้วหรือยัง (รองรับทั้งภาษาไทยและอังกฤษ)
      if (requestData.status !== "อนุมัติ" && requestData.status !== "approved") {
        res.status(400).json({ 
          ok: false, 
          error: "not_approved",
          message: "งานนี้ยังไม่ได้รับอนุมัติ" 
        });
        return;
      }

      // ⚠️ เช็คว่าเช็คอินแล้วหรือยัง (ต้องเช็คอินก่อนถึงจะเช็คเอาท์ได้)
      if (requestData.dailyStatus !== "checked-in") {
        res.status(400).json({ 
          ok: false, 
          error: "not_checked_in",
          message: "งานนี้ยังไม่ได้เช็คอิน ต้องเช็คอินก่อน" 
        });
        return;
      }

      // เช็คว่าเช็คเอาท์ไปแล้วหรือยัง
      if (requestData.dailyStatus === "checked-out") {
        res.status(400).json({ 
          ok: false, 
          error: "already_checked_out",
          message: "งานนี้เช็คเอาท์ไปแล้ว" 
        });
        return;
      }

      // หา checkIn document ล่าสุด
      const checkInQuery = await db
        .collection("checkIns")
        .where("requestId", "==", requestId)
        .orderBy("checkedInAt", "desc")
        .limit(1)
        .get();

      const checkInId = !checkInQuery.empty ? checkInQuery.docs[0].id : null;

      // สร้าง checkOut document
      const checkOutRef = db.collection("checkOuts").doc();
      const now = FieldValue.serverTimestamp();

      await checkOutRef.set({
        requestId,
        checkInId,
        checkedOutAt: now,
        checkedOutBy: {
          uid: auth.uid!,
          email: auth.email!,
          name: auth.name!
        },
        notes: notes || "",
        status: "checked-out",
        createdAt: now,
        updatedAt: now
      });

      // อัปเดต request document
      await requestRef.update({
        dailyStatus: "checked-out",
        lastCheckOut: now,
        updatedAt: now
      });

      // บันทึก audit log
      await db.collection("auditLogs").add({
        action: "check-out",
        requestId,
        performedBy: {
          uid: auth.uid!,
          email: auth.email!,
          name: auth.name!
        },
        timestamp: now,
        notes: notes || "",
        metadata: {
          previousStatus: "checked-in",
          newStatus: "checked-out",
          checkInId
        }
      });

      res.json({
        ok: true,
        checkOutId: checkOutRef.id,
        requestId,
        checkInId,
        timestamp: new Date().toISOString()
      });

    } catch (e: any) {
      console.error("[checkOutRequest] Error:", e);
      res.status(500).json({ 
        ok: false, 
        error: "internal_error",
        message: e?.message || "เกิดข้อผิดพลาด" 
      });
    }
  }
);