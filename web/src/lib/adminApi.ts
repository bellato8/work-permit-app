// ============================================================
// ไฟล์: web/src/lib/adminApi.ts (แก้ไข Status Mapping)
// ผู้เขียน (Written by): AI Helper
// เวลา/เวอร์ชัน: 2025-09-08 แก้ไข Status Mapping ภาษาไทย
// การแก้ไข: เพิ่ม Thai-English status mapping เพื่อแก้ปัญหา Dashboard stats
// ============================================================

// -----------------------------
// คำอธิบายศัพท์ (Glossary สั้น ๆ)
// - CORS (คอร์ส): นโยบายเบราว์เซอร์เกี่ยวกับการเรียกข้ามโดเมน ถ้าติด CORS อาจต้องใช้ Proxy (พร็อกซี่)
// - Proxy (พร็อกซี่): เซิร์ฟเวอร์ตัวกลาง ช่วยเรียก API แทนเรา เพื่อลดปัญหา CORS/ซ่อนโดเมนจริง
// - .env (ดอท-เอ็นวี): ไฟล์เก็บค่าตั้งค่า เช่น URL/KEY ซึ่งเปลี่ยนตามสภาพแวดล้อม dev/prod
// - Status Mapping: การแปลงสถานะจากภาษาหนึ่งไปอีกภาษาหนึ่ง (ไทย → อังกฤษ)
// -----------------------------

// -----------------------------
// ประเภทข้อมูล (Types) — ยืดหยุ่นเพื่อรองรับฟิลด์ไม่สม่ำเสมอ
// -----------------------------
export type AnyRecord = Record<string, any>;

export interface RequestSummary {
  rid: string; // รหัสคำขอ เช่น R20250831-0001
  createdAt?: number; // epoch ms (จะ convert เองตาม UI)
  updatedAt?: number;
  jobType?: string;
  requesterName?: string;
  status?: string; // pending/approved/rejected/... (ขึ้นกับระบบจริง)
  raw: AnyRecord; // เก็บของเดิมทั้งหมด เพื่ออ้างอิง
}

export interface RequestDetails extends RequestSummary {
  requesterPhone?: string;
  requesterEmail?: string;
  department?: string;
  attachments?: AnyRecord[];
  location?: string;
  startTime?: number;
  endTime?: number;
  // เพิ่มได้ตามต้องการ
}

export interface PagedResult<T> {
  items: T[];
  page: number; // เริ่มจาก 1
  pageSize: number;
  total: number; // ถ้าไม่รู้ ให้เป็น items.length (client-side)
}

// -----------------------------
// Status Mapping: ภาษาไทย → อังกฤษ
// -----------------------------
const THAI_TO_ENGLISH_STATUS: Record<string, string> = {
  // สถานะภาษาไทยที่พบใน Firestore
  "รออนุมัติ": "pending",
  "รอการอนุมัติ": "pending", 
  "ร้องขอ": "pending",
  "ยื่นคำขอ": "pending",
  "อนุมัติแล้ว": "approved",
  "อนุมัติ": "approved",
  "ผ่านการอนุมัติ": "approved",
  "อนุญาต": "approved",
  "ปฏิเสธ": "rejected",
  "ไม่อนุมัติ": "rejected",
  "ไม่อนุญาต": "rejected",
  "ยกเลิก": "rejected",
  "ส่งคืน": "returned",
  "แก้ไข": "returned",
  "ต้องแก้ไข": "returned",
  // เพิ่มสถานะภาษาอังกฤษเผื่อมีผสม
  "pending": "pending",
  "approved": "approved", 
  "rejected": "rejected",
  "returned": "returned"
};

// ฟังก์ชันแปลงสถานะ
function normalizeStatus(rawStatus: any): string {
  if (!rawStatus) return "pending"; // default fallback
  
  const statusStr = String(rawStatus).trim();
  const normalized = THAI_TO_ENGLISH_STATUS[statusStr];
  
  // เพิ่ม logging เพื่อ debug
  if (normalized !== statusStr) {
    console.log(`🔄 Status mapping: "${statusStr}" → "${normalized || statusStr}"`);
  }
  
  return normalized || statusStr || "pending";
}

// -----------------------------
// ยูทิลอ่านค่า ENV/LocalStorage
// -----------------------------
const env = (k: string): string | undefined => {
  // Vite จะฝังค่า import.meta.env.VITE_* ที่ build time
  // ถ้าไม่มี ให้ลองอ่านจาก localStorage (key เดียวกันแต่ตัวพิมพ์เล็ก)
  const v = (import.meta as any).env?.[k] ?? undefined;
  if (v !== undefined && v !== "") return String(v);
  try {
    const ls = localStorage.getItem(k.toLowerCase());
    if (ls) return ls;
  } catch (_) {}
  return undefined;
};

const getAdminKey = (): string | undefined =>
  localStorage.getItem("approver_key") || env("VITE_APPROVER_KEY");

const getRequesterEmail = (): string | undefined =>
  localStorage.getItem("admin_requester_email") || env("VITE_APPROVER_EMAIL");

const getListUrl = (): string | undefined =>
  localStorage.getItem("list_url") || env("VITE_LIST_REQUESTS_ADMIN_URL") || env("VITE_LIST_REQUESTS_URL");

const getDetailsUrl = (): string | undefined =>
  localStorage.getItem("details_url") || env("VITE_GET_REQUEST_ADMIN_URL");

const getProxyListUrl = (): string | undefined => env("VITE_PROXY_LISTREQUESTS_URL");

// -----------------------------
// สร้าง headers มาตรฐาน
// -----------------------------
export const buildAdminHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const key = getAdminKey();
  if (key) (headers as any)["x-api-key"] = key;
  const email = getRequesterEmail();
  if (email) (headers as any)["x-requester-email"] = email;
  return headers;
};

// -----------------------------
// ตัวช่วย fetch JSON พร้อม error handling
// -----------------------------
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  // แปลความหมายสถานะที่พบบ่อย
  if (!res.ok) {
    let info: any = null;
    try { info = await res.json(); } catch { /* ignore */ }
    const message = info?.error || info?.message || res.statusText;
    if (res.status === 401) throw new Error(`401 Unauthorized: ตรวจคีย์ x-api-key หรือสิทธิ์ผู้ใช้ — ${message}`);
    if (res.status === 403) throw new Error(`403 Forbidden: ยังไม่มีสิทธิ์เข้าถึงทรัพยากรนี้ — ${message}`);
    if (res.status === 404) throw new Error(`404 Not Found: ตรวจ URL/เส้นทาง API — ${message}`);
    throw new Error(`${res.status} ${res.statusText}: ${message}`);
  }
  return res.json() as Promise<T>;
}

// -----------------------------
// แปลงผลลัพธ์ให้ได้ items[] แบบยืดหยุ่น
// -----------------------------
function extractItems(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  // กรณี payload.data เป็น array
  if (Array.isArray(payload?.data)) return payload.data;
  // บาง API อาจส่ง {data: {list: [...]}}
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  // ถ้าไม่เข้าเคสใดเลย ลองเดาว่ามี field เดียวเป็น array
  for (const k of Object.keys(payload)) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

// -----------------------------
// ปรับรูปแบบข้อมูลหนึ่งรายการให้เป็น Summary ที่ UI ใช้งานง่าย (normalize)
// แก้ไข: เพิ่ม status mapping
// -----------------------------
export function normalizeSummary(raw: AnyRecord): RequestSummary {
  // เดารหัส RID จากหลายคีย์ที่พบบ่อย
  const rid = String(
    raw.rid || raw.RID || raw.id || raw.requestId || raw.request_id || raw._id || ""
  );

  const createdAt = toEpoch(raw.createdAt || raw.created_at || raw.created || raw.timestamp || raw.createdTime);
  const updatedAt = toEpoch(raw.updatedAt || raw.updated_at || raw.updated || raw.updateTime);

  // ผู้ยื่น (requester)
  const requesterName =
    raw.requester?.fullname || raw.requester?.name || raw.requesterName || raw.requester_fullname || raw.name ||
    [raw.firstName, raw.lastName].filter(Boolean).join(" ") ||
    undefined;

  // ประเภทงาน
  const jobType = raw.jobType || raw.type || raw.workType || raw.category || undefined;

  // ✅ แก้ไขหลัก: ใช้ normalizeStatus เพื่อ map ภาษาไทย → อังกฤษ
  const rawStatus = raw.status || raw.approvalStatus || raw.state || "pending";
  const status = normalizeStatus(rawStatus);

  return {
    rid,
    createdAt,
    updatedAt,
    requesterName,
    jobType,
    status, // ✅ ตอนนี้จะเป็น pending/approved/rejected แล้ว
    raw,
  };
}

function toEpoch(v: any): number | undefined {
  if (!v) return undefined;
  if (typeof v === "number") return v < 2_000_000_000 ? v * 1000 : v; // วินาที→มิลลิวินาที
  if (typeof v === "string") {
    // ลอง parse ISO/วันที่ทั่วไป
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
    // ลอง parse ตัวเลขใน string
    const n = Number(v);
    if (!Number.isNaN(n)) return n < 2_000_000_000 ? n * 1000 : n;
  }
  if (v?._seconds) return v._seconds * 1000; // Firestore Timestamp
  return undefined;
}

// -----------------------------
// เพจจิ้งฝั่ง client (fallback)
// -----------------------------
function paginateClient<T>(items: T[], page: number, pageSize: number): PagedResult<T> {
  const total = items.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return { items: items.slice(start, end), page, pageSize, total };
}

// -----------------------------
// listRequestsAdmin: พยายามใช้เพจจิ้งฝั่ง server ถ้ารองรับ มิฉะนั้นดึงทั้งหมดแล้วตัดหน้าเอง
// พารามิเตอร์รองรับ filter/sort พื้นฐานแบบยืดหยุ่น
// -----------------------------
export interface ListParams {
  page?: number; // เริ่ม 1
  pageSize?: number; // จำนวนต่อหน้า
  status?: string; // ตัวอย่าง: "pending" | "approved" | "rejected"
  q?: string; // คำค้นหา
  sort?: string; // รูปแบบขึ้นกับ backend เช่น "-createdAt"/"createdAt desc"
  useProxy?: boolean; // ให้ลองเรียกผ่าน proxy (กรณีติด CORS)
  signal?: AbortSignal;
}

export async function listRequestsAdmin(params: ListParams = {}): Promise<PagedResult<RequestSummary>> {
  const {
    page = 1,
    pageSize = 20,
    status,
    q,
    sort,
    useProxy = false,
    signal,
  } = params;

  const baseUrl = (useProxy ? getProxyListUrl() : undefined) || getListUrl();
  if (!baseUrl) throw new Error("ไม่พบ URL สำหรับ listRequestsAdmin — โปรดตั้งค่า VITE_LIST_REQUESTS_ADMIN_URL หรือ VITE_LIST_REQUESTS_URL");

  // สร้าง query string แบบยืดหยุ่น รองรับชื่อพารามิเตอร์ที่พบบ่อย
  const url = new URL(baseUrl);

  // ลองรูปแบบยอดนิยมสำหรับเพจจิ้งของ backend ทั่วไป
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  // สำรองบางระบบใช้ limit/offset
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("offset", String((page - 1) * pageSize));

  if (status) url.searchParams.set("status", status);
  if (q) url.searchParams.set("q", q);
  if (sort) url.searchParams.set("sort", sort);

  console.log(`📞 Calling API: ${url.toString()}`);

  const payload = await fetchJson<any>(url.toString(), {
    method: "GET",
    headers: buildAdminHeaders(),
    signal,
  }).catch(async (err) => {
    console.log(`❌ GET failed, trying POST fallback: ${err.message}`);
    // ถ้าติด CORS หรือ GET ใช้ไม่ได้ ลอง POST เป็น fallback
    const postBody: AnyRecord = { page, pageSize, status, q, sort };
    const postUrl = baseUrl; // POST โดยไม่ใส่ query
    return fetchJson<any>(postUrl, {
      method: "POST",
      headers: buildAdminHeaders(),
      body: JSON.stringify(postBody),
      signal,
    });
  });

  console.log(`📦 API Response:`, payload);

  const itemsRaw = extractItems(payload);
  console.log(`🔍 Extracted ${itemsRaw.length} raw items`);

  // ✅ แก้ไขหลัก: ใช้ normalizeSummary ที่มี status mapping แล้ว
  const items = itemsRaw.map(normalizeSummary);
  
  // แสดง status หลัง mapping เพื่อ debug
  console.log(`📊 Processed items:`, items.map(item => `${item.rid}: ${item.status}`));

  // ถ้า backend ให้ meta มา ใช้ตามนั้น
  const metaTotal = payload?.total ?? payload?.data?.total ?? payload?.count ?? undefined;
  const metaPage = payload?.page ?? payload?.data?.page ?? undefined;
  const metaPageSize = payload?.pageSize ?? payload?.data?.pageSize ?? undefined;

  if (metaTotal && metaPage && metaPageSize) {
    return {
      items,
      page: Number(metaPage) || page,
      pageSize: Number(metaPageSize) || pageSize,
      total: Number(metaTotal),
    };
  }

  // ไม่เจอ meta → ใช้ client-side เพจจิ้ง
  return paginateClient(items, page, pageSize);
}

// -----------------------------
// ดึงรายละเอียด 1 ใบคำขอ (รองรับ GET และ POST)
// -----------------------------
export async function getRequestAdmin(rid: string, signal?: AbortSignal): Promise<RequestDetails> {
  const baseUrl = getDetailsUrl();
  if (!baseUrl) throw new Error("ไม่พบ URL สำหรับ getRequestAdmin — โปรดตั้งค่า VITE_GET_REQUEST_ADMIN_URL");

  // ลอง GET ก่อน
  const getUrl = new URL(baseUrl);
  getUrl.searchParams.set("rid", rid);

  try {
    const data = await fetchJson<any>(getUrl.toString(), {
      method: "GET",
      headers: buildAdminHeaders(),
      signal,
    });
    return toDetails(data, rid);
  } catch (e) {
    // ลอง POST fallback (บางระบบกำหนดให้ POST เท่านั้น)
    const data = await fetchJson<any>(baseUrl, {
      method: "POST",
      headers: buildAdminHeaders(),
      body: JSON.stringify({ rid }),
      signal,
    });
    return toDetails(data, rid);
  }
}

function toDetails(payload: any, rid: string): RequestDetails {
  const raw = (payload?.data ?? payload) as AnyRecord;
  // บาง backend ส่ง {ok:true,data:{...}} หรือ {rid:..., ...}
  const merged: AnyRecord = { rid, ...raw };
  const summary = normalizeSummary(merged);

  // map ฟิลด์เพิ่มเติมที่มักอยู่ในรายละเอียดเท่านั้น
  const requesterPhone = raw.requester?.phone || raw.requesterPhone || raw.phone || undefined;
  const requesterEmail = raw.requester?.email || raw.requesterEmail || raw.email || undefined;
  const department = raw.department || raw.org || raw.vendor || undefined;
  const attachments = raw.attachments || raw.files || raw.images || undefined;
  const location = raw.location || raw.area || raw.floor || undefined;
  const startTime = toEpoch(raw.startTime || raw.start || raw.from);
  const endTime = toEpoch(raw.endTime || raw.end || raw.to);

  return {
    ...summary,
    requesterPhone,
    requesterEmail,
    department,
    attachments,
    location,
    startTime,
    endTime,
  };
}

// -----------------------------
// Hydrate รายการให้ครบรายละเอียด (จำกัดความพร้อมกันเพื่อไม่กด API หนักเกิน)
// -----------------------------
export interface HydrateOptions {
  concurrency?: number; // จำนวนคำขอพร้อมกัน (แนะนำ 5)
  signal?: AbortSignal;
}

export async function hydrateRequests(
  summaries: RequestSummary[],
  opts: HydrateOptions = {}
): Promise<RequestDetails[]> {
  const { concurrency = 5, signal } = opts;
  const queue = [...summaries];
  const results: RequestDetails[] = [];

  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      if (signal?.aborted) throw new Error("Hydrate ถูกยกเลิก (aborted)");
      try {
        // ถ้ามี rid ค่อยเรียกละเอียด ถ้าไม่มี ให้ข้ามแต่เก็บเป็น summary → details
        if (item.rid) {
          const d = await getRequestAdmin(item.rid, signal);
          results.push(d);
        } else {
          results.push({ ...item } as RequestDetails);
        }
      } catch (e: any) {
        // เก็บแบบ summary พร้อม error ใน raw เพื่อ debug ต่อ
        results.push({ ...item, raw: { ...item.raw, hydrateError: String(e?.message || e) } } as RequestDetails);
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

// -----------------------------
// ตัวอย่างการใช้งาน (คำอธิบายในคอมเมนต์):
// -----------------------------
// import { listRequestsAdmin, hydrateRequests } from "../lib/adminApi";
//
// async function loadPage() {
//   // 1) ดึงรายการหน้าแรก 20 รายการ
//   const page1 = await listRequestsAdmin({ page: 1, pageSize: 20, status: "pending" });
//   // page1.items คือ RequestSummary[] โดยที่ status จะเป็น "pending", "approved", "rejected" แล้ว
//
//   // 2) เติมรายละเอียดให้ 10 รายการแรก (hydrate with concurrency=5)
//   const details = await hydrateRequests(page1.items.slice(0, 10), { concurrency: 5 });
//
//   // 3) นำไปแสดงผลในตาราง/การ์ด ตามต้องการ
// }
// ============================================================