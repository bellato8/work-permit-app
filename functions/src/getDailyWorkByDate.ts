// ======================================================================
// File: functions/src/getDailyWorkByDate.ts
// เวอร์ชัน: 2025-10-13 (Task 20 - FIXED)
// หน้าที่: ดึงข้อมูลงานทั้งหมดในวันที่เลือก แยกตาม dailyStatus
// Region: asia-southeast1
// 
// 🔧 การแก้ไข:
//   - แก้ query จาก startDate → work.from (เพราะ Firestore ไม่มีฟิลด์ startDate)
//   - แปลง work.from จาก "2025-10-13T14:16" → "2025-10-13" เพื่อเทียบวัน
//   - รองรับ status ทั้ง "approved" และ "อนุมัติ"
//   - เพิ่ม error handling ที่ดีขึ้น
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-southeast1";

// ==================== CORS Middleware ====================
function setCORS(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

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

    // เช็คว่ามีสิทธิ์ viewTodayWork หรือ viewOtherDaysWork
    const adminDoc = await db.collection("admins").doc(email).get();
    
    if (!adminDoc.exists) {
      return { ok: false, error: "not_admin" };
    }

    const adminData = adminDoc.data();
    const permissions = adminData?.permissions || {};
    
    if (!permissions.viewTodayWork && !permissions.viewOtherDaysWork) {
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
function extractDate(datetimeStr: string): string {
  if (!datetimeStr) return "";
  
  // ถ้าเป็น ISO format ที่มี T
  if (datetimeStr.includes("T")) {
    return datetimeStr.split("T")[0];
  }
  
  // ถ้าเป็น format อื่นๆ ลองแยกด้วย space
  if (datetimeStr.includes(" ")) {
    return datetimeStr.split(" ")[0];
  }
  
  // ถ้าเป็น YYYY-MM-DD อยู่แล้ว
  return datetimeStr;
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
      // ========== ตรวจสอบสิทธิ์ ==========
      const auth = await checkPermissions(req);
      if (!auth.ok) {
        res.status(403).json({ ok: false, error: auth.error });
        return;
      }

      // ========== รับพารามิเตอร์ ==========
      const { date } = req.body; // "2025-10-13"

      if (!date || typeof date !== "string") {
        res.status(400).json({ 
          ok: false, 
          error: "invalid_date",
          message: "กรุณาระบุวันที่ในรูปแบบ YYYY-MM-DD" 
        });
        return;
      }

      // ========== ตรวจสอบสิทธิ์ดูวันอื่น ==========
      const adminDoc = await db.collection("admins").doc(auth.email!).get();
      const adminData = adminDoc.data();
      const canViewOtherDays = adminData?.permissions?.viewOtherDaysWork || false;

      // ถ้าไม่มีสิทธิ์ viewOtherDaysWork ให้ดูได้แค่วันนี้
      const today = new Date().toISOString().split("T")[0]; // "2025-10-13"
      if (!canViewOtherDays && date !== today) {
        res.status(403).json({ 
          ok: false, 
          error: "cannot_view_other_days",
          message: "คุณไม่มีสิทธิ์ดูงานวันอื่น" 
        });
        return;
      }

      // ========== Query งานทั้งหมด (รองรับ status ทั้ง 2 ภาษา) ==========
      console.log(`[getDailyWorkByDate] Querying for date: ${date}`);
      
      // 🔧 Query ทีละ status (เพราะ Firestore ไม่รองรับ OR ใน where)
      const approvedStatuses = ["approved", "อนุมัติ"];
      const allRequests: any[] = [];
      
      for (const status of approvedStatuses) {
        const snapshot = await db
          .collection("requests")
          .where("status", "==", status)
          .get();
        
        // Filter ด้วย JavaScript เพราะไม่สามารถ query nested field work.from ได้โดยตรง
        snapshot.forEach(doc => {
          const data = doc.data();
          const workFrom = data.work?.from || "";
          const workDate = extractDate(workFrom);
          
          // เช็คว่าวันที่ตรงกับที่ต้องการไหม
          if (workDate === date) {
            allRequests.push({ id: doc.id, ...data });
          }
        });
      }

      console.log(`[getDailyWorkByDate] Found ${allRequests.length} requests for date ${date}`);

      if (allRequests.length === 0) {
        res.json({
          ok: true,
          date,
          scheduled: [],
          checkedIn: [],
          checkedOut: [],
          total: 0
        });
        return;
      }

      // ========== แยกตาม dailyStatus ==========
      const scheduled: any[] = [];
      const checkedIn: any[] = [];
      const checkedOut: any[] = [];

      allRequests.forEach(doc => {
        const data = doc;
        
        // สร้าง work object สำหรับ response
        const work = {
          rid: data.requestId || doc.id,
          contractorName: data.requester?.fullname || data.requester?.company || "ไม่ระบุ",
          permitType: data.work?.type || "ไม่ระบุ",
          area: `${data.work?.floor || "N/A"} / ${data.work?.area || "N/A"}`,
          startTime: extractTime(data.work?.from || ""),
          endTime: extractTime(data.work?.to || ""),
          dailyStatus: data.dailyStatus || "scheduled",
          lastCheckIn: data.lastCheckIn || null,
          lastCheckOut: data.lastCheckOut || null,
        };

        // แยกตาม dailyStatus
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
        total: scheduled.length + checkedIn.length + checkedOut.length
      });

    } catch (e: any) {
      console.error("[getDailyWorkByDate] Error:", e);
      res.status(500).json({ 
        ok: false, 
        error: "internal_error",
        message: e?.message || "เกิดข้อผิดพลาด" 
      });
    }
  }
);

// ==================== Helper: แยกเวลา ====================
/**
 * แยกเวลาจาก datetime string
 * "2025-10-13T14:16" → "14:16"
 */
function extractTime(datetimeStr: string): string {
  if (!datetimeStr) return "N/A";
  
  // ถ้ามี T ให้แยกเอาส่วนหลัง T
  if (datetimeStr.includes("T")) {
    const parts = datetimeStr.split("T");
    if (parts.length > 1) {
      return parts[1].substring(0, 5); // "14:16"
    }
  }
  
  // ถ้ามี space ให้แยกเอาส่วนหลัง space
  if (datetimeStr.includes(" ")) {
    const parts = datetimeStr.split(" ");
    if (parts.length > 1) {
      return parts[1].substring(0, 5);
    }
  }
  
  return "N/A";
}