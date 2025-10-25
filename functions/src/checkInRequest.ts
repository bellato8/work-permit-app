// ======================================================================
// File: functions/src/checkInRequest.ts
// เวอร์ชัน: 2025-10-12 (Task 14 - แก้ไขรองรับทั้ง 2 ภาษา)
// หน้าที่: Cloud Function สำหรับบันทึกการเช็คอิน พร้อมอัปเดตสถานะงาน
// การเปลี่ยนแปลง: รองรับ status ทั้ง "อนุมัติ" และ "approved"
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-southeast1";

// ======================================================================
// TYPE DEFINITIONS (กำหนดรูปแบบข้อมูล)
// ======================================================================

/**
 * ข้อมูลผู้ใช้ที่ดึงมาจาก Firebase Auth Token
 */
interface DecodedToken {
  uid: string;
  email?: string;
  name?: string;
}

/**
 * ข้อมูล Admin จาก Firestore
 */
interface AdminData {
  name: string;
  email: string;
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

/**
 * ผลลัพธ์จากการตรวจสอบสิทธิ์
 */
interface AuthResult {
  ok: boolean;
  error?: string;
  uid?: string;
  email?: string;
  name?: string;
}

/**
 * ข้อมูล Request จาก Firestore
 */
interface RequestData {
  status: string;
  dailyStatus?: string;
  requestId: string;
  company: string;
  workDate: string;
  [key: string]: any;
}

/**
 * ข้อมูลที่รับมาจาก Request Body
 */
interface CheckInRequestBody {
  requestId: string;
  notes?: string;
}

/**
 * Response สำเร็จ
 */
interface SuccessResponse {
  ok: true;
  checkInId: string;
  requestId: string;
  timestamp: string;
}

/**
 * Response ผิดพลาด
 */
interface ErrorResponse {
  ok: false;
  error: string;
  message?: string;
}

// ======================================================================
// HELPER FUNCTIONS (ฟังก์ชันช่วย)
// ======================================================================

/**
 * ตั้งค่า CORS Headers
 * ทำให้เว็บสามารถเรียกใช้ Function นี้ได้
 */
function setCORS(res: Response): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/**
 * ส่ง Error Response กลับไป
 * ใช้แทนการเขียน res.status().json() ซ้ำๆ
 */
function sendError(
  res: Response,
  statusCode: number,
  error: string,
  message?: string
): void {
  const response: ErrorResponse = {
    ok: false,
    error,
    ...(message && { message })
  };
  res.status(statusCode).json(response);
}

/**
 * ส่ง Success Response กลับไป
 * ใช้แทนการเขียน res.json() ซ้ำๆ
 */
function sendSuccess(
  res: Response,
  checkInId: string,
  requestId: string
): void {
  const response: SuccessResponse = {
    ok: true,
    checkInId,
    requestId,
    timestamp: new Date().toISOString()
  };
  res.status(200).json(response);
}

// ======================================================================
// AUTHENTICATION (ตรวจสอบสิทธิ์)
// ======================================================================

/**
 * ตรวจสอบสิทธิ์ของผู้ใช้
 * 1. ตรวจสอบ Token
 * 2. ตรวจสอบว่าเป็น Admin
 * 3. ตรวจสอบว่ามีสิทธิ์ checkInOut
 */
async function checkPermissions(req: Request): Promise<AuthResult> {
  // ดึง Authorization Header
  const authHeader = req.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  
  if (!match) {
    return { ok: false, error: "missing_token" };
  }

  try {
    // ตรวจสอบ Token กับ Firebase
    const token = match[1];
    const decoded = await getAuth().verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    
    // ต้องมี email
    if (!email) {
      return { ok: false, error: "invalid_email" };
    }

    // ดึงข้อมูล Admin จาก Firestore
    const adminDoc = await db.collection("admins").doc(email).get();
    
    // ตรวจสอบว่ามีข้อมูล Admin
    if (!adminDoc.exists) {
      return { ok: false, error: "not_admin" };
    }

    // ดึงข้อมูลและตรวจสอบให้แน่ใจว่ามีข้อมูล
    const adminData = adminDoc.data() as AdminData | undefined;
    
    if (!adminData) {
      return { ok: false, error: "admin_data_not_found" };
    }

    // ตรวจสอบสิทธิ์ checkInOut
    // หมายเหตุ: ทุกคนที่เข้าหน้า Daily Operations สามารถเช็คอินได้ (รวม Viewer)
    const hasPermission = 
      adminData.role === "superadmin" ||
      adminData.role === "admin" ||
      adminData.role === "approver" ||
      adminData.role === "viewer" ||
      adminData.pagePermissions?.dailyWork?.canCheckInOut === true ||
      adminData.permissions?.checkInOut === true; // fallback
    
    if (!hasPermission) {
      return { ok: false, error: "insufficient_permissions" };
    }

    // ส่งข้อมูลผู้ใช้กลับไป
    return { 
      ok: true, 
      uid: decoded.uid, 
      email,
      name: decoded.name || adminData.name || email
    };
    
  } catch (e: any) {
    console.error("[checkPermissions] Error:", e);
    return { ok: false, error: "invalid_token" };
  }
}

// ======================================================================
// VALIDATION (ตรวจสอบความถูกต้องของข้อมูล)
// ======================================================================

/**
 * ตรวจสอบข้อมูลที่ส่งมา
 */
function validateRequestBody(body: any): {
  valid: boolean;
  error?: string;
  data?: CheckInRequestBody;
} {
  if (!body) {
    return { valid: false, error: "empty_body" };
  }

  const { requestId, notes } = body;

  // ตรวจสอบ requestId
  if (!requestId || typeof requestId !== "string" || requestId.trim() === "") {
    return { 
      valid: false, 
      error: "invalid_request_id"
    };
  }

  // notes เป็น optional แต่ถ้ามีต้องเป็น string
  if (notes !== undefined && typeof notes !== "string") {
    return {
      valid: false,
      error: "invalid_notes_type"
    };
  }

  return {
    valid: true,
    data: {
      requestId: requestId.trim(),
      notes: notes?.trim() || ""
    }
  };
}

/**
 * ตรวจสอบสถานะของ Request
 * 🆕 รองรับทั้งภาษาไทย ("อนุมัติ") และภาษาอังกฤษ ("approved")
 */
function validateRequestStatus(requestData: RequestData): {
  valid: boolean;
  error?: string;
  message?: string;
} {
  // 🆕 กำหนดรายการคำที่ถือว่า "อนุมัติแล้ว" (รองรับทั้ง 2 ภาษา)
  const approvedStatuses = ["อนุมัติ", "approved"];
  
  // 🆕 เช็คว่า status ตรงกับคำไหนในรายการหรือไม่
  if (!approvedStatuses.includes(requestData.status)) {
    return {
      valid: false,
      error: "not_approved",
      message: "งานนี้ยังไม่ได้รับอนุมัติ"
    };
  }

  // ตรวจสอบว่าเช็คอินไปแล้วหรือยัง
  if (requestData.dailyStatus === "checked-in") {
    return {
      valid: false,
      error: "already_checked_in",
      message: "งานนี้เช็คอินไปแล้ว"
    };
  }

  // ตรวจสอบว่าเช็คเอาท์ไปแล้วหรือยัง
  if (requestData.dailyStatus === "checked-out") {
    return {
      valid: false,
      error: "already_checked_out",
      message: "งานนี้เช็คเอาท์ไปแล้ว"
    };
  }

  return { valid: true };
}

// ======================================================================
// DATABASE OPERATIONS (การจัดการฐานข้อมูล)
// ======================================================================

/**
 * บันทึกข้อมูลการเช็คอิน
 */
async function saveCheckIn(
  requestId: string,
  notes: string,
  auth: AuthResult
): Promise<string> {
  const checkInRef = db.collection("checkIns").doc();
  const now = FieldValue.serverTimestamp();

  await checkInRef.set({
    requestId,
    checkedInAt: now,
    checkedInBy: {
      uid: auth.uid!,
      email: auth.email!,
      name: auth.name!
    },
    notes: notes || "",
    status: "checked-in",
    createdAt: now,
    updatedAt: now
  });

  return checkInRef.id;
}

/**
 * อัปเดตสถานะของ Request
 */
async function updateRequestStatus(requestId: string): Promise<void> {
  const requestRef = db.collection("requests").doc(requestId);
  const now = FieldValue.serverTimestamp();

  await requestRef.update({
    dailyStatus: "checked-in",
    lastCheckIn: now,
    updatedAt: now
  });
}

/**
 * บันทึก Audit Log
 */
async function saveAuditLog(
  requestId: string,
  notes: string,
  auth: AuthResult,
  previousStatus: string
): Promise<void> {
  const now = FieldValue.serverTimestamp();

  await db.collection("auditLogs").add({
    action: "check-in",
    requestId,
    performedBy: {
      uid: auth.uid!,
      email: auth.email!,
      name: auth.name!
    },
    timestamp: now,
    notes: notes || "",
    metadata: {
      previousStatus: previousStatus || "scheduled",
      newStatus: "checked-in"
    }
  });
}

// ======================================================================
// MAIN FUNCTION (ฟังก์ชันหลัก)
// ======================================================================

export const checkInRequest = onRequest(
  { region: REGION },
  async (req: Request, res: Response): Promise<void> => {
    // ตั้งค่า CORS
    setCORS(res);

    // จัดการ OPTIONS request (preflight)
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // ต้องเป็น POST เท่านั้น
    if (req.method !== "POST") {
      sendError(res, 405, "method_not_allowed");
      return;
    }

    try {
      // ========== ขั้นตอนที่ 1: ตรวจสอบสิทธิ์ ==========
      const auth = await checkPermissions(req);
      if (!auth.ok) {
        sendError(res, 403, auth.error || "authentication_failed");
        return;
      }

      // ========== ขั้นตอนที่ 2: ตรวจสอบข้อมูลที่ส่งมา ==========
      const validation = validateRequestBody(req.body);
      if (!validation.valid) {
        sendError(
          res, 
          400, 
          validation.error || "invalid_input",
          "กรุณาระบุ Request ID"
        );
        return;
      }

      const { requestId, notes } = validation.data!;

      // ========== ขั้นตอนที่ 3: ตรวจสอบว่างานมีอยู่จริง ==========
      const requestRef = db.collection("requests").doc(requestId);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        sendError(res, 404, "request_not_found", "ไม่พบงานนี้");
        return;
      }

      const requestData = requestDoc.data() as RequestData;

      // ========== ขั้นตอนที่ 4: ตรวจสอบสถานะของงาน ==========
      const statusValidation = validateRequestStatus(requestData);
      if (!statusValidation.valid) {
        sendError(
          res,
          400,
          statusValidation.error || "invalid_status",
          statusValidation.message
        );
        return;
      }

      // ========== ขั้นตอนที่ 5: บันทึกข้อมูล ==========
      // 5.1 บันทึก checkIn document
      const checkInId = await saveCheckIn(requestId, notes || "", auth);

      // 5.2 อัปเดตสถานะ request
      await updateRequestStatus(requestId);

      // 5.3 บันทึก audit log
      await saveAuditLog(
        requestId,
        notes || "",
        auth,
        requestData.dailyStatus || "scheduled"
      );

      // ========== ขั้นตอนที่ 6: ส่งผลลัพธ์กลับ ==========
      sendSuccess(res, checkInId, requestId);

    } catch (e: any) {
      // จัดการ Error ที่ไม่คาดคิด
      console.error("[checkInRequest] Unexpected Error:", e);
      sendError(
        res,
        500,
        "internal_error",
        e?.message || "เกิดข้อผิดพลาดภายในระบบ"
      );
    }
  }
);