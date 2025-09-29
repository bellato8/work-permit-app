// ======================================================================
// File: web/src/services/reports.ts
// เวอร์ชัน: 2025-09-22 13:40 (Asia/Bangkok)
// หน้าที่: ดึง KPI + Trends สำหรับหน้า Reports โดยใช้ Firestore Aggregation Queries
// - count() / average() แบบ read-time + in-memory cache 5 นาที
// อ้างอิงหลัก:
//   - Aggregation queries (count/sum/avg) บน Firestore Web SDK
//   - getCountFromServer / getAggregateFromServer
// หมายเหตุ:
//   - Trends (รายวัน) ใช้วิธีนับรายวันทีละบัคเก็ต (MVP) เหมาะกับ 7/30 วัน
//   - ถ้าต้องการสเกลสูง แนะนำทำ write-time aggregation หรือฟังก์ชันฝั่ง server ในเฟสถัดไป
// ======================================================================

import {
  collection, query, where, Timestamp,
  getCountFromServer, getAggregateFromServer, average,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export type RangePreset = "today" | "thisWeek" | "thisMonth" | "last30";

export type KpiResult = {
  totalPermits: number | null;
  approvalRate: number | null;     // %
  avgLeadTimeHrs: number | null;   // ชั่วโมง
  complianceScore: number | null;  // %
};

export type TrendPoint = {
  /** วันที่รูปแบบ YYYY-MM-DD (local) */
  date: string;
  /** ป้ายชื่อสั้นสำหรับแกน X เช่น 20 Sep */
  label: string;
  /** จำนวนใบอนุญาตทั้งหมดของวันนั้น */
  total: number;
  /** จำนวนที่ Approved ของวันนั้น */
  approved: number;
};

// ----------------- CONFIG -----------------
const COLLECTION = "requests";
// ✅ แก้ไข: เพิ่ม 'updatedAt' และ export ตามคำแนะนำ
export const TIME_FIELDS_TRY = ['createdAt','submittedAt','updatedAt'] as const;
// ✅ เพิ่ม: สร้าง Type ใหม่สำหรับฟิลด์เวลา
type TimeField = (typeof TIME_FIELDS_TRY)[number];

const LEAD_TIME_FIELD = "leadTimeHours";
const COMPLIANCE_FIELD = "complianceScore";

const cache = new Map<string, { at: number; data: any }>();
const TTL_MS = 5 * 60 * 1000; // 5 นาที

// ----------------- Date helpers -----------------
function startOfDayLocal(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDayLocal(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function fmtYYYYMMDD(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function shortLabel(d: Date) {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export function resolveRange(preset: RangePreset): { from: Date; to: Date; buckets: number } {
  const now = new Date();
  if (preset === "today") {
    // สำหรับภาพรวม เราจะโชว์ 7 วันย้อนหลัง (เพื่อรูปแบบเดียวกับ Weekly)
    const to = endOfDayLocal(now);
    const from = startOfDayLocal(addDays(now, -6));
    return { from, to, buckets: 7 };
  }
  if (preset === "thisWeek") {
    const day = now.getDay(); // 0=Sun
    const diffToMon = ((day + 6) % 7);
    const from = startOfDayLocal(addDays(now, -diffToMon));
    const to = endOfDayLocal(addDays(from, 6));
    return { from, to, buckets: 7 };
  }
  if (preset === "thisMonth" || preset === "last30") {
    const to = endOfDayLocal(now);
    const from = startOfDayLocal(addDays(now, -29));
    return { from, to, buckets: 30 };
  }
  // fallback
  return { from: startOfDayLocal(addDays(now, -6)), to: endOfDayLocal(now), buckets: 7 };
}

// ----------------- KPI (เหมือนเดิม + แคช) -----------------
export async function fetchKpis(preset: RangePreset): Promise<KpiResult> {
  const { from, to } = resolveRange(preset);
  const key = `kpi-${preset}-${from.toISOString()}-${to.toISOString()}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.data as KpiResult;

  const fromTs = Timestamp.fromDate(from);
  const toTs = Timestamp.fromDate(to);

  let total = 0;
  let approved = 0;
  let avgLeadTime: number | null = null;
  let avgCompliance: number | null = null;

  for (const timeField of TIME_FIELDS_TRY) {
    const baseRef = collection(db, COLLECTION);
    const qBase = query(baseRef, where(timeField as string, ">=", fromTs), where(timeField as string, "<=", toTs));
    const { data: totalAgg } = await getCountFromServer(qBase);
    const t = totalAgg().count;
    if (typeof t === "number") {
      total = t;

      const qApproved = query(
        baseRef,
        where(timeField as string, ">=", fromTs),
        where(timeField as string, "<=", toTs),
        where("status", "==", "approved")
      );
      const { data: approvedAgg } = await getCountFromServer(qApproved);
      approved = approvedAgg().count ?? 0;

      try {
        const qLead = query(
          baseRef,
          where(timeField as string, ">=", fromTs),
          where(timeField as string, "<=", toTs),
          where(LEAD_TIME_FIELD as string, ">", 0)
        );
        const snapLead = await getAggregateFromServer(qLead, { avgLead: average(LEAD_TIME_FIELD) });
        const v = snapLead.data().avgLead as number | null | undefined;
        avgLeadTime = typeof v === "number" ? v : null;
      } catch { /* ignore */ }

      try {
        const qComp = query(
          baseRef,
          where(timeField as string, ">=", fromTs),
          where(timeField as string, "<=", toTs),
          where(COMPLIANCE_FIELD as string, ">", 0)
        );
        const snapComp = await getAggregateFromServer(qComp, { avgComp: average(COMPLIANCE_FIELD) });
        const c = snapComp.data().avgComp as number | null | undefined;
        avgCompliance = typeof c === "number" ? c : null;
      } catch { /* ignore */ }

      break;
    }
  }

  const result: KpiResult = {
    totalPermits: total || 0,
    approvalRate: total > 0 ? (approved / total) * 100 : null,
    avgLeadTimeHrs: avgLeadTime ?? null,
    complianceScore: avgCompliance ?? null,
  };

  cache.set(key, { at: now, data: result });
  return result;
}

// ----------------- Trends (รายวัน 7/30 จุด) -----------------
// ✅ แก้ไข: ปรับ Typing ของฟังก์ชันทั้งหมด
async function detectTimeField(fromTs: Timestamp, toTs: Timestamp): Promise<TimeField> {
  let bestField: TimeField = TIME_FIELDS_TRY[0];
  let bestCount = -1;
  for (const f of TIME_FIELDS_TRY) {
    const baseRef = collection(db, COLLECTION);
    const qBase = query(baseRef, where(f, ">=", fromTs), where(f, "<=", toTs));
    const { data } = await getCountFromServer(qBase);
    const c = data().count ?? 0;
    if (c > bestCount) {
      bestCount = c;
      bestField = f; // ✅ ตอนนี้ชนิดตรงกันแล้ว
    }
  }
  return bestField;
}

export async function fetchTrends(preset: RangePreset): Promise<TrendPoint[]> {
  const { from, to, buckets } = resolveRange(preset);
  const key = `trends-${preset}-${from.toISOString()}-${to.toISOString()}-${buckets}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.data as TrendPoint[];

  const fromTs = Timestamp.fromDate(from);
  const toTs = Timestamp.fromDate(to);
  const timeField = await detectTimeField(fromTs, toTs);

  const baseRef = collection(db, COLLECTION);
  const points: TrendPoint[] = [];

  for (let i = 0; i < buckets; i++) {
    const day = startOfDayLocal(addDays(from, i));
    const dayEnd = endOfDayLocal(day);
    const dayStartTs = Timestamp.fromDate(day);
    const dayEndTs = Timestamp.fromDate(dayEnd);

    // Total ต่อวัน
    const qTotal = query(
      baseRef,
      where(timeField, ">=", dayStartTs),
      where(timeField, "<=", dayEndTs)
    );
    const { data: totalAgg } = await getCountFromServer(qTotal);
    const total = totalAgg().count ?? 0;

    // Approved ต่อวัน
    const qApproved = query(
      baseRef,
      where(timeField, ">=", dayStartTs),
      where(timeField, "<=", dayEndTs),
      where("status", "==", "approved")
    );
    const { data: approvedAgg } = await getCountFromServer(qApproved);
    const approved = approvedAgg().count ?? 0;

    points.push({
      date: fmtYYYYMMDD(day),
      label: shortLabel(day),
      total,
      approved,
    });
  }

  cache.set(key, { at: now, data: points });
  return points;
}