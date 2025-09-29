// web/src/utils/permits.ts
const LIST_URL = import.meta.env.VITE_LIST_PERMITS_ADMIN_URL as string;
const APPROVER_KEY = (localStorage.getItem("approver_key") || import.meta.env.VITE_APPROVER_KEY || "").trim();

export type PermitRow = {
  rid: string;
  requesterName?: string;
  company?: string;
  jobType?: string;
  area?: string;
  floor?: string;
  createdAt?: number | string;
  status?: string;   // pending/approved/rejected/...
};

export type ListQuery = {
  q?: string;
  status?: string;
  company?: string;
  from?: string;  // ISO (YYYY-MM-DD)
  to?: string;    // ISO
  pageSize?: number;
  cursor?: string;
  sort?: "createdAt_desc" | "createdAt_asc";
};

// POST ก่อน แล้วค่อย fallback GET (ตามสไตล์ที่ทำไว้)
export async function fetchPermits(params: ListQuery = {}) {
  if (!LIST_URL || !APPROVER_KEY) throw new Error("LIST URL หรือ approver_key ว่าง");

  const payload = { key: APPROVER_KEY, ...params };

  // ทางหลัก: POST JSON
  try {
    const r = await fetch(LIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
    return j; // {ok:true, data:{items:PermitRow[], total:number, nextCursor?:string, counters?:{...}}}
  } catch (e) {
    // Fallback: GET query string
    const qs = new URLSearchParams({ key: APPROVER_KEY });
    Object.entries(params).forEach(([k, v]) => v != null && v !== "" && qs.append(k, String(v)));
    const url = `${LIST_URL.replace(/\/+$/, "")}?${qs.toString()}`;
    const r2 = await fetch(url, { headers: { Accept: "application/json" } });
    const j2 = await r2.json().catch(() => ({}));
    if (!r2.ok || !j2?.ok) throw new Error(j2?.error || `HTTP ${r2.status}`);
    return j2;
  }
}
