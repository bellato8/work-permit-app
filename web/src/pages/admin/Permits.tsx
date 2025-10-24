// ======================================================================
// File: web/src/pages/admin/Permits.tsx
// เวอร์ชัน: 2025-09-29 23:59 (Asia/Bangkok)
// หน้าที่: รายการใบอนุญาต (Permits) ฝั่งแอดมิน — ดึง/กรอง/แบ่งหน้า/Hydrate/ส่งออก CSV
// การเปลี่ยนแปลงสำคัญ:
//   • เปลี่ยนมาใช้ "Firebase ID Token" → แนบใน Header: Authorization: Bearer <ID_TOKEN>
//   • แนบอีเมลผู้ใช้ที่ล็อกอินใน header: x-requester-email (ช่วยฝั่งบันทึก Log/ตรวจสอบ)
//   • ตัดการพึ่งพา approver_key ทั้งหมด (แก้ปัญหา Firefox ที่ localStorage ไม่มี key แล้วขึ้นเตือน)
//   • POST ก่อน → ถ้าไม่ผ่าน ตกไป GET (ทั้งคู่แนบ ID Token เหมือนกัน)
// หมายเหตุ:
//   • ต้องมี URL สำหรับ list และ details (ตั้งใน .env หรือ localStorage: list_url, details_url)
//   • ถ้ายังไม่ล็อกอิน จะขึ้นข้อความเตือนให้เข้าสู่ระบบก่อน
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// อะแดปเตอร์สิทธิ์ (เหมือนหน้าอื่น)
import useAuthzLive from "../../hooks/useAuthzLive";
import { hasCap, isSuperadmin } from "../../lib/hasCap";

// Firebase Auth (ใช้ดึง ID Token)
import { getAuth } from "firebase/auth";

// ---------------- ENV / LocalStorage helpers ----------------
const LIST_URL_ENV =
  (import.meta.env.VITE_LIST_REQUESTS_ADMIN_URL as string | undefined) ||
  (import.meta.env.VITE_LIST_REQUESTS_URL as string | undefined) ||
  "";

function getListUrl(): string {
  const fromLS = (localStorage.getItem("list_url") || "").trim();
  return fromLS || (LIST_URL_ENV || "").trim();
}

const DETAILS_URL_ENV =
  (import.meta.env.VITE_GET_REQUEST_ADMIN_URL as string | undefined) || "";

function getDetailsUrl(): string {
  const fromLS = (localStorage.getItem("details_url") || "").trim();
  if (fromLS) return fromLS;
  if (DETAILS_URL_ENV) return DETAILS_URL_ENV.trim();
  const lu = getListUrl();
  try {
    if (lu.includes("listRequests")) return lu.replace("listRequests", "getRequestAdmin");
  } catch {}
  return "";
}

function getRequesterEmail(): string {
  const fromLS = (localStorage.getItem("admin_requester_email") || "").trim();
  const fromEnv = (import.meta.env.VITE_APPROVER_EMAIL as string | undefined) || "";
  return fromLS || fromEnv.trim();
}

// ---------- สร้าง Header ที่แนบ ID Token (และ requester email) ----------
async function withIdTokenHeaders(extra?: HeadersInit) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน (ไม่พบผู้ใช้ปัจจุบัน)");
  const idToken = await user.getIdToken(/* forceRefresh */ false);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`,
  };
  const requester = getRequesterEmail();
  if (requester) headers["x-requester-email"] = requester;
  return { ...headers, ...(extra as Record<string, string>) };
}

// ---------------- Types & utils ----------------
type PermitRow = {
  rid: string;
  requesterName?: string;
  company?: string;
  jobType?: string;
  floor?: string;
  area?: string;
  createdAt?: number | string | any;
  updatedAt?: number | string | any;
  approvedAt?: number | string | any;
  rejectedAt?: number | string | any;
  status?: string;
};

// ✅ แปลง timestamp → ms (เดา unit: sec/ms/µs/ns)
function tsToMillis(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;

  if (typeof v === "number") {
    const abs = Math.abs(v);
    if (abs < 1e11) return v * 1000;            // seconds → ms
    if (abs < 1e13) return v;                   // milliseconds
    if (abs < 1e16) return Math.floor(v / 1e3); // microseconds → ms
    return Math.floor(v / 1e6);                 // nanoseconds → ms
  }

  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
    const n = Number(v);
    if (Number.isFinite(n)) return tsToMillis(n);
    return undefined;
  }

  if (typeof v === "object") {
    if (typeof v._seconds === "number")
      return v._seconds * 1000 + Math.round((v._nanoseconds || 0) / 1e6);
    if (typeof v.seconds === "number")
      return v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6);
    if (typeof v.toDate === "function") return v.toDate().getTime();
  }
  return undefined;
}

// ✅ ฟอร์แมต พ.ศ. + 24h
const dtfTH = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function fmtDate(v?: number | string | any) {
  const ms = tsToMillis(v);
  if (!ms) return "-";
  return dtfTH.format(new Date(ms));
}

const squash = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();

function normalizeOne(x: any): PermitRow | null {
  const rid = squash(x?.rid || x?.requester?.rid || x?.docId || x?.id || "");
  if (!rid) return null;

  const requesterName =
    squash(x?.requester?.fullname || x?.requester?.name || x?.employee || x?.contractorName || "") || undefined;
  const company = squash(x?.requester?.company || x?.company || "");
  const jobType = squash(x?.work?.type || x?.work?.location?.type || x?.jobType || x?.type || "");
  const floor = squash(x?.work?.floor || x?.location?.floor || x?.floor || "");
  const area  = squash(x?.work?.area  || x?.location?.area  || x?.area  || "");

  const createdAt =
    tsToMillis(x?.createdAt) ?? tsToMillis(x?.created_at) ?? tsToMillis(x?.created) ?? undefined;
  const updatedAt = tsToMillis(x?.updatedAt) ?? tsToMillis(x?.updated_at) ?? undefined;
  const approvedAt = tsToMillis(x?.approvedAt) ?? tsToMillis(x?.decision?.decidedAt) ?? undefined;
  const rejectedAt = tsToMillis(x?.rejectedAt) ?? tsToMillis(x?.decision?.decidedAt) ?? undefined;

  const status = squash(x?.status || x?.decision?.status || "pending");

  return { rid, requesterName, company, jobType, floor, area, createdAt, updatedAt, approvedAt, rejectedAt, status };
}

// ✅ ให้ได้สถานะเดียวกับ /admin/approvals
function normalizeStatus(input?: string): "approved" | "rejected" | "pending" {
  const s = String(input || "").toLowerCase();
  if (!s) return "pending";
  if (s === "รออนุมัติ" || s.includes("รออนุมัติ")) return "pending";
  if (s.includes("pending") || s.includes("waiting") || s.includes("submitted") || s.includes("รอ")) return "pending";
  if (s.includes("approve") || s.includes("อนุมัติ") || s === "approved" || s === "accept") return "approved";
  if (s.includes("reject") || s.includes("ปฏิเสธ") || s === "rejected" || s === "deny") return "rejected";
  return "pending";
}

// ---------------- hydrate รายละเอียด (แนบ ID Token) ----------------
async function hydrateDetails(rows: PermitRow[]): Promise<PermitRow[]> {
  const detailsUrl = getDetailsUrl();
  if (!detailsUrl || rows.length === 0) return rows;

  const out = [...rows];
  const limit = 5;
  let cursor = 0;

  async function fetchOne(idx: number) {
    const r = out[idx];
    if (!r?.rid) return;

    try {
      const u = new URL(detailsUrl);
      u.searchParams.set("rid", r.rid);

      const res = await fetch(u.toString(), {
        method: "GET",
        headers: await withIdTokenHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const x = j?.data?.request || j?.data || j?.request || j?.item || j;

      const requesterName =
        x?.requester?.fullname ?? x?.requester?.name ?? x?.employee ?? x?.contractorName ?? r.requesterName;
      const company = x?.requester?.company ?? x?.company ?? r.company;
      const jobType  = x?.work?.type ?? x?.work?.location?.type ?? x?.jobType ?? r.jobType;
      const floor    = x?.work?.floor ?? x?.location?.floor ?? r.floor;
      const area     = x?.work?.area  ?? x?.location?.area  ?? r.area;

      out[idx] = { ...r, requesterName, company, jobType, floor, area };
    } catch {
      // เงียบ ถ้าล้มเหลวใช้ค่าเดิม
    }
  }

  async function worker() {
    while (cursor < out.length) {
      const i = cursor++;
      await fetchOne(i);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

// ---------------- CSV (ใส่ BOM) ----------------
function rowsToCsv(rows: PermitRow[]): string {
  const headers = ["rid","requesterName","company","jobType","floor","area","dateShown","status"];
  const esc = (x: any) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    const t = r.createdAt ?? r.updatedAt ?? r.approvedAt ?? r.rejectedAt;
    lines.push([
      esc(r.rid),
      esc(r.requesterName ?? ""),
      esc(r.company ?? ""),
      esc(r.jobType ?? ""),
      esc(r.floor ?? ""),
      esc(r.area ?? ""),
      esc(fmtDate(t)),
      esc(normalizeStatus(r.status)),
    ].join(","));
  }
  return lines.join("\n");
}
function downloadCsv(filename: string, csv: string) {
  const csvWithBom = "\uFEFF" + csv; // BOM สำหรับ Excel/Windows
  const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- UI helpers ----------
function StatusChip({ value }: { value?: string }) {
  const v = normalizeStatus(value);
  const base =
    "px-2 py-0.5 rounded-full text-white text-xs font-semibold inline-flex items-center justify-center min-w-[64px]";
  if (v === "approved") return <span className={`${base} bg-emerald-600`}>อนุมัติ</span>;
  if (v === "rejected") return <span className={`${base} bg-rose-600`}>ไม่อนุมัติ</span>;
  return <span className={`${base} bg-amber-500`}>รออนุมัติ</span>;
}

// ป้ายตัวนับด้านบน (ให้หน้าตาเหมือน StatusChip)
function CounterPill({ kind, count }: { kind: "pending" | "approved" | "rejected"; count: number }) {
  const base = "px-3 py-1 rounded-full text-white text-sm font-semibold inline-flex items-center gap-2";
  if (kind === "approved") return <span className={`${base} bg-emerald-600`}>อนุมัติแล้ว: {count}</span>;
  if (kind === "rejected") return <span className={`${base} bg-rose-600`}>ถูกปฏิเสธ: {count}</span>;
  return <span className={`${base} bg-amber-500`}>รออนุมัติ: {count}</span>;
}

// ============================================================
// Component
// ============================================================
export default function Permits() {
  const nav = useNavigate();

  const [items, setItems] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // อ่านสิทธิ์สด (เหมือนหน้า Approvals)
  const live = useAuthzLive() ?? {};
  const canView =
    isSuperadmin(live.role) ||
    live.pagePermissions?.permits?.canView === true ||
    hasCap(live.caps, "view_permits", live.role) ||
    hasCap(live.caps, "view_all", live.role) ||
    hasCap(live.caps, "approve_requests", live.role) ||
    hasCap(live.caps, "review_requests", live.role);

  // filters (client-side)
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [from, setFrom] = useState<string>(""); // YYYY-MM-DD
  const [to, setTo] = useState<string>("");
  const [sort, setSort] = useState<"createdAt_desc" | "createdAt_asc">("createdAt_desc");

  // paging (client-side)
  const [page, setPage] = useState(0);
  const pageSize = 20; // ✅ ประกาศครั้งเดียวเท่านั้น

  const counters = useMemo(() => {
    return items.reduce(
      (acc, r) => {
        const v = normalizeStatus(r.status);
        if (v === "approved") acc.approved += 1;
        else if (v === "rejected") acc.rejected += 1;
        else acc.pending += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 }
    );
  }, [items]);

  async function loadList(signal?: AbortSignal) {
    try {
      setLoading(true);
      setErr(null);

      // ไม่มีสิทธิ์ → ไม่ยิง API และเคลียร์รายการ
      if (!canView) {
        setItems([]);
        return;
      }

      const url = getListUrl();
      if (!url) {
        setErr("LIST URL ว่าง — กรุณาตั้งค่าใน .env หรือ localStorage('list_url')");
        setItems([]);
        return;
      }

      const requester = getRequesterEmail();
      const u = new URL(url);
      u.searchParams.set("limit", "300");

      let json: any | undefined;

      // 1) POST ก่อน (พร้อม headers: ID Token)
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: await withIdTokenHeaders(),
          body: JSON.stringify({
            requester,
            status: "all",
            sort: "latest",
            page: 1,
            pageSize: 300,
          }),
          signal,
        });
        if (res.ok) {
          json = await res.json();
        } else {
          // 2) ตกไป GET (ยังแนบ ID Token)
          const res2 = await fetch(u.toString(), {
            method: "GET",
            headers: await withIdTokenHeaders(),
            signal,
          });
          if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
          json = await res2.json();
        }
      } catch {
        // 3) POST ล้มเหลว → GET (ยังแนบ ID Token)
        const res2 = await fetch(u.toString(), {
          method: "GET",
          headers: await withIdTokenHeaders(),
          signal,
        });
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        json = await res2.json();
      }

      const rawItems: any[] =
        Array.isArray(json) ? json :
        Array.isArray(json?.data) ? json.data :
        Array.isArray(json?.items) ? json.items :
        Array.isArray(json?.data?.items) ? json.data.items :
        Array.isArray(json?.results) ? json.results : [];

      let mapped = rawItems.map(normalizeOne).filter(Boolean) as PermitRow[];

      // เรียง: อัปเดตล่าสุดก่อน
      mapped.sort((a, b) => {
        const ta = tsToMillis(a.updatedAt) ?? tsToMillis(a.approvedAt) ?? tsToMillis(a.rejectedAt) ?? tsToMillis(a.createdAt) ?? 0;
        const tb = tsToMillis(b.updatedAt) ?? tsToMillis(b.approvedAt) ?? tsToMillis(b.rejectedAt) ?? tsToMillis(b.createdAt) ?? 0;
        return tb - ta;
      });

      setItems(mapped); // แสดงเบื้องต้นก่อน

      // เติมรายละเอียด (รวม requesterName)
      mapped = await hydrateDetails(mapped);
      setItems(mapped);
      setPage(0);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(e?.message || "โหลดข้อมูลล้มเหลว");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    loadList(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  // กรอง/เรียง/แบ่งหน้า บน client
  const filteredSorted = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    const fromMs = from ? Date.parse(from) : undefined;
    const toMs = to ? Date.parse(to) + 24 * 60 * 60 * 1000 - 1 : undefined; // รวมทั้งวัน

    let rows = items.filter((r) => {
      const okQ =
        !qLower ||
        r.rid.toLowerCase().includes(qLower) ||
        (r.requesterName || "").toLowerCase().includes(qLower) ||
        (r.company || "").toLowerCase().includes(qLower) ||
        (r.jobType || "").toLowerCase().includes(qLower) ||
        (r.floor || "").toLowerCase().includes(qLower) ||
        (r.area || "").toLowerCase().includes(qLower);

      const norm = normalizeStatus(r.status);
      const okStatus =
        !status ||
        (status === "pending" && norm === "pending") ||
        (status === "approved" && norm === "approved") ||
        (status === "rejected" && norm === "rejected");

      const okCompany = !company || (r.company || "").toLowerCase().includes(company.toLowerCase());

      // ใช้ createdAt เป็นเกณฑ์ “วันที่ยื่น”
      const ms = tsToMillis(r.createdAt) || 0;
      const okFrom = fromMs === undefined || ms >= fromMs;
      const okTo = toMs === undefined || ms <= toMs;

      return okQ && okStatus && okCompany && okFrom && okTo;
    });

    rows.sort((a, b) => {
      const da = tsToMillis(a.createdAt) || 0;
      const db = tsToMillis(b.createdAt) || 0;
      return sort === "createdAt_desc" ? db - da : da - db;
    });

    return rows;
  }, [items, q, status, company, from, to, sort]);

  const total = filteredSorted.length;
  const pageRows = filteredSorted.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => setPage(0), [q, status, company, from, to, sort]);

  // -------- UI --------
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-4 flex flex-wrap gap-2 items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">รายการใบอนุญาต</h1>
        {/* ตัวนับแบบเดียวกับชิปสถานะในตาราง */}
        <div className="flex gap-2 text-sm">
          <CounterPill kind="pending"  count={counters.pending}  />
          <CounterPill kind="approved" count={counters.approved} />
          <CounterPill kind="rejected" count={counters.rejected} />
        </div>
      </div>

      {!canView && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3">
          คุณไม่มีสิทธิ์ดูรายการใบอนุญาต (ต้องมีสิทธิ์อย่างน้อยหนึ่งใน: <code>view_permits</code>, <code>view_all</code>, <code>approve_requests</code>, <code>review_requests</code>)
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 mb-3 grid md:grid-cols-6 gap-2 text-sm">
        <input className="md:col-span-2 border rounded-lg px-3 py-2" placeholder="ค้นหา: RID/ชื่อ/บริษัท/ชั้น/ประเภทงาน" value={q} onChange={(e)=>setQ(e.target.value)} />
        <select className="border rounded-lg px-3 py-2" value={status} onChange={(e)=>setStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">รออนุมัติ</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="rejected">ถูกปฏิเสธ</option>
        </select>
        <input className="border rounded-lg px-3 py-2" placeholder="บริษัท" value={company} onChange={(e)=>setCompany(e.target.value)} />
        <input type="date" className="border rounded-lg px-3 py-2" value={from} onChange={(e)=>setFrom(e.target.value)} />
        <input type="date" className="border rounded-lg px-3 py-2" value={to} onChange={(e)=>setTo(e.target.value)} />
        <div className="flex gap-2">
          <select className="border rounded-lg px-3 py-2 flex-1" value={sort} onChange={(e)=>setSort(e.target.value as any)}>
            <option value="createdAt_desc">ล่าสุดก่อน</option>
            <option value="createdAt_asc">เก่าสุดก่อน</option>
          </select>
          <button onClick={()=>loadList()} className="border rounded-lg px-3 py-2 hover:bg-gray-50" disabled={loading}>รีเฟรช</button>
          <button
            onClick={()=>{
              const csv = rowsToCsv(pageRows);
              const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
              downloadCsv(`permits_page${page+1}_${stamp}.csv`, csv);
            }}
            className="border rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            ส่งออก CSV
          </button>
        </div>
      </div>

      {err && <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-700 p-3">{err}</div>}
      {loading && <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">กำลังโหลดข้อมูล…</div>}

      {/* Table */}
      <div className="overflow-auto rounded-2xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-50">
            <tr className="[&>th]:px-3 [&>th]:py-2 text-left">
              <th>RID</th><th>ผู้ขอ</th><th>บริษัท</th><th>ประเภทงาน</th><th>ชั้น/พื้นที่</th><th>วันที่ยื่น</th><th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r)=> {
              const dateToShow = r.createdAt ?? r.updatedAt ?? r.approvedAt ?? r.rejectedAt;
              return (
                <tr
                  key={r.rid}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => nav(`/admin/permits/${encodeURIComponent(r.rid)}`)}
                >
                  <td className="px-3 py-2 font-mono whitespace-nowrap w-[160px]">{r.rid}</td>
                  <td className="px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap max-w-[220px]">
                    {r.requesterName || "-"}
                  </td>
                  <td className="px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap max-w-[220px]">
                    {r.company || "-"}
                  </td>
                  <td className="px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                    {r.jobType || "-"}
                  </td>
                  <td className="px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]">
                    {[r.floor, r.area].filter(Boolean).join(" / ") || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap w-[170px]">
                    {fmtDate(dateToShow)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap w-[120px]">
                    <StatusChip value={r.status} />
                  </td>
                </tr>
              );
            })}
            {!loading && pageRows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">— ไม่พบข้อมูล —</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <div>ทั้งหมด {total} รายการ (หน้า {page + 1})</div>
        <div>
          <button
            disabled={page <= 0 || loading}
            onClick={()=>setPage(p => p - 1)}
            className="border rounded-lg px-3 py-2 disabled:opacity-40 mr-2"
          >
            ก่อนหน้า
          </button>
          <button
            disabled={(page + 1) * pageSize >= total || loading}
            onClick={()=>setPage(p => p + 1)}
            className="border rounded-lg px-3 py-2 disabled:opacity-40"
          >
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}
