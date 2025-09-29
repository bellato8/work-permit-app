/* =========================================================================
 * ไฟล์: web/src/utils/metrics.ts
 * หน้าที่: รวม "ตัวช่วยคำนวณสถิติ" เพื่อใช้กับ Dashboard/Reports
 * ผู้ใช้หลัก: หน้า admin/Dashboard.tsx (และหน้าอื่น ๆ ในอนาคต)
 * ไลบรารีที่ใช้: dayjs (เดย์-เจเอส = จัดการวันเวลาแบบเบา)
 * -------------------------------------------------------------------------
 * คำศัพท์:
 * - normalize (นอร์-มะ-ไลซ์) = ทำให้ "รูปแบบข้อมูล" เป็นมาตรฐานเดียวกัน
 * - metrics (เมต-ริคส์) = ค่าชี้วัด เช่น ยอดต่อวัน, ยอดอนุมัติ, ฯลฯ
 * ========================================================================= */

import dayjs from "dayjs";

export type RequestItem = {
  rid?: string;
  status?: string; // "pending" | "approved" | "rejected" | ...
  requestType?: string; // ประเภทงาน ถ้ามี
  type?: string;
  category?: string;
  requester?: {
    fullname?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  } | null;
  applicant?: string;
  contractorName?: string;
  contact?: { name?: string } | null;
  createdBy?: { name?: string } | null;

  createdAt?: number | string | Date | null;
  updatedAt?: number | string | Date | null;

  // อื่น ๆ อนุโลมเป็น any เพื่อให้รีไซเคิลได้
  [key: string]: any;
};

export type TrendPoint = {
  /** วันที่รูปแบบ YYYY-MM-DD (มาตรฐานสำหรับ bucket ต่อวัน) */
  date: string;
  /** จำนวนคำขอในวันนั้น */
  count: number;
  /** ชื่อวันย่อ เช่น Mon/Tue (ไว้แสดงบนแกน X ถ้าต้องการ) */
  day: string;
};

export type Kpis = {
  pendingCount: number;
  approvedToday: number;
  rejectedIn7d: number;
};

export type TopTypeItem = { label: string; count: number };

/** แปลงอะไร ๆ ให้เป็น millis (มิลลิวินาที) อย่างปลอดภัย */
export function toMillis(input?: number | string | Date | null): number | null {
  if (input == null) return null;
  if (typeof input === "number") return input;
  if (typeof input === "string") {
    // รองรับทั้ง millis string และ ISO string
    const n = Number(input);
    if (!Number.isNaN(n) && n > 1e10) return n; // ถ้าเป็น millis string
    const d = dayjs(input);
    return d.isValid() ? d.valueOf() : null;
  }
  const d = dayjs(input);
  return d.isValid() ? d.valueOf() : null;
}

/** คืน "ชื่อผู้ยื่น/ผู้ขอ" ให้ได้มากที่สุด จากหลายรูปแบบที่พบ */
export function getRequesterName(item: RequestItem): string {
  const fromRequester =
    item.requester?.fullname ||
    item.requester?.name ||
    (item.requester?.firstName && item.requester?.lastName
      ? `${item.requester.firstName} ${item.requester.lastName}`
      : undefined);

  const candidates = [
    fromRequester,
    item.contractorName,
    item.applicant,
    item.contact?.name,
    item.createdBy?.name,
    item["requester_name"],
    item["name"],
  ].filter(Boolean) as string[];

  // คืนชื่อแรกที่หาได้ ไม่งั้นขีดกลาง "—"
  return candidates[0] || "—";
}

/** ดึง "ประเภทงาน" จาก field ที่เป็นไปได้หลายแบบ */
export function getRequestType(item: RequestItem): string {
  const label =
    item.requestType ||
    item.type ||
    item.category ||
    item["workType"] ||
    item["permitType"];
  return (label && String(label).trim()) || "ไม่ระบุ";
}

/** สร้างรายการวันย้อนหลัง N วัน (รวมวันนี้) รูปแบบ YYYY-MM-DD */
function lastNDaysDates(n: number): string[] {
  const arr: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    arr.push(dayjs().subtract(i, "day").format("YYYY-MM-DD"));
  }
  return arr;
}

/** รวมคำขอต่อวัน (ใช้ updatedAt เป็นหลัก ถ้าไม่มีใช้ createdAt) */
export function buildTrendSeries(items: RequestItem[], days = 7): TrendPoint[] {
  const dates = lastNDaysDates(days);
  const countsMap = new Map<string, number>();
  dates.forEach((d) => countsMap.set(d, 0));

  for (const it of items) {
    const t = toMillis(it.updatedAt) ?? toMillis(it.createdAt);
    if (!t) continue;
    const d = dayjs(t).format("YYYY-MM-DD");
    if (countsMap.has(d)) {
      countsMap.set(d, (countsMap.get(d) || 0) + 1);
    }
  }

  return dates.map((d) => ({
    date: d,
    count: countsMap.get(d) || 0,
    day: dayjs(d).format("ddd"),
  }));
}

/** สรุป KPI พื้นฐาน: pending ทั้งหมด, approved วันนี้, rejected 7 วันหลัง */
export function summarizeKpis(items: RequestItem[]): Kpis {
  const today = dayjs().format("YYYY-MM-DD");
  const sevenDaysAgo = dayjs().subtract(6, "day").startOf("day"); // รวมวันนี้ = 7 วัน

  let pending = 0;
  let approvedToday = 0;
  let rejected7d = 0;

  for (const it of items) {
    const status = (it.status || "").toLowerCase();
    if (status === "pending") pending++;

    const t = toMillis(it.updatedAt) ?? toMillis(it.createdAt);
    if (!t) continue;
    const d = dayjs(t);

    if (status === "approved" && d.format("YYYY-MM-DD") === today) {
      approvedToday++;
    }
    if (status === "rejected" && d.isAfter(sevenDaysAgo)) {
      rejected7d++;
    }
  }

  return { pendingCount: pending, approvedToday, rejectedIn7d: rejected7d };
}

/** สรุปประเภทงานยอดฮิต TOP N */
export function summarizeTopTypes(
  items: RequestItem[],
  topN = 5
): TopTypeItem[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const label = getRequestType(it);
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}
