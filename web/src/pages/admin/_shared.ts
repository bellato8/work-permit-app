// ============================================================
// File: web/src/pages/admin/_shared.ts
// หน้าที่: ตัวช่วยหน้าแอดมิน (ดึงลิสต์, จัดรูป, เติมดีเทล, ส่งออก CSV)
// เวอร์ชัน: 2025-09-07
// Updated: 2025-10-26
// ผู้แก้ไข: เพื่อนคู่คิด
// รายการปรับปรุง 2025-10-26:
//   - รองรับคำไทยของสถานะจากโมดูลใหม่ (Internal/LP) ใน normalizeStatus()
//   - ให้ statusTH() อ้างอิง normalizeStatus() เสมอ เพื่อลดความคลาดเคลื่อน
//   - ลดข้อความใน Console ระหว่างใช้งานจริง (โชว์เฉพาะโหมดพัฒนา)
// หมายเหตุ:
//   - ไม่ลบฟังก์ชันเดิม เพื่อไม่กระทบหน้าจอเก่า
//   - เป้าหมายคือให้ /admin อ่านสถานะคำไทยใหม่ได้ โดยไม่แตะ Module 3
// ============================================================

export type PermitRow = {
  rid: string;
  requesterName?: string;
  requesterEmail?: string;
  company?: string;
  jobType?: string;
  floor?: string;
  area?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
  status?: string;
};

export const squash = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();

/** แปลง timestamp หลายรูปแบบ → millis */
export function tsToMillis(v: any): number | undefined {
  if (!v && v !== 0) return undefined;
  if (typeof v === "number") return v < 2_000_000_000_000 ? v * 1000 : v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? undefined : t;
  }
  if (typeof v === "object") {
    if (typeof v._seconds === "number") return v._seconds * 1000 + Math.round((v._nanoseconds || 0) / 1e6);
    if (typeof v.seconds === "number") return v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6);
    if (typeof v.toDate === "function") return v.toDate().getTime();
  }
  return undefined;
}

/** วันที่อ่านง่าย */
export function fmtDate(v?: number | string) {
  const ms = tsToMillis(v);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("th-TH", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/** ทำให้สถานะเป็นชุดเดียวเสมอ
 *  - รวมคำภาษาไทยของโมดูลใหม่:
 *    "LP รับทราบ (รอผู้รับเหมา)" → pending
 *    "รอ LP ตรวจสอบ"            → pending
 *    "อนุมัติเข้าทำงาน"         → approved
 *    "ไม่อนุมัติ"                → rejected
 *  - คำอื่น ๆ ที่สื่อความ “รอ/อนุมัติ/ปฏิเสธ/ยกเลิก” ก็จะถูกจัดกลุ่มให้ตรง
 */
export function normalizeStatus(raw?: string): "pending" | "approved" | "rejected" {
  const v = squash(raw).toLowerCase();

  // กลุ่ม "รอ…" (pending)
  if (
    /(pending|รอ)/.test(v) ||
    v.includes("lp รับทราบ") ||
    v.includes("รอ lp ตรวจสอบ")
  ) {
    return "pending";
  }

  // กลุ่ม "ปฏิเสธ/ไม่อนุมัติ/ยกเลิก" (rejected)
  if (/(reject|ปฏิเสธ|ไม่อนุมัติ|cancel|ยกเลิก)/.test(v)) {
    return "rejected";
  }

  // กลุ่ม "อนุมัติ" (approved)
  if (/(approve|อนุมัติ|อนุมัติเข้าทำงาน)/.test(v)) {
    return "approved";
  }

  return "pending";
}

/** ป้ายสถานะภาษาไทยแบบเดียวกันเสมอ (ยึดผลจาก normalizeStatus) */
export const statusTH = (s?: string) => {
  const n = normalizeStatus(s);
  if (n === "approved") return "อนุมัติแล้ว";
  if (n === "rejected") return "ถูกปฏิเสธ";
  return "รออนุมัติ";
};

// ---------- อ่านค่าตั้งค่าจาก env/localStorage ----------
export function getApproverKey(): string {
  const fromLS = (localStorage.getItem("approver_key") || "").trim();
  const fromEnv = (import.meta.env.VITE_APPROVER_KEY as string | undefined) || "";
  return fromLS || fromEnv.trim();
}

export function getProxyListRequestsUrl(): string {
  const fromLS  = (localStorage.getItem("proxy_list_requests_url") || "").trim();
  const envNew  = (import.meta.env as any).VITE_PROXY_LIST_REQUESTS_URL as string | undefined;
  const envOld  = (import.meta.env as any).VITE_PROXY_LISTREQUESTS_URL as string | undefined;
  return fromLS || (envNew || "").trim() || (envOld || "").trim();
}

// ใช้เฉพาะ legacy/เผื่อจำเป็น
export function getListUrl(): string {
  const fromLS = (localStorage.getItem("list_url") || "").trim();
  const envA = (import.meta.env.VITE_LIST_REQUESTS_ADMIN_URL as string | undefined) || "";
  const envB = (import.meta.env.VITE_LIST_REQUESTS_URL as string | undefined) || "";
  return fromLS || envA.trim() || envB.trim();
}

export function getDetailsUrl(): string {
  const fromLS = (localStorage.getItem("details_url") || "").trim();
  const env = (import.meta.env.VITE_GET_REQUEST_ADMIN_URL as string | undefined) || "";
  if (fromLS) return fromLS;
  if (env) return env.trim();
  const lu = getListUrl();
  try { if (lu.includes("listRequests")) return lu.replace("listRequests", "getRequestAdmin"); } catch {}
  return "";
}

// ---------- แปลงข้อมูลดิบให้เป็นแถว ----------
export function toRow(x: any): PermitRow | null {
  const rid = squash(x?.rid || x?.requester?.rid || x?.docId || x?.id || "");
  if (!rid) return null;

  const requesterName = squash(
    x?.requester?.fullname || x?.requester?.name || x?.employee || x?.contractorName || "-"
  );
  const requesterEmail = squash(x?.requester?.email || x?.email || "");
  const company = squash(x?.requester?.company || x?.company || "-");
  const jobType = squash(x?.work?.type || x?.work?.location?.type || x?.jobType || x?.type || "-");
  const floor = squash(x?.work?.floor || x?.location?.floor || x?.floor || "");
  const area  = squash(x?.work?.area  || x?.location?.area  || x?.area  || "");

  const createdAt =
    tsToMillis(x?.createdAt) ?? tsToMillis(x?.created_at) ?? tsToMillis(x?.created) ?? undefined;
  const updatedAt =
    tsToMillis(x?.updatedAt) ?? tsToMillis(x?.updated_at) ?? tsToMillis(x?.updated) ?? undefined;

  const status = normalizeStatus(x?.status || x?.decision?.status);
  return { rid, requesterName, requesterEmail, company, jobType, floor, area, createdAt, updatedAt, status };
}

function extractItemsLike(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

// ---------- ดึง “รายการคำขอ” ----------
export async function fetchRequests(opts?: {
  status?: "all" | "pending" | "approved" | "rejected";
  limit?: number;
  signal?: AbortSignal;
}): Promise<PermitRow[]> {
  const proxyUrl  = getProxyListRequestsUrl();
  const directUrl = getListUrl();
  const limit = String(opts?.limit ?? 300);
  const status = opts?.status ?? "all";

  const useUrl = proxyUrl || directUrl;
  if (!useUrl) return [];

  const isDev = !!(import.meta as any)?.env?.DEV;

  try {
    if (proxyUrl) {
      if (isDev) console.info("[admin/_shared] Using PROXY url:", proxyUrl);

      // 1) GET ตรง
      try {
        const res = await fetch(proxyUrl, { method: "GET", signal: opts?.signal });
        const text = await res.text();
        let json: any = {};
        try { json = JSON.parse(text); } catch {}
        const items = extractItemsLike(json);
        if (isDev) console.info("[admin/_shared] GET items =", items.length);
        if (items.length) {
          const rows = items.map(toRow).filter(Boolean) as PermitRow[];
          rows.sort((a, b) =>
            (tsToMillis(b.updatedAt) || tsToMillis(b.createdAt) || 0) -
            (tsToMillis(a.updatedAt) || tsToMillis(a.createdAt) || 0)
          );
          return rows;
        }
      } catch {
        if (isDev) console.warn("[admin/_shared] GET failed, will try POST once…");
      }

      // 2) ถ้า GET ว่าง → POST หนึ่งครั้ง
      const resPost = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, sort: "latest", page: 1, pageSize: Number(limit) }),
        signal: opts?.signal,
      });
      const jsonPost = await resPost.json().catch(() => ({}));
      if (!resPost.ok) throw new Error(JSON.stringify(jsonPost || { ok: false, error: `HTTP ${resPost.status}` }));
      const itemsPost = extractItemsLike(jsonPost);
      if (isDev) console.info("[admin/_shared] POST items =", itemsPost.length);

      const rows = itemsPost.map(toRow).filter(Boolean) as PermitRow[];
      rows.sort((a, b) =>
        (tsToMillis(b.updatedAt) || tsToMillis(b.createdAt) || 0) -
        (tsToMillis(a.updatedAt) || tsToMillis(a.createdAt) || 0)
      );
      return rows;
    }

    // ---------- LEGACY (ไม่ผ่านพร็อกซี) ----------
    if (isDev) console.warn("[admin/_shared] Using LEGACY list url (direct).");
    const key = getApproverKey();
    if (!directUrl || !key) return [];

    const u = new URL(directUrl);
    u.searchParams.set("key", key);
    u.searchParams.set("limit", limit);
    if (status !== "all") u.searchParams.set("status", status);

    const res = await fetch(u.toString(), { signal: opts?.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json().catch(() => ({}));
    const items = extractItemsLike(json);

    const rows = items.map(toRow).filter(Boolean) as PermitRow[];
    rows.sort((a, b) =>
      (tsToMillis(b.updatedAt) || tsToMillis(b.createdAt) || 0) -
      (tsToMillis(a.updatedAt) || tsToMillis(a.createdAt) || 0)
    );
    return rows;
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new Error(e?.message || "fetchRequests failed");
  }
}

// ---------- ดึงดีเทลรายใบ (ไว้เติมชื่อ/ประเภทงาน/เวลา) ----------
export async function fetchDetailFor(rid: string, signal?: AbortSignal) {
  const detailsUrl = getDetailsUrl();
  const key = getApproverKey();
  if (!detailsUrl) return null;

  const u = new URL(detailsUrl);
  if (key) u.searchParams.set("key", key);
  u.searchParams.set("rid", rid);

  const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json" }, signal });
  const text = await res.text();
  if (!res.ok) return null;

  let data: any = {};
  try { data = JSON.parse(text); } catch { return null; }

  const r = (data?.data?.request ?? data?.request ?? data) || {};
  const requesterName = squash(
    r?.requester?.fullname || r?.requester?.name || r?.employee || r?.contact?.name || "-"
  );
  const requesterEmail = squash(r?.requester?.email || r?.contact?.email || "");
  const company = squash(r?.requester?.company || r?.company || "-");
  const jobType = squash(r?.work?.type || r?.work?.location?.type || r?.jobType || r?.type || "-");
  const floor = squash(r?.work?.floor || r?.location?.floor || r?.floor || "");
  const area  = squash(r?.work?.area  || r?.location?.area  || r?.area  || "");

  const createdAt = tsToMillis(r?.createdAt) ?? tsToMillis(r?.created_at) ?? undefined;
  const updatedAt = tsToMillis(r?.updatedAt) ?? tsToMillis(r?.updated_at) ?? undefined;

  return { requesterName, requesterEmail, company, jobType, floor, area, createdAt, updatedAt };
}

export async function hydrateRowsWithDetails(base: PermitRow[], opts?: {
  concurrency?: number; signal?: AbortSignal;
}): Promise<PermitRow[]> {
  const need = base.filter(r => !r.requesterName || r.requesterName === "-" || !r.jobType || r.jobType === "-");
  if (need.length === 0) return base;

  const byRid = new Map(base.map(r => [r.rid, { ...r }]));
  const queue = [...need.map(n => n.rid)];
  const cc = Math.max(1, Math.min(opts?.concurrency ?? 5, 10));

  const workers = Array.from({ length: Math.min(cc, queue.length) }, async () => {
    while (queue.length) {
      const rid = queue.shift()!;
      try {
        const extra = await fetchDetailFor(rid, opts?.signal);
        if (extra) {
          const cur = byRid.get(rid)!;
          byRid.set(rid, {
            ...cur,
            requesterName: (cur.requesterName && cur.requesterName !== "-") ? cur.requesterName : extra.requesterName,
            requesterEmail: cur.requesterEmail || extra.requesterEmail,
            company: (cur.company && cur.company !== "-") ? cur.company : extra.company,
            jobType: (cur.jobType && cur.jobType !== "-") ? cur.jobType : extra.jobType,
            floor: cur.floor || extra.floor,
            area:  cur.area  || extra.area,
            createdAt: extra.createdAt ?? cur.createdAt,
            updatedAt: extra.updatedAt ?? cur.updatedAt,
          });
        }
      } catch {}
    }
  });

  await Promise.allSettled(workers);
  return Array.from(byRid.values());
}

// ---------- Export CSV ----------
export function exportCsv(filename: string, rows: PermitRow[]) {
  const header = ["rid","requesterName","requesterEmail","company","jobType","floor","area","status","createdAt","updatedAt"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const line = [
      r.rid, r.requesterName || "", r.requesterEmail || "", r.company || "",
      r.jobType || "", r.floor || "", r.area || "",
      statusTH(r.status), fmtDate(r.createdAt), fmtDate(r.updatedAt),
    ].map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",");
    lines.push(line);
  }
  const csv = lines.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
}
