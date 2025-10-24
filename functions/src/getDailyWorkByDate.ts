// ======================================================================
// File: functions/src/getDailyWorkByDate.ts
// เวอร์ชัน: 2025-10-24 (AuthZ-integrated, timezone-safe)
// หน้าที่: ดึงข้อมูลงานทั้งหมดในวันที่เลือก แยกตาม dailyStatus
// Region: asia-southeast1
//
// การปรับปรุงจากไฟล์เดิม (สรุป):
//   1) ✅ ใช้ด่านกลางจาก authz.ts  (requireFirebaseUser + canViewDailyOps)
//      - ไม่ verify token และไม่อ่านสิทธิ์เองซ้ำในไฟล์นี้อีก
//      - รองรับ fallback จาก pagePermissions → caps (ซึ่งเราเพิ่มใน authz.ts แล้ว)
//   2) ✅ เทียบ "วันนี้" ตาม timezone ผู้ใช้ ไปอยู่ใน canViewDailyOps (authz.ts)
//   3) ✅ คง CORS/โครง POST + preflight OPTIONS ไว้เหมือนเดิม
//   4) ✅ คงวิธี query เดิม (loop สถานะ 'approved'/'อนุมัติ' แล้ว filter ด้วย JS)
//      - ถ้าต้องการประสิทธิภาพสูงขึ้นในอนาคต ควรมีฟิลด์ date (YYYY-MM-DD) แยกในเอกสารเพื่อ query ตรง
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

// ✅ ดึงด่านกลางที่เพิ่งปรับแล้ว
import { requireFirebaseUser, canViewDailyOps, readAdminDoc } from "./authz";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-southeast1";

// ==================== CORS Middleware ====================
function setCORS(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

<<<<<<< HEAD
// ==================== Helper: แปลงวันที่/เวลา ====================
/** "2025-10-13T14:16" → "2025-10-13" */
=======
// ==================== ตรวจสอบสิทธิ์ ====================
async function checkPermissions(req: any): Promise<{
  ok: boolean;
  error?: string;
  uid?: string;
  email?: string;
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

    // ดึงข้อมูล Admin จาก Firestore
    const adminDoc = await db.collection("admins").doc(email).get();
    
    if (!adminDoc.exists) {
      return { ok: false, error: "not_admin" };
    }

    const adminData = adminDoc.data();
    // ใช้ pagePermissions.dailyWork.canView ในการตรวจสอบสิทธิ์
    const canViewDailyWork = adminData?.pagePermissions?.dailyWork?.canView;
    
    if (!canViewDailyWork) {
      return { ok: false, error: "insufficient_permissions" };
    }

    return { ok: true, uid: decoded.uid, email };
  } catch (e: any) {
    console.error("[checkPermissions] Error:", e);
    return { ok: false, error: "invalid_token" };
  }
}

// ==================== Helper: แปลงวันที่ ====================
/**
 * แปลง datetime string เป็น date string
 * "2025-10-13T14:16" → "2025-10-13"
 */
>>>>>>> 2a84cc434188f78af3b236f09fee74ba76df5e84
function extractDate(datetimeStr: string): string {
  if (!datetimeStr) return "";
  if (datetimeStr.includes("T")) return datetimeStr.split("T")[0];
  if (datetimeStr.includes(" ")) return datetimeStr.split(" ")[0];
  return datetimeStr; // assume already YYYY-MM-DD
}

/** "2025-10-13T14:16" → "14:16" */
function extractTime(datetimeStr: string): string {
  if (!datetimeStr) return "N/A";
  if (datetimeStr.includes("T")) return (datetimeStr.split("T")[1] || "").substring(0, 5);
  if (datetimeStr.includes(" ")) return (datetimeStr.split(" ")[1] || "").substring(0, 5);
  return "N/A";
}

// ==================== Main Function ====================
export const getDailyWorkByDate = onRequest(
  { region: REGION },
  async (req, res) => {
    setCORS(res);

    // Handle OPTIONS (preflight)
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // Accept POST only
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    try {
      // ========== ตรวจสอบตัวตนและโหลดสิทธิ์ (รวม fallback pagePermissions → caps) ==========
      const who = await requireFirebaseUser(req);
      if (!who.ok) {
        res.status(who.status).json({ ok: false, error: who.error });
        return;
      }

      // ========== รับพารามิเตอร์ ==========
      const { date } = (req.body || {}) as { date?: string };
      if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({
          ok: false,
          error: "invalid_date",
          message: "กรุณาระบุวันที่ในรูปแบบ YYYY-MM-DD",
        });
        return;
      }

<<<<<<< HEAD
      // ========== ตรวจสิทธิ์ดูงานประจำวันของวันที่ร้องขอ ==========
      // หมายเหตุ: canViewDailyOps ใช้ timezone ของผู้ใช้ภายใน (authz.ts) ให้ superadmin ผ่าน, มี fallback pagePermissions
      // เพื่อความแม่น เราลองดึง adminDoc สดอีกครั้ง (ถ้าไม่มีให้ใช้ข้อมูลใน who)
      const adminDoc = (await readAdminDoc(who.email)) || (who as any);
      if (!canViewDailyOps(adminDoc, date)) {
        res.status(403).json({ ok: false, error: "insufficient_permissions" });
=======
      // ========== ตรวจสอบสิทธิ์ดูวันอื่น ==========
      const adminDoc = await db.collection("admins").doc(auth.email!).get();
      const adminData = adminDoc.data();
      // ใช้ pagePermissions.dailyWork.canViewOtherDays ในการตรวจสอบสิทธิ์
      const canViewOtherDays = adminData?.pagePermissions?.dailyWork?.canViewOtherDays || false;

      // ถ้าไม่มีสิทธิ์ viewOtherDaysWork ให้ดูได้แค่วันนี้
      const today = new Date().toISOString().split("T")[0]; // "2025-10-13"
      if (!canViewOtherDays && date !== today) {
        res.status(403).json({ 
          ok: false, 
          error: "cannot_view_other_days",
          message: "คุณไม่มีสิทธิ์ดูงานวันอื่น" 
        });
>>>>>>> 2a84cc434188f78af3b236f09fee74ba76df5e84
        return;
      }

      // ========== Query งานทั้งหมด (รองรับ status ทั้ง "approved" และ "อนุมัติ") ==========
      logger.info(`[getDailyWorkByDate] Querying for date: ${date}`, { email: who.email });

      const approvedStatuses = ["approved", "อนุมัติ"];
      const allRequests: any[] = [];

      // Firestore ไม่มี OR ใน where (คลาสสิก) → loop ทีละสถานะ
      for (const status of approvedStatuses) {
        const snapshot = await db.collection("requests").where("status", "==", status).get();

        snapshot.forEach((doc) => {
          const data = doc.data();
          const workFrom = data.work?.from || "";
          const workDate = extractDate(workFrom);
          if (workDate === date) {
            allRequests.push({ id: doc.id, ...data });
          }
        });
      }

      logger.info(`[getDailyWorkByDate] Found ${allRequests.length} requests`, {
        date,
        email: who.email,
      });

      if (allRequests.length === 0) {
        res.json({
          ok: true,
          date,
          scheduled: [],
          checkedIn: [],
          checkedOut: [],
          total: 0,
        });
        return;
      }

      // ========== แยกตาม dailyStatus ==========
      const scheduled: any[] = [];
      const checkedIn: any[] = [];
      const checkedOut: any[] = [];

      allRequests.forEach((data) => {
        const work = {
          rid: data.requestId || data.id,
          contractorName: data.requester?.fullname || data.requester?.company || "ไม่ระบุ",
          permitType: data.work?.type || "ไม่ระบุ",
          area: `${data.work?.floor || "N/A"} / ${data.work?.area || "N/A"}`,
          startTime: extractTime(data.work?.from || ""),
          endTime: extractTime(data.work?.to || ""),
          dailyStatus: data.dailyStatus || "scheduled",
          lastCheckIn: data.lastCheckIn || null,
          lastCheckOut: data.lastCheckOut || null,
        };

        switch (data.dailyStatus) {
          case "checked-in":
            checkedIn.push(work);
            break;
          case "checked-out":
            checkedOut.push(work);
            break;
          default:
            scheduled.push(work);
        }
      });

      // ========== Return ==========
      res.json({
        ok: true,
        date,
        scheduled,
        checkedIn,
        checkedOut,
        total: scheduled.length + checkedIn.length + checkedOut.length,
      });
    } catch (e: any) {
      logger.error("[getDailyWorkByDate] Error", { message: e?.message || String(e) });
      res.status(500).json({
        ok: false,
        error: "internal_error",
        message: e?.message || "เกิดข้อผิดพลาด",
      });
    }
  }
);
