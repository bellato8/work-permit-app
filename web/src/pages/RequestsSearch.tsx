// ============================================================
// ไฟล์: web/src/pages/RequestsSearch.tsx
// เวอร์ชัน: 2025-11-01 v6 (ใช้ Environment Variables เท่านั้น - ไม่มี hardcode)
//
// ⚠️ ต้องตั้งค่าในไฟล์ .env.local:
//    VITE_APPROVER_KEY=your-api-key-here
//    VITE_LIST_REQUESTS_URL=https://your-api.example.com/listRequests
//    หรือ VITE_FUNCTIONS_BASE=https://region-project.cloudfunctions.net
// ============================================================

import React, { useEffect, useMemo, useState } from "react";

// ⚠️ ห้าม hardcode URLs - ต้องตั้งค่า environment variables ใน .env
const ENV = (import.meta as any)?.env ?? {};

// อ่านคีย์จาก env → localStorage (ห้ามใช้ fallback hardcoded)
function resolveKey(): string {
  const fromEnv = (ENV?.VITE_APPROVER_KEY ?? "").toString().trim();
  const fromLS =
    typeof window !== "undefined"
      ? (localStorage.getItem("wp_key") ?? "").trim()
      : "";

  return fromEnv || fromLS || "";
}

// ประกอบ URL listRequests พร้อมแนบ ?key=...
function buildListUrl(params: URLSearchParams, key: string) {
  if (key) params.set("key", key);

  // ลำดับความสำคัญ: VITE_LIST_REQUESTS_URL → VITE_FUNCTIONS_BASE/listRequests
  const direct = ENV?.VITE_LIST_REQUESTS_URL?.toString()?.trim();
  if (direct) {
    const u = new URL(direct);
    u.search = params.toString();
    return u.toString();
  }

  const base = ENV?.VITE_FUNCTIONS_BASE?.toString()?.trim()?.replace(/\/+$/, "");
  if (base) {
    return `${base}/listRequests?${params.toString()}`;
  }

  // ⚠️ ถ้าไม่มีทั้ง 2 ตัวแปรข้างบน ให้ throw error
  throw new Error(
    "❌ API URL ไม่พบในไฟล์ .env\n" +
    "กรุณาเพิ่มอย่างน้อยหนึ่งตัวแปรในไฟล์ .env.local:\n" +
    "VITE_LIST_REQUESTS_URL=https://your-api.example.com/listRequests\n" +
    "หรือ\n" +
    "VITE_FUNCTIONS_BASE=https://region-project.cloudfunctions.net"
  );
}

// ------- types -------
type ReqItem = {
  rid?: string;
  createdAt?: string | number;
  status?: string;
  requesterName?: string;
  company?: string;
  area?: string;
  workType?: string;
  applicantName?: string;
  applicantCompany?: string;
  floor?: string;
};
type FetchResult = { ok: boolean; items?: any[]; error?: string };

function fmtDate(val?: string | number) {
  if (!val) return "-";
  try {
    const d =
      typeof val === "number"
        ? new Date(val)
        : new Date(isNaN(Number(val)) ? val : Number(val));
    return d.toLocaleString();
  } catch {
    return String(val);
  }
}
function statusBadgeColor(status?: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "approved") return "bg-green-600/20 text-green-300 border-green-600/40";
  if (s === "rejected") return "bg-red-600/20 text-red-300 border-red-600/40";
  if (s === "pending" || s === "review") return "bg-yellow-600/20 text-yellow-300 border-yellow-600/40";
  return "bg-gray-600/20 text-gray-300 border-gray-600/40";
}

export default function RequestsSearchPage() {
  // form state
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">(
    "all"
  );
  const now = useMemo(() => new Date(), []);
  const ninetyDaysAgo = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d;
  }, [now]);
  const isoLocal = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  const [from, setFrom] = useState(isoLocal(ninetyDaysAgo));
  const [to, setTo] = useState(isoLocal(now));

  // result state
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReqItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ใช้คีย์ที่ resolve ได้ตอนนี้
  const key = resolveKey();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // ตรวจสอบว่ามี API key หรือไม่
      if (!key) {
        throw new Error(
          "❌ ไม่พบ API Key\n" +
          "กรุณาตั้งค่า VITE_APPROVER_KEY ในไฟล์ .env หรือกดปุ่ม 'ตั้งคีย์'"
        );
      }

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      params.set("from", new Date(from).toISOString());
      params.set("to", new Date(to).toISOString());
      params.set("limit", "500");

      const url = buildListUrl(params, key);

      // แนบ Authorization header ถ้ามีกุญแจ
      const headers: Record<string, string> = {};
      if (key) headers["Authorization"] = `Bearer ${key}`;
      headers["X-Requested-With"] = "XMLHttpRequest";

      // debug
      console.log("[RequestsSearch] VITE_LIST_REQUESTS_URL =", ENV?.VITE_LIST_REQUESTS_URL);
      console.log("[RequestsSearch] VITE_FUNCTIONS_BASE  =", ENV?.VITE_FUNCTIONS_BASE);
      console.log("[RequestsSearch] key present           =", !!key);
      console.log("[RequestsSearch] final fetch URL       =", url);

      const res = await fetch(url, { method: "GET", headers });

      const text = await res.text();
      let data: FetchResult;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `ปลายทางส่งกลับไม่ใช่ JSON (อาจเป็น HTML): ${text.slice(0, 100)}…`
        );
      }

      if (!data.ok) throw new Error(data.error || "fetch error");

      const mapped: ReqItem[] = (data.items ?? []).map((it: any) => {
        const rid = it.rid ?? it.RID ?? it.id ?? it.requestId;
        const createdAt =
          it.createdAt?._seconds
            ? it.createdAt._seconds * 1000
            : it.createdAt ?? it.created_at ?? it.createdMillis;
        const requesterName =
          it.requesterName ?? it.applicantName ?? it.ownerName ?? it.name;
        const company =
          it.company ?? it.applicantCompany ?? it.ownerCompany ?? it.org;
        const area =
          it.area ??
          it.locationName ??
          [it.place, it.floor ? `ชั้น ${it.floor}` : ""].filter(Boolean).join(" ").trim();
        const workType = it.workType ?? it.jobType ?? it.category;

        return {
          rid,
          createdAt,
          status: it.status,
          requesterName,
          company,
          area,
          workType,
          applicantName: it.applicantName,
          applicantCompany: it.applicantCompany,
          floor: it.floor,
        } as ReqItem;
      });

      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function onExportCSV() {
    const header = ["RID", "CreatedAt", "Status", "Requester", "Company", "Area", "WorkType"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const row = [
        r.rid ?? "",
        fmtDate(r.createdAt) ?? "",
        r.status ?? "",
        r.requesterName ?? r.applicantName ?? "",
        r.company ?? r.applicantCompany ?? "",
        r.area ?? "",
        r.workType ?? "",
      ]
        .map((v) => {
          const s = String(v ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(",");
      lines.push(row);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `requests-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ให้ผู้ใช้ตั้งคีย์ได้ทันที (เก็บใน localStorage)
  function promptKey() {
    const current = typeof window !== "undefined" ? localStorage.getItem("wp_key") ?? "" : "";
    const v = window.prompt(
      "ใส่ Approver Key (กรุณาตรวจสอบค่าจาก VITE_APPROVER_KEY ใน .env)",
      current
    );
    if (v !== null && v.trim()) {
      localStorage.setItem("wp_key", v.trim());
      window.location.reload();
    }
  }

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold">ค้นหาคำขอ (ผู้รับเหมา)</h1>
          <div className="flex gap-2">
            <button
              onClick={promptKey}
              className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700"
              title="ตั้งค่า Approver Key สำหรับเรียก API"
            >
              ตั้งคีย์
            </button>
            <a
              href="/login"
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700"
            >
              ไปหน้าเข้าสู่ระบบ
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-6 mb-6 shadow-lg">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-sm text-slate-300 mb-1">คำค้น (Query)</label>
              <input
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:ring focus:ring-slate-600"
                placeholder="ชื่อบริษัท / ชื่อผู้ขอ / RID ..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm text-slate-300 mb-1">สถานะ (Status)</label>
              <select
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:ring focus:ring-slate-600"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="all">ทั้งหมด</option>
                <option value="pending">รออนุมัติ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="rejected">ไม่อนุมัติ</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-sm text-slate-300 mb-1">เริ่ม (From)</label>
              <input
                type="datetime-local"
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:ring focus:ring-slate-600"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm text-slate-300 mb-1">สิ้นสุด (To)</label>
              <input
                type="datetime-local"
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:ring focus:ring-slate-600"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-medium disabled:opacity-60"
            >
              {loading ? "กำลังค้นหา..." : "ค้นหา / รีเฟรช"}
            </button>

            <button
              onClick={onExportCSV}
              disabled={rows.length === 0}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-60"
            >
              ส่งออก CSV
            </button>

            {error && (
              <div className="text-red-300">
                เกิดข้อผิดพลาด: <span className="font-mono">{error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 shadow-lg">
          <div className="px-4 py-3 border-b border-slate-800 text-slate-300">
            ผลลัพธ์: {rows.length} รายการ
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-300">
                  <th className="px-4 py-3 text-left">RID</th>
                  <th className="px-4 py-3 text-left">สร้างเมื่อ</th>
                  <th className="px-4 py-3 text-left">สถานะ</th>
                  <th className="px-4 py-3 text-left">ผู้ขอ/บริษัท</th>
                  <th className="px-4 py-3 text-left">พื้นที่/ชั้น</th>
                  <th className="px-4 py-3 text-left">ประเภทงาน</th>
                  <th className="px-4 py-3 text-left">การทำงาน</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      ไม่พบรายการในช่วงที่เลือก
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr key={(r.rid ?? "") + idx} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono">{r.rid ?? "-"}</td>
                      <td className="px-4 py-3">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={"px-2 py-1 rounded-lg border " + statusBadgeColor(r.status)}>
                          {r.status ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(r.requesterName ?? r.applicantName ?? "-") +
                          (r.company || r.applicantCompany ? ` / ${r.company ?? r.applicantCompany}` : "")}
                      </td>
                      <td className="px-4 py-3">{r.area ?? "-"}</td>
                      <td className="px-4 py-3">{r.workType ?? "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {r.rid && (
                            <a
                              href={`/status?rid=${encodeURIComponent(r.rid)}`}
                              className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700"
                            >
                              เปิดหน้า Status
                            </a>
                          )}
                          {r.rid && (
                            <a
                              href={`/admin/requests/${encodeURIComponent(r.rid)}`}
                              className="px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700"
                            >
                              เปิดหน้า Admin
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          *หน้านี้สำหรับการใช้งานภายในองค์กร (PDPA). หากต้องเปิดสาธารณะ ให้ทำ listRequestsPublic ที่ปิดข้อมูลส่วนบุคคล.
        </p>
      </div>
    </div>
  );
}
