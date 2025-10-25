// ======================================================================
// File: web/src/pages/admin/Permits.tsx
// เวอร์ชัน: 2025-10-25 (MUI DataGrid Edition)
// หน้าที่: รายการใบอนุญาต (Permits) ฝั่งแอดมิน — ดึง/กรอง/แบ่งหน้า/Hydrate/ส่งออก CSV
// การเปลี่ยนแปลงสำคัญ:
//   • เปลี่ยนจาก <table> เป็น MUI DataGrid
//   • เพิ่มคอลัมน์เลขบัตรประชาชน (citizenId) แสดงเต็ม
//   • รักษาฟีเจอร์เดิมทั้งหมด: กรอง, เรียง, CSV export, pagination
//   • เพิ่มฟีเจอร์ใหม่: column resizing, column visibility, better UX
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Chip, Alert, Button, TextField, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { DataGrid, GridColDef, GridRowParams } from "@mui/x-data-grid";

// อะแดปเตอร์สิทธิ์
import useAuthzLive from "../../hooks/useAuthzLive";
import { hasCap, isSuperadmin } from "../../lib/hasCap";

// CSV Column Selector
import CsvColumnSelector, { CsvColumn } from "../../components/CsvColumnSelector";

// Firebase Auth
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

// ---------- สร้าง Header ที่แนบ ID Token ----------
async function withIdTokenHeaders(extra?: HeadersInit) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const idToken = await user.getIdToken(false);
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
  id: string; // DataGrid ต้องการ id
  rid: string;
  requesterName?: string;
  company?: string;
  jobType?: string;
  floor?: string;
  area?: string;
  citizenId?: string;
  createdAt?: number;
  updatedAt?: number;
  approvedAt?: number;
  rejectedAt?: number;
  status?: string;
};

// แปลง timestamp → ms
function tsToMillis(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;

  if (typeof v === "number") {
    const abs = Math.abs(v);
    if (abs < 1e11) return v * 1000;
    if (abs < 1e13) return v;
    if (abs < 1e16) return Math.floor(v / 1e3);
    return Math.floor(v / 1e6);
  }

  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d.getTime();
  }

  if (v?._seconds !== undefined) return v._seconds * 1000;
  if (v?.seconds !== undefined) return v.seconds * 1000;

  return undefined;
}

// ฟอร์แมตวันที่
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
  const area = squash(x?.work?.area || x?.location?.area || x?.area || "");
  const citizenId = squash(x?.requester?.citizenId || "") || undefined;

  const createdAt =
    tsToMillis(x?.createdAt) ?? tsToMillis(x?.created_at) ?? tsToMillis(x?.created) ?? undefined;
  const updatedAt = tsToMillis(x?.updatedAt) ?? tsToMillis(x?.updated_at) ?? undefined;
  const approvedAt = tsToMillis(x?.approvedAt) ?? tsToMillis(x?.decision?.decidedAt) ?? undefined;
  const rejectedAt = tsToMillis(x?.rejectedAt) ?? tsToMillis(x?.decision?.decidedAt) ?? undefined;

  const status = squash(x?.status || x?.decision?.status || "pending");

  return {
    id: rid, // DataGrid ต้องการ id
    rid,
    requesterName,
    company,
    jobType,
    floor,
    area,
    citizenId,
    createdAt,
    updatedAt,
    approvedAt,
    rejectedAt,
    status,
  };
}

function normalizeStatus(input?: string): "approved" | "rejected" | "pending" {
  const s = String(input || "").toLowerCase();
  if (!s) return "pending";
  if (s === "รออนุมัติ" || s.includes("รออนุมัติ")) return "pending";
  if (s.includes("pending") || s.includes("waiting") || s.includes("submitted") || s.includes("รอ")) return "pending";
  if (s.includes("approve") || s.includes("อนุมัติ") || s === "approved" || s === "accept") return "approved";
  if (s.includes("reject") || s.includes("ปฏิเสธ") || s === "rejected" || s === "deny") return "rejected";
  return "pending";
}

// ---------------- hydrate รายละเอียด ----------------
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
      const jobType = x?.work?.type ?? x?.work?.location?.type ?? x?.jobType ?? r.jobType;
      const floor = x?.work?.floor ?? x?.location?.floor ?? r.floor;
      const area = x?.work?.area ?? x?.location?.area ?? r.area;
      const citizenId = x?.requester?.citizenId ?? r.citizenId;

      out[idx] = { ...r, requesterName, company, jobType, floor, area, citizenId };
    } catch {
      // เงียบ
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

// ---------------- CSV ----------------
function rowsToCsv(rows: PermitRow[], selectedColumns: CsvColumn[]): string {
  const esc = (x: any) => `"${String(x ?? "").replace(/"/g, '""')}"`;

  const enabledCols = selectedColumns.filter((c) => c.enabled);
  if (enabledCols.length === 0) return "";

  const headerLine = enabledCols.map((c) => esc(c.label)).join(",");
  const lines = [headerLine];

  for (const r of rows) {
    const rowData: string[] = [];
    for (const col of enabledCols) {
      switch (col.key) {
        case "rid":
          rowData.push(esc(r.rid));
          break;
        case "requesterName":
          rowData.push(esc(r.requesterName ?? ""));
          break;
        case "citizenId":
          rowData.push(esc(r.citizenId ?? ""));
          break;
        case "company":
          rowData.push(esc(r.company ?? ""));
          break;
        case "jobType":
          rowData.push(esc(r.jobType ?? ""));
          break;
        case "floor":
          rowData.push(esc(r.floor ?? ""));
          break;
        case "area":
          rowData.push(esc(r.area ?? ""));
          break;
        case "dateShown":
          const t = r.createdAt ?? r.updatedAt ?? r.approvedAt ?? r.rejectedAt;
          rowData.push(esc(fmtDate(t)));
          break;
        case "status":
          rowData.push(esc(normalizeStatus(r.status)));
          break;
        default:
          rowData.push(esc(""));
      }
    }
    lines.push(rowData.join(","));
  }

  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const csvWithBom = "\uFEFF" + csv;
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
  if (v === "approved") return <Chip label="อนุมัติ" color="success" size="small" />;
  if (v === "rejected") return <Chip label="ไม่อนุมัติ" color="error" size="small" />;
  return <Chip label="รออนุมัติ" color="warning" size="small" />;
}

// ============================================================
// Component
// ============================================================
export default function Permits() {
  const nav = useNavigate();

  const [items, setItems] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // อ่านสิทธิ์
  const live = useAuthzLive() ?? {};
  const canView =
    isSuperadmin(live.role) ||
    live.pagePermissions?.permits?.canView === true ||
    hasCap(live.caps, "view_permits", live.role) ||
    hasCap(live.caps, "view_all", live.role) ||
    hasCap(live.caps, "approve_requests", live.role) ||
    hasCap(live.caps, "review_requests", live.role);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // CSV Column Selector
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvColumns, setCsvColumns] = useState<CsvColumn[]>([
    { key: "rid", label: "RID", enabled: true },
    { key: "requesterName", label: "ผู้ขอ", enabled: true },
    { key: "citizenId", label: "เลขบัตรประชาชน", enabled: true },
    { key: "company", label: "บริษัท", enabled: true },
    { key: "jobType", label: "ประเภทงาน", enabled: true },
    { key: "floor", label: "ชั้น", enabled: true },
    { key: "area", label: "พื้นที่", enabled: true },
    { key: "dateShown", label: "วันที่ยื่น", enabled: true },
    { key: "status", label: "สถานะ", enabled: true },
  ]);

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

      if (!canView) {
        setItems([]);
        return;
      }

      const url = getListUrl();
      if (!url) {
        setErr("LIST URL ว่าง — กรุณาตั้งค่าใน .env");
        setItems([]);
        return;
      }

      const requester = getRequesterEmail();
      const u = new URL(url);
      u.searchParams.set("limit", "300");

      let json: any | undefined;

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
          const res2 = await fetch(u.toString(), {
            method: "GET",
            headers: await withIdTokenHeaders(),
            signal,
          });
          if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
          json = await res2.json();
        }
      } catch {
        const res2 = await fetch(u.toString(), {
          method: "GET",
          headers: await withIdTokenHeaders(),
          signal,
        });
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        json = await res2.json();
      }

      const rawItems: any[] =
        Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json?.data?.items)
          ? json.data.items
          : Array.isArray(json?.results)
          ? json.results
          : [];

      let mapped = rawItems.map(normalizeOne).filter(Boolean) as PermitRow[];

      mapped.sort((a, b) => {
        const ta =
          tsToMillis(a.updatedAt) ??
          tsToMillis(a.approvedAt) ??
          tsToMillis(a.rejectedAt) ??
          tsToMillis(a.createdAt) ??
          0;
        const tb =
          tsToMillis(b.updatedAt) ??
          tsToMillis(b.approvedAt) ??
          tsToMillis(b.rejectedAt) ??
          tsToMillis(b.createdAt) ??
          0;
        return tb - ta;
      });

      setItems(mapped);

      mapped = await hydrateDetails(mapped);
      setItems(mapped);
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

  // กรอง/เรียง
  const filteredSorted = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    const fromMs = from ? Date.parse(from) : undefined;
    const toMs = to ? Date.parse(to) + 24 * 60 * 60 * 1000 - 1 : undefined;

    let rows = items.filter((r) => {
      const okQ =
        !qLower ||
        r.rid.toLowerCase().includes(qLower) ||
        (r.requesterName || "").toLowerCase().includes(qLower) ||
        (r.citizenId || "").toLowerCase().includes(qLower) ||
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

      const ms = tsToMillis(r.createdAt) || 0;
      const okFrom = fromMs === undefined || ms >= fromMs;
      const okTo = toMs === undefined || ms <= toMs;

      return okQ && okStatus && okCompany && okFrom && okTo;
    });

    return rows;
  }, [items, q, status, company, from, to]);

  // DataGrid Columns
  const columns: GridColDef[] = [
    {
      field: "rid",
      headerName: "RID",
      width: 180,
      renderCell: (params) => (
        <span style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>{params.value}</span>
      ),
    },
    {
      field: "requesterName",
      headerName: "ผู้ขอ",
      width: 200,
      valueGetter: (params) => params || "-",
    },
    {
      field: "citizenId",
      headerName: "เลขบัตรประชาชน",
      width: 160,
      renderCell: (params) => (
        <span style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>{params.value || "-"}</span>
      ),
    },
    {
      field: "company",
      headerName: "บริษัท",
      width: 200,
      valueGetter: (params) => params || "-",
    },
    {
      field: "jobType",
      headerName: "ประเภทงาน",
      width: 180,
      valueGetter: (params) => params || "-",
    },
    {
      field: "floor",
      headerName: "ชั้น",
      width: 100,
      valueGetter: (params) => params || "-",
    },
    {
      field: "area",
      headerName: "พื้นที่",
      width: 150,
      valueGetter: (params) => params || "-",
    },
    {
      field: "createdAt",
      headerName: "วันที่ยื่น",
      width: 180,
      valueGetter: (params) => fmtDate(params),
    },
    {
      field: "status",
      headerName: "สถานะ",
      width: 130,
      renderCell: (params) => <StatusChip value={params.value} />,
    },
  ];

  // -------- UI --------
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: "1600px", mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", margin: 0 }}>รายการใบอนุญาต</h1>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip label={`รออนุมัติ: ${counters.pending}`} color="warning" />
          <Chip label={`อนุมัติแล้ว: ${counters.approved}`} color="success" />
          <Chip label={`ถูกปฏิเสธ: ${counters.rejected}`} color="error" />
        </Box>
      </Box>

      {!canView && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          คุณไม่มีสิทธิ์ดูรายการใบอนุญาต
        </Alert>
      )}

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {/* Filters */}
      <Box
        sx={{
          mb: 2,
          p: 2,
          bgcolor: "white",
          borderRadius: 2,
          border: "1px solid #e0e0e0",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(6, 1fr)" },
          gap: 2,
        }}
      >
        <TextField
          size="small"
          placeholder="ค้นหา: RID/ชื่อ/เลขบัตร/บริษัท..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ gridColumn: { xs: "1", md: "span 2" } }}
        />
        <FormControl size="small">
          <InputLabel>สถานะ</InputLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} label="สถานะ">
            <MenuItem value="">ทุกสถานะ</MenuItem>
            <MenuItem value="pending">รออนุมัติ</MenuItem>
            <MenuItem value="approved">อนุมัติแล้ว</MenuItem>
            <MenuItem value="rejected">ถูกปฏิเสธ</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="บริษัท"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <TextField
          size="small"
          type="date"
          label="จาก"
          InputLabelProps={{ shrink: true }}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          size="small"
          type="date"
          label="ถึง"
          InputLabelProps={{ shrink: true }}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </Box>

      {/* Action Buttons */}
      <Box sx={{ mb: 2, display: "flex", gap: 1 }}>
        <Button variant="outlined" size="small" onClick={() => loadList()} disabled={loading}>
          รีเฟรช
        </Button>
        <Button variant="outlined" size="small" onClick={() => setShowCsvModal(true)}>
          ส่งออก CSV
        </Button>
      </Box>

      {/* DataGrid */}
      <Box sx={{ height: 600, width: "100%", bgcolor: "white", borderRadius: 2 }}>
        <DataGrid
          rows={filteredSorted}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 20, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 20 } },
          }}
          onRowClick={(params: GridRowParams) => {
            nav(`/admin/permits/${encodeURIComponent(params.row.rid)}`);
          }}
          sx={{
            "& .MuiDataGrid-row": {
              cursor: "pointer",
            },
            "& .MuiDataGrid-row:hover": {
              bgcolor: "#f5f5f5",
            },
          }}
          disableRowSelectionOnClick
        />
      </Box>

      {/* CSV Column Selector Modal */}
      {showCsvModal && (
        <CsvColumnSelector
          columns={csvColumns}
          onToggle={(key) => {
            setCsvColumns((cols) => cols.map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c)));
          }}
          onSelectAll={() => {
            setCsvColumns((cols) => cols.map((c) => ({ ...c, enabled: true })));
          }}
          onDeselectAll={() => {
            setCsvColumns((cols) => cols.map((c) => ({ ...c, enabled: false })));
          }}
          onConfirm={() => {
            const csv = rowsToCsv(filteredSorted, csvColumns);
            if (!csv) {
              alert("กรุณาเลือกคอลัมน์อย่างน้อย 1 คอลัมน์");
              return;
            }
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
            downloadCsv(`permits_${stamp}.csv`, csv);
            setShowCsvModal(false);
          }}
          onCancel={() => setShowCsvModal(false)}
        />
      )}
    </Box>
  );
}

