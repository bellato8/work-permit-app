// ======================================================================
// File: functions/src/getCalendarView.ts
// เวอร์ชัน: 2025-10-24 (AuthZ-integrated - FIXED insufficient_permissions)
// หน้าที่: Query งานในเดือนที่ระบุ และนับจำนวนงานแต่ละวัน แยกตาม dailyStatus
//
// 🔧 การแก้ไข:
//   - ✅ ใช้ authz.ts (requireFirebaseUser + canViewDailyOps) แทนการเช็คสิทธิ์เอง
//   - ✅ รองรับ fallback จาก pagePermissions → caps เหมือน getDailyWorkByDate
//   - ✅ แก้ query จาก startDate → ดึงข้อมูลทั้งหมดแล้ว filter ด้วย work.from
//   - ✅ รองรับ status ทั้ง "approved" และ "อนุมัติ"
//   - ✅ Group และนับจำนวนด้วย JavaScript
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

// ✅ ใช้ด่านกลางจาก authz.ts เหมือน getDailyWorkByDate
import { requireFirebaseUser, canViewDailyOps, readAdminDoc } from "./authz";

if (!getApps().length) initializeApp();
const db = getFirestore();

const REGION = "asia-southeast1";

function setCORS(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ==================== Helper: สร้างรายการวันในเดือน ====================
function getDaysInMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: string[] = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push(dateStr);
  }
  
  return days;
}

// ==================== Helper: แปลงวันที่ ====================
/**
 * แปลง datetime string เป็น date string
 * "2025-10-13T14:16" → "2025-10-13"
 */
function extractDate(datetimeStr: string): string {
  if (!datetimeStr) return "";
  
  if (datetimeStr.includes("T")) {
    return datetimeStr.split("T")[0];
  }
  
  if (datetimeStr.includes(" ")) {
    return datetimeStr.split(" ")[0];
  }
  
  return datetimeStr;
}

// ==================== Helper: เช็คว่าวันที่อยู่ในช่วงเดือนไหม ====================
function isDateInMonth(dateStr: string, year: number, month: number): boolean {
  if (!dateStr) return false;
  
  const parts = dateStr.split("-");
  if (parts.length !== 3) return false;
  
  const dateYear = parseInt(parts[0]);
  const dateMonth = parseInt(parts[1]);
  
  return dateYear === year && dateMonth === month;
}

// ==================== Main Function ====================
export const getCalendarView = onRequest(
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
      // ========== ✅ ใช้ authz.ts แทนการเช็คเอง ==========
      const who = await requireFirebaseUser(req);
      if (!who.ok) {
        res.status(who.status).json({ ok: false, error: who.error });
        return;
      }

      // ========== รับพารามิเตอร์ ==========
      const { year, month } = req.body; // year: 2025, month: 10 (Oct)

      if (!year || !month || typeof year !== "number" || typeof month !== "number") {
        res.status(400).json({ 
          ok: false, 
          error: "invalid_params",
          message: "กรุณาระบุ year (number) และ month (number 1-12)" 
        });
        return;
      }

      if (month < 1 || month > 12) {
        res.status(400).json({ 
          ok: false, 
          error: "invalid_month",
          message: "เดือนต้องอยู่ระหว่าง 1-12" 
        });
        return;
      }

      // ========== ✅ ตรวจสิทธิ์ด้วย canViewDailyOps (รองรับ fallback) ==========
      // เช็คสิทธิ์ดูปฏิทิน (ใช้วันแรกของเดือนเป็นตัวอ้างอิง)
      const firstDayOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const adminDoc = (await readAdminDoc(who.email)) || (who as any);
      
      if (!canViewDailyOps(adminDoc, firstDayOfMonth)) {
        res.status(403).json({ ok: false, error: "insufficient_permissions" });
        return;
      }

      // ========== สร้างรายการวันในเดือน ==========
      const days = getDaysInMonth(year, month - 1); // month - 1 เพราะ JS Date เริ่มที่ 0
      logger.info(`[getCalendarView] Getting data for ${year}-${String(month).padStart(2, "0")}`, {
        email: who.email,
      });

      // ========== Query งานทั้งหมด (รองรับ status ทั้ง 2 ภาษา) ==========
      const approvedStatuses = ["approved", "อนุมัติ"];
      const allRequests: any[] = [];
      
      for (const status of approvedStatuses) {
        const snapshot = await db
          .collection("requests")
          .where("status", "==", status)
          .get();
        
        // Filter เฉพาะงานในเดือนนี้
        snapshot.forEach(doc => {
          const data = doc.data();
          const workFrom = data.work?.from || "";
          const workDate = extractDate(workFrom);
          
          // เช็คว่าวันที่อยู่ในเดือนที่ต้องการไหม
          if (isDateInMonth(workDate, year, month)) {
            allRequests.push({ id: doc.id, date: workDate, ...data });
          }
        });
      }

      logger.info(`[getCalendarView] Found ${allRequests.length} requests for ${year}-${month}`, {
        email: who.email,
      });

      // ========== นับจำนวนแต่ละวัน แยกตาม dailyStatus ==========
      const dateCounts: Record<string, {
        totalWorks: number;
        scheduled: number;
        checkedIn: number;
        checkedOut: number;
      }> = {};

      // Initialize
      days.forEach(date => {
        dateCounts[date] = {
          totalWorks: 0,
          scheduled: 0,
          checkedIn: 0,
          checkedOut: 0
        };
      });

      // Count
      allRequests.forEach(doc => {
        const date = doc.date;
        
        if (dateCounts[date]) {
          dateCounts[date].totalWorks++;
          
          switch (doc.dailyStatus) {
            case "checked-in":
              dateCounts[date].checkedIn++;
              break;
            case "checked-out":
              dateCounts[date].checkedOut++;
              break;
            default:
              dateCounts[date].scheduled++;
          }
        }
      });

      // ========== Convert to array ==========
      const daysData = days.map(date => ({
        date,
        ...dateCounts[date]
      }));

      res.json({
        ok: true,
        year,
        month,
        days: daysData
      });
      return;

    } catch (e: any) {
      logger.error("[getCalendarView] Error", { message: e?.message || String(e) });
      res.status(500).json({ 
        ok: false, 
        error: "internal_error",
        message: e?.message || "เกิดข้อผิดพลาด" 
      });
      return;
    }
  }
);

