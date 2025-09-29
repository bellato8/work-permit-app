// ======================================================================
// File: web/src/lib/reportsApi.ts
// เวอร์ชัน: 2025-09-23 00:50 (Asia/Bangkok)
// หน้าที่: ฟังก์ชันดึงข้อมูล Reports (KPI/Trends) จาก API — proxy-first แล้วค่อย fallback ไป Gen-2
// เชื่อม auth แบบ dynamic: พยายาม import('./auth') ก่อน แล้วค่อย fallback './firebase'
// หมายเหตุ: ตั้งค่า VITE_REPORTS_USE_PROXY_FIRST=1 เพื่อเลี่ยง CORS โดยเรียก proxy ก่อน
// ======================================================================

// ---------- auth adapter (dynamic import) ----------
async function getIdToken(): Promise<string | undefined> {
  try {
    const mod =
      (await import("./auth").catch(() => null)) ||
      (await import("./firebase").catch(() => null));
    const auth = (mod as any)?.auth;
    const u = auth?.currentUser;
    return u ? await u.getIdToken() : undefined;
  } catch {
    return;
  }
}

// ---------- ชนิดข้อมูลที่เราต้องใช้ (ขั้นต่ำ) ----------
export type RequestRecord = {
  id?: string;
  status?: string; // "approved" | "rejected" | ...
  createdAt?: any; // Date | string | number | Firestore Timestamp | { seconds, nanoseconds }
  approvedAt?: any;
  images?: { idCardStampedPath?: string } | null;
  [k: string]: any;
};

// ---------- ค่าช่วยอ่าน env ----------
const ENV = (name: string, fallback = "") =>
  (import.meta as any)?.env?.[name] ?? fallback;

const VITE_LIST_REQUESTS_URL = ENV("VITE_LIST_REQUESTS_URL");
const VITE_PROXY_LIST_REQUESTS_URL =
  ENV("VITE_PROXY_LIST_REQUESTS_URL") || ENV("VITE_PROXY_LISTREQUESTS_URL"); // รองรับได้ทั้งสองชื่อ
const VITE_APPROVER_KEY = ENV("VITE_APPROVER_KEY");
const VITE_APPROVER_EMAIL = ENV("VITE_APPROVER_EMAIL");
const USE_PROXY_FIRST = String(ENV("VITE_REPORTS_USE_PROXY_FIRST", "1")) === "1";

// เปิดโหมดดีบักง่าย ๆ จากหน้าคอนโซล: window.DEBUG_REPORTS="1"
const DEBUG = (globalThis as any).DEBUG_REPORTS === "1";

// ---------- Utils เวลา ----------
export function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Date.parse(v.replace(" at ", " ")) || 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "object") {
    if (typeof v.toMillis === "function") return v.toMillis();
    const s = (v.seconds ?? 0) * 1e3;
    const n = Math.floor((v.nanoseconds ?? 0) / 1e6);
    return s + n;
  }
  return 0;
}

export type RangePreset = "today" | "thisWeek" | "thisMonth" | "last30";

function rangeToFromTo(preset: RangePreset): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now);
  if (preset === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (preset === "thisWeek") {
    const start = new Date(now);
    const day = start.getDay(); // 0=Sun
    const diff = (day + 6) % 7; // ให้จันทร์เป็นวันแรก
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (preset === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  // last30 (default)
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function buildAuthHeaders(idToken?: string): HeadersInit {
  const key = localStorage.getItem("approver_key") || VITE_APPROVER_KEY || "";
  const requester =
    localStorage.getItem("admin_requester_email") || VITE_APPROVER_EMAIL || "";

  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": key,
    "x-requester-email": requester,
  };
  if (idToken) h["Authorization"] = `Bearer ${idToken}`;
  return h;
}

// ---------- Core caller (proxy-first fallback) ----------
type RawRequest = Record<string, any>;

async function callListRequests(
  params: RawRequest,
  preferProxyFirst: boolean
): Promise<any[]> {
  const idToken = await getIdToken();
  const headers = buildAuthHeaders(idToken);

  const directUrl = VITE_LIST_REQUESTS_URL;
  const proxyUrl = VITE_PROXY_LIST_REQUESTS_URL;

  if (DEBUG) {
    console.log("[reportsApi] endpoints =>", {
      preferProxyFirst,
      proxyUrl,
      directUrl,
      params,
    });
  }

  const postReq: RequestInit = {
    method: "POST",
    mode: "cors",
    headers,
    body: JSON.stringify(params),
  };

  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const getReq: RequestInit = {
    method: "GET",
    mode: "cors",
    headers,
  };

  const tryOrders: Array<() => Promise<Response>> = [];

  function tryProxyPOST() {
    if (!proxyUrl) throw new Error("proxy url not set");
    return fetch(proxyUrl, postReq);
  }
  function tryProxyGET() {
    if (!proxyUrl) throw new Error("proxy url not set");
    return fetch(`${proxyUrl}?${qs.toString()}`, getReq);
  }
  function tryDirectPOST() {
    if (!directUrl) throw new Error("direct url not set");
    return fetch(directUrl, postReq);
  }
  function tryDirectGET() {
    if (!directUrl) throw new Error("direct url not set");
    return fetch(`${directUrl}?${qs.toString()}`, getReq);
  }

  if (preferProxyFirst) {
    tryOrders.push(tryProxyPOST, tryProxyGET, tryDirectPOST, tryDirectGET);
  } else {
    tryOrders.push(tryDirectPOST, tryDirectGET, tryProxyPOST, tryProxyGET);
  }

  let lastErr: any;
  for (const tryOnce of tryOrders) {
    try {
      const res = await tryOnce();
      if (!res.ok) {
        if (DEBUG) console.warn("[reportsApi] non-ok status:", res.status);
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const out: any[] = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];
      return out;
    } catch (e: any) {
      lastErr = e;
      if (DEBUG) console.warn("[reportsApi] try failed:", e?.message);
    }
  }

  if (DEBUG) console.error("[reportsApi] all attempts failed:", lastErr);
  return [];
}

// ---------- Public APIs ----------
export async function fetchRequests(params: {
  from: Date | string;
  to: Date | string;
  status?: string; // ไม่ได้ใช้ในการฟิลเตอร์ฝั่ง API แต่คง field ไว้ให้เรียกเหมือนเดิม
}): Promise<RequestRecord[]> {
  const fromISO = typeof params.from === "string" ? params.from : params.from.toISOString();
  const toISO = typeof params.to === "string" ? params.to : params.to.toISOString();
  const rows = await callListRequests({ from: fromISO, to: toISO }, USE_PROXY_FIRST);
  // ให้แน่ใจว่าเป็นอาร์เรย์
  return Array.isArray(rows) ? (rows as RequestRecord[]) : [];
}

export type TrendPoint = {
  label: string;
  total: number;
  approved: number;
};

export type KpisResult = {
  totalPermits: number;
  approvalRate: number;    // %
  avgLeadTimeHrs: number;  // ชั่วโมง
  complianceScore: number; // %
};

export async function fetchKpis(range: RangePreset): Promise<KpisResult> {
  const { from, to } = rangeToFromTo(range);
  const list = await callListRequests({ from, to }, USE_PROXY_FIRST);
  const rows = Array.isArray(list) ? list : [];

  const total = rows.length;
  const approved = rows.filter((r: any) => (r?.status || r?.state) === "approved").length;

  let sumLeadMs = 0;
  let cntLead = 0;
  for (const r of rows) {
    const cAt = toMillis(r?.createdAt || r?.created_at || r?.created_at_millis);
    const aAt = toMillis(r?.approvedAt || r?.approved_at || r?.approved_at_millis);
    if (aAt && cAt && aAt > cAt) { sumLeadMs += aAt - cAt; cntLead++; }
  }
  const avgLeadHrs = cntLead ? sumLeadMs / cntLead / 36e5 : 0;

  const pass = rows.filter((r: any) => {
    const comp = r?.compliance || r?.safety || r?.checklist;
    if (!comp) return false;
    if (typeof comp === "boolean") return comp;
    if (typeof comp?.passed === "boolean") return comp.passed;
    if (typeof comp?.score === "number") return comp.score >= 0.8;
    return false;
  }).length;

  return {
    totalPermits: total,
    approvalRate: total ? (approved * 100) / total : 0,
    avgLeadTimeHrs: avgLeadHrs,
    complianceScore: total ? (pass * 100) / total : 0,
  };
}

export async function fetchTrends(range: RangePreset): Promise<TrendPoint[]> {
  const { from, to } = rangeToFromTo(range);
  const list = await callListRequests({ from, to }, USE_PROXY_FIRST);
  const rows = Array.isArray(list) ? list : [];

  const byDay = new Map<string, { total: number; approved: number }>();
  for (const r of rows) {
    const d = new Date(toMillis(r?.createdAt || r?.created_at || r?.created_at_millis));
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const bucket = byDay.get(key) || { total: 0, approved: 0 };
    bucket.total += 1;
    if ((r?.status || r?.state) === "approved") bucket.approved += 1;
    byDay.set(key, bucket);
  }

  return Array.from(byDay.keys()).sort().map((label) => ({
    label,
    total: byDay.get(label)!.total,
    approved: byDay.get(label)!.approved,
  }));
}
