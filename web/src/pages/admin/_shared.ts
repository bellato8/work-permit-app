// ============================================================
// File: web/src/pages/admin/_shared.ts
// ... existing code ...
// ============================================================

export type PermitRow = {
// ... existing code ...
};

export const squash = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();
// ... existing code ...
export const statusTH = (s?: string) => {
// ... existing code ...
};

// ---------- อ่านค่าตั้งค่าจาก env/localStorage ----------
export function getApproverKey(): string {
// ... existing code ...
}

export function getProxyListRequestsUrl(): string {
// ... existing code ...
}

// ใช้เฉพาะ legacy/เผื่อจำเป็น
export function getListUrl(): string {
// ... existing code ...
}

export function getDetailsUrl(): string {
// ... existing code ...
}

// ---------- แปลงข้อมูลดิบให้เป็นแถว ----------
export function toRow(x: any): PermitRow | null {
// ... existing code ...
}

function extractItemsLike(data: any): any[] {
// ... existing code ...
}

// ---------- ดึง “รายการคำขอ” ----------
export async function fetchRequests(opts?: {
  status?: "all" | "pending" | "approved" | "rejected";
  limit?: number;
  signal?: AbortSignal;
}): Promise<PermitRow[]> {
  const proxyUrl  = getProxyListRequestsUrl();
  const directUrl = getListUrl();
  const limit = String(opts?.limit ?? 300);
  const status = opts?.status ?? "all";

  const useUrl = proxyUrl || directUrl;
  if (!useUrl) return [];

  const isDev = !!(import.meta as any)?.env?.DEV;
  const key = getApproverKey(); // <<< [แก้ไข] ดึง key มาเตรียมไว้ก่อน

  try {
    if (proxyUrl) {
      if (isDev) console.info("[admin/_shared] Using PROXY url:", proxyUrl);

      // <<< [แก้ไข] สร้าง URL สำหรับ GET พร้อมกุญแจ
      const getUrl = new URL(proxyUrl);
      if (key) {
        getUrl.searchParams.set("key", key);
      }

      // 1) GET ตรง (พร้อมกุญแจ)
      try {
        const res = await fetch(getUrl.toString(), { method: "GET", signal: opts?.signal });
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

      // 2) ถ้า GET ว่าง → POST หนึ่งครั้ง (พร้อมกุญแจ)
      const postBody = {
        status,
        sort: "latest",
        page: 1,
        pageSize: Number(limit),
        key: key || undefined, // <<< [แก้ไข] เพิ่ม key เข้าไปใน body
      };

      const resPost = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody), // <<< [แก้ไข] ใช้ body ที่มี key
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
    // const key = getApproverKey(); // (ย้ายไปข้างบนแล้ว)
    if (!directUrl || !key) return [];

    const u = new URL(directUrl);
// ... existing code ...
    u.searchParams.set("limit", limit);
// ... existing code ...
    const items = extractItemsLike(json);

    const rows = items.map(toRow).filter(Boolean) as PermitRow[];
// ... existing code ...
    return rows;
  } catch (e: any) {
// ... existing code ...
  }
}

// ---------- ดึงดีเทลรายใบ (ไว้เติมชื่อ/ประเภทงาน/เวลา) ----------
export async function fetchDetailFor(rid: string, signal?: AbortSignal) {
// ... existing code ...
}

export async function hydrateRowsWithDetails(base: PermitRow[], opts?: {
// ... existing code ...
}): Promise<PermitRow[]> {
// ... existing code ...
}

// ---------- Export CSV ----------
export function exportCsv(filename: string, rows: PermitRow[]) {
// ... existing code ...
}
