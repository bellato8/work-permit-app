// ======================================================================
// ไฟล์: web/src/pages/admin/Dashboard.tsx
// เวอร์ชัน: 2025-10-01 16:10 (Asia/Bangkok)
// เรื่อง: ซ่อนการ์ด "Total Users" ให้เห็นเฉพาะ superadmin
// แนวทาง:
//   - อ่านบทบาทจาก ID Token (getIdTokenResult) → ถ้า role !== "superadmin" ให้ซ่อนการ์ด
//   - เมื่อไม่ใช่ superadmin: ไม่ต้องเรียก API users เลย (ลด 403 และลดข้อมูลเกินจำเป็น)
//   - เลย์เอาต์กริดปรับเป็น 3 หรือ 4 คอลัมน์ตามการแสดงผลการ์ด
// อ้างอิงแนวทาง: ตรวจ ID Token ฝั่งหลังบ้าน (Firebase), Least Privilege, Data Minimization
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Box, Stack, Card, CardContent, Typography, Chip, Button, Divider, LinearProgress, CircularProgress,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

// Recharts สำหรับ Pie Chart
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

// ใช้ auth ของโปรเจกต์
import { auth } from "../../lib/firebase";

// สีสำหรับ Pie Chart (สีสดใสและแตกต่างกัน)
const PIE_COLORS = [
  "#667eea", // ม่วงน้ำเงิน
  "#f093fb", // ชมพูอ่อน
  "#4facfe", // ฟ้าสด
  "#43e97b", // เขียวมิ้นต์
  "#fa709a", // ชมพูแดง
  "#fee140", // เหลืองสด
  "#30cfd0", // เขียวน้ำทะเล
  "#a8edea", // เขียวอ่อน
  "#ff6a88", // แดงชมพู
  "#feca57", // ส้มทอง
];

// ---------- ประเภทข้อมูล ----------
type RequestItem = {
  id: string;
  rid: string;
  requester?: { fullname?: string; company?: string; name?: string };
  work?: { type?: string; category?: string };
  status?: "pending" | "approved" | "rejected" | string;
  createdAt?: number | string | any;
  approvedAt?: number | string | any;
  rejectedAt?: number | string | any;
  updatedAt?: number | string | any;
};

// ---------- ค่าเชื่อมต่อ ----------
const PROXY_LIST_URL   = import.meta.env.VITE_PROXY_LISTREQUESTS_URL as string | undefined;
const PROXY_ADMINS_URL = import.meta.env.VITE_PROXY_LISTADMINS_URL as string | undefined;
const DIRECT_LIST_URL   = import.meta.env.VITE_LIST_REQUESTS_URL as string | undefined;
const DIRECT_ADMINS_URL = import.meta.env.VITE_LIST_ADMINS_URL as string | undefined;

// ---------- ตัวช่วย ----------
const isProxyUrl = (u?: string) => !!u && /cloudfunctions\.net\/.*proxy/i.test(u);

function addQuery(base: string, params: Record<string, any>) {
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

// ✅ สกัด role จาก ID Token (รองรับคีย์ที่พบบ่อย: role/roles/caps.role)
async function getRoleFromIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) return "";
  try {
    const r = await user.getIdTokenResult();
    const c: any = r?.claims || {};
    const byCommon =
      (typeof c.role === "string" && c.role) ||
      (typeof c.roles === "string" && c.roles) ||
      (typeof c.roles === "object" && c.roles?.[0]);
    // เผื่อบางโปรเจกต์เก็บใน caps.role
    const byCaps = typeof c.caps === "object" && typeof c.caps.role === "string" ? c.caps.role : "";
    const role = String(byCommon || byCaps || "").toLowerCase().trim();
    return role;
  } catch {
    return "";
  }
}

// ✅ ดึง header ที่แนบ ID Token + email
async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { Accept: "application/json" };
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken(false);
      h["Authorization"] = `Bearer ${token}`;
      if (user.email) h["x-requester-email"] = user.email.toLowerCase();
    } catch {}
  }
  return h;
}

// ✅ fetch JSON พร้อม header auth
async function fetchJsonSmart(url: string) {
  const headers = await authHeaders();
  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  return { ok: res.ok, status: res.status, data, text };
}

// ---------- Date helpers (คงเดิม) ----------
function tsToMillis(v: any): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "object" && v._seconds) {
    return v._seconds * 1000 + (v._nanoseconds ? Math.floor(v._nanoseconds / 1e6) : 0);
  }
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
const toTime = (v?: number | string | any) => (v === undefined ? null : tsToMillis(v));
const isSameLocalDay = (t: number, base = Date.now()) => {
  const d1 = new Date(t), d2 = new Date(base);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
};
const withinDays = (t: number, days: number, base = Date.now()) => {
  const diff = base - t; return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};
const toDateLabel = (v?: number | string | any) => {
  const n = toTime(v); if (n == null) return "-";
  const date = new Date(n);
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
};
function statusTh(v?: string): "อนุมัติ" | "ไม่อนุมัติ" | "รออนุมัติ" {
  const s = (v || "pending").toLowerCase();
  if (s === "approved") return "อนุมัติ";
  if (s === "rejected") return "ไม่อนุมัติ";
  return "รออนุมัติ";
}
const statusChip = (v?: string) => {
  const label = statusTh(v);
  const color = label === "อนุมัติ" ? "success" : label === "ไม่อนุมัติ" ? "error" : "warning";
  return <Chip size="small" label={label} color={color as any} variant="outlined" />;
};

// ---------- Extract/Normalize (คงเดิม) ----------
function extractItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data?.items)) return data.data.items;
  if (Array.isArray(data.requests)) return data.requests;
  if (Array.isArray(data.data?.requests)) return data.data.requests;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  const keys = Object.keys(data);
  if (keys.length === 1 && Array.isArray((data as any)[keys[0]])) return (data as any)[keys[0]];
  return [];
}
function normalizeItem(raw: any): RequestItem | null {
  if (!raw || typeof raw !== "object") return null;
  const rid = String(raw.rid || raw.requestId || raw.id || raw.RID || raw.documentId || "").trim();
  if (!rid) return null;
  let status = "pending";
  if (raw.status) status = String(raw.status).trim().toLowerCase();
  else if (raw.requestStatus) status = String(raw.requestStatus).trim().toLowerCase();
  else if (raw.approvalStatus) status = String(raw.approvalStatus).trim().toLowerCase();

  const requesterName = String(
    raw.contractorName || raw.requesterName || raw.fullname || raw.name ||
    raw.applicantName || raw.submittedBy || raw.applicant || raw.createdBy?.name ||
    raw.contact?.name || raw.requester?.fullname || raw.requester?.name || ""
  ).trim();

  const company = String(
    raw.contractorCompany || raw.requesterCompany || raw.company || raw.requester?.company || ""
  ).trim();

  const workType = String(
    raw.workType || raw.jobType || raw.permitType || raw.type || raw.category ||
    raw.workCategory || raw.work?.type || raw.work?.category || ""
  ).trim() || "ไม่ระบุ";

  return {
    id: rid, rid, status,
    createdAt: toTime(raw.createdAt || raw.createdDate || raw.submittedAt),
    approvedAt: toTime(raw.approvedAt || raw.approvedDate),
    rejectedAt: toTime(raw.rejectedAt || raw.rejectedDate),
    updatedAt: toTime(raw.updatedAt || raw.lastModified || raw.modifiedAt),
    requester: { fullname: requesterName || undefined, company: company || undefined, name: requesterName || undefined },
    work: { type: workType, category: workType },
  };
}

// ---------- คอมโพเนนต์หลัก ----------
export default function Dashboard() {
  const [rows, setRows] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // state ของการ์ด Users
  const [showUsersCard, setShowUsersCard] = useState<boolean>(false);   // แสดง/ซ่อนการ์ด
  const [userCount, setUserCount] = useState<number | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);              // โหลดเฉพาะเมื่อ role == superadmin

  // โหลดรายการคำขอ (เหมือนเดิม)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!PROXY_LIST_URL && !DIRECT_LIST_URL) {
        setError("ยังไม่ได้ตั้งค่า URL รายการคำขอ"); setLoading(false); return;
      }
      setLoading(true); setError("");
      try {
        let finalData: any = null; let finalError = "";
        if (PROXY_LIST_URL) {
          try {
            const res = await fetchJsonSmart(addQuery(PROXY_LIST_URL, { limit: 500 }));
            if (res.ok && res.data) finalData = res.data; else finalError = res.text || `Proxy failed (${res.status})`;
          } catch (e: any) { finalError = e?.message || "Proxy error"; }
        }
        if (!finalData && DIRECT_LIST_URL) {
          try {
            const res = await fetchJsonSmart(addQuery(DIRECT_LIST_URL, { limit: 500 }));
            if (res.ok && res.data) { finalData = res.data; finalError = ""; }
            else finalError = res.text || `Direct failed (${res.status})`;
          } catch (e: any) { finalError = e?.message || "Direct error"; }
        }
        if (!finalData) { setRows([]); setError(finalError || "ไม่สามารถโหลดข้อมูลได้"); return; }
        const items = extractItems(finalData);
        const safe: RequestItem[] = items.map(normalizeItem).filter(Boolean) as RequestItem[];
        safe.sort((a, b) => {
          const ta = toTime(a.approvedAt) ?? toTime(a.rejectedAt) ?? toTime(a.updatedAt) ?? toTime(a.createdAt) ?? 0;
          const tb = toTime(b.approvedAt) ?? toTime(b.rejectedAt) ?? toTime(b.updatedAt) ?? toTime(b.createdAt) ?? 0;
          return (tb as number) - (ta as number);
        });
        setRows(safe);
      } catch (e: any) {
        setRows([]); setError(/Failed to fetch/i.test(String(e)) ? "เชื่อมต่อไม่ได้ (CORS/เครือข่าย)" : (e?.message || "เกิดข้อผิดพลาด"));
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // โหลดจำนวนผู้ใช้ — เฉพาะ superadmin เท่านั้น
  useEffect(() => {
    let alive = true;
    (async () => {
      const role = (await getRoleFromIdToken()) || "";
      if (role !== "superadmin") {
        // ไม่ใช่ superadmin → ไม่แสดงการ์ดและไม่เรียก API
        setShowUsersCard(false);
        return;
      }
      setShowUsersCard(true);
      setUsersLoading(true);

      if (!PROXY_ADMINS_URL && !DIRECT_ADMINS_URL) {
        setUserCount(0); setUsersLoading(false); return;
      }
      try {
        let finalData: any = null;
        if (PROXY_ADMINS_URL) {
          const res = await fetchJsonSmart(PROXY_ADMINS_URL);
          if (res.ok && res.data) finalData = res.data;
        }
        if (!finalData && DIRECT_ADMINS_URL) {
          const res = await fetchJsonSmart(DIRECT_ADMINS_URL);
          if (res.ok && res.data) finalData = res.data;
        }
        if (!finalData) { setUserCount(0); return; }
        const items: any[] = extractItems(finalData);
        setUserCount(items.length || 0);
      } finally {
        if (alive) setUsersLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // KPI calculation (คงเดิม)
  const now = Date.now();
  const stats = useMemo(() => {
    let pending = 0, approvedToday = 0, rejected7d = 0;
    for (const r of rows || []) {
      const status = (r?.status || "").toLowerCase();
      if (status !== "approved" && status !== "rejected") pending++;
      if (status === "approved") {
        const t = toTime(r.approvedAt) ?? toTime(r.updatedAt) ?? toTime(r.createdAt);
        if (t !== null && isSameLocalDay(t, now)) approvedToday++;
      }
      if (status === "rejected") {
        const t = toTime(r.rejectedAt) ?? toTime(r.updatedAt) ?? toTime(r.createdAt);
        if (t !== null && withinDays(t, 7, now)) rejected7d++;
      }
    }
    return { pending, approvedToday, rejected7d };
  }, [rows, now]);

  const topTypes = useMemo(() => {
    const counter = new Map<string, number>();
    for (const r of rows || []) {
      const t = (r?.work?.type || r?.work?.category || "ไม่ระบุ").toString().trim();
      counter.set(t, (counter.get(t) || 0) + 1);
    }
    const list = Array.from(counter.entries()).map(([type, count]) => ({ type, count }));
    list.sort((a, b) => b.count - a.count);
    return list.slice(0, 5);
  }, [rows]);

  const trend = useMemo(() => {
    const days = 7;
    const labels: string[] = [];
    const counts: number[] = new Array(days).fill(0);
    const base = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base); d.setDate(base.getDate() - i);
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    }
    for (const r of rows || []) {
      const t = toTime(r.createdAt) ?? toTime(r.updatedAt) ?? toTime(r.approvedAt) ?? toTime(r.rejectedAt);
      if (t === null) continue;
      const d = new Date(t);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      const idx = labels.indexOf(key);
      if (idx >= 0) counts[idx] += 1;
    }
    const W = 420, H = 120, PADX = 12, PADY = 12;
    const min = 0;
    const max = Math.max(1, ...counts);
    const xStep = (W - PADX * 2) / (days - 1);
    const yFromVal = (v: number) => H - PADY - ((v - min) / (max - min)) * (H - PADY * 2);
    const points = counts.map((v, i) => `${(PADX + i * xStep).toFixed(1)},${yFromVal(v).toFixed(1)}`).join(" ");
    return { labels, counts, W, H, PADX, PADY, points, max };
  }, [rows]);



  const columns: GridColDef[] = [
    {
      field: "rid",
      headerName: "RID",
      minWidth: 200,
      flex: 1,
      renderCell: (params) => (
        <RouterLink
          to={`/admin/permits/${encodeURIComponent(String(params.value || ""))}`}
          style={{ textDecoration: "none", color: "#111827", fontWeight: 600 }}
        >
          {params.value}
        </RouterLink>
      ),
    },
    {
      field: "requesterName",
      headerName: "ผู้ยื่น",
      minWidth: 180,
      flex: 1,
      valueGetter: (_value, row) =>
        row?.requester?.fullname || row?.requester?.name || row?.requester?.company || "-",
    },
    {
      field: "workType",
      headerName: "ประเภทงาน",
      minWidth: 140,
      flex: 1,
      valueGetter: (_value, row) => row?.work?.type || row?.work?.category || "ไม่ระบุ",
    },
    {
      field: "status",
      headerName: "สถานะ",
      minWidth: 140,
      renderCell: (p) => statusChip(String(p.value || "pending")),
    },
    {
      field: "createdAt",
      headerName: "วันที่ยื่น",
      minWidth: 190,
      valueGetter: (_value, row) => {
        const t = row?.createdAt ?? row?.updatedAt ?? row?.approvedAt ?? row?.rejectedAt;
        return toDateLabel(t);
      },
    },
    {
      field: "action",
      headerName: "",
      minWidth: 140,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            component={RouterLink}
            to={`/admin/permits/${encodeURIComponent(String(p.row?.rid || ""))}`}
            variant="outlined"
          >
            ดู
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              const header = ["RID", "ผู้ยื่น", "ประเภทงาน", "สถานะ", "วันที่ยื่น/อัปเดตล่าสุด"];
              const requester = p.row?.requester?.fullname || p.row?.requester?.name || p.row?.requester?.company || "-";
              const type = p.row?.work?.type || p.row?.work?.category || "ไม่ระบุ";
              const t = p.row?.createdAt ?? p.row?.updatedAt ?? p.row?.approvedAt ?? p.row?.rejectedAt;
              const dateStr = toDateLabel(t);
              const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
              const csv = "\uFEFF" + [header.join(","), [p.row.rid, requester, type, p.row.status || "-", dateStr].map(esc).join(",")].join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `request-${p.row.rid}.csv`;
              document.body.appendChild(a); a.click(); a.remove();
            }}
          >
            CSV
          </Button>
        </Stack>
      ),
    },
  ];

  const recentRows = useMemo(() => (Array.isArray(rows) ? rows.slice(0, 8) : []), [rows]);

  // ---------- UI ----------
  // เลือกจำนวนคอลัมน์ KPI ตามการแสดงการ์ด Users
  const gridColsMd = showUsersCard ? "repeat(4, 1fr)" : "repeat(3, 1fr)";

  return (
    <Box sx={{ p: 2 }}>
      {/* หัวข้อ + ปุ่ม */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => location.reload()}>รีโหลด</Button>

          <Button component={RouterLink} to="/admin/permits" size="small">ดูทั้งหมด</Button>
        </Stack>
      </Stack>

      {/* KPI การ์ด */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: gridColsMd },
          gap: 2,
          mb: 2,
        }}
      >
        <KpiCard icon={<PendingActionsIcon color="warning" />} title="Pending Permits" subtitle="ที่รออนุมัติ" value={stats.pending} />
        <KpiCard icon={<CheckCircleOutlineIcon color="success" />} title="Approved Today" subtitle="อนุมัติวันนี้" value={stats.approvedToday} />
        <KpiCard icon={<CancelOutlinedIcon color="error" />} title="Rejected (7d)" subtitle="ปฏิเสธใน 7 วัน" value={stats.rejected7d} />

        {/* การ์ด Users — แสดงเฉพาะ superadmin */}
        {showUsersCard && (
          <KpiCard
            icon={<PeopleAltOutlinedIcon color="primary" />}
            title="Total Users"
            subtitle={usersLoading ? "กำลังโหลด..." : "ผู้ใช้งานทั้งหมด"}
            value={userCount ?? 0}
            loading={usersLoading}
          />
        )}
      </Box>

      {/* Top types + Trend */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mb: 2 }}>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Top Permit Types</Typography>
            {topTypes.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>ยังไม่มีข้อมูลประเภทงาน</Typography>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topTypes}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ type, count, percent }) =>
                      `${type}: ${count} (${((percent || 0) * 100).toFixed(0)}%)`
                    }
                    labelLine={{ stroke: "#888", strokeWidth: 1 }}
                  >
                    {topTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} รายการ`, name]}
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.95)",
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      padding: 8
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => `${value} (${entry.payload.count})`}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700}>Requests Trend (7 วัน)</Typography>
            <Box sx={{ mt: 1.5, width: "100%" }}>
              <svg viewBox={`0 0 ${trend.W} ${trend.H}`} width="100%" height={trend.H}>
                <polyline points={`12,${trend.H - trend.PADY} ${trend.W - trend.PADX},${trend.H - trend.PADY}`} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                <polyline points={trend.points} fill="none" stroke="#3b82f6" strokeWidth="2" />
                {trend.counts.map((v, i) => {
                  const x = 12 + (i * (trend.W - trend.PADX * 2)) / (trend.counts.length - 1);
                  const min = 0, max = Math.max(1, ...trend.counts);
                  const y = trend.H - trend.PADY - ((v - min) / (max - min)) * (trend.H - trend.PADY * 2);
                  return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />;
                })}
              </svg>
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                {trend.labels.map((lb, i) => (<Typography key={i} variant="caption" color="text.secondary">{lb}</Typography>))}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ตารางล่าสุด */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ pb: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>Recent Requests ({rows.length} รายการ)</Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => location.reload()}>รีโหลด</Button>
    
              <Button size="small" component={RouterLink} to="/admin/permits">ดูทั้งหมด</Button>
            </Stack>
          </Stack>
          <Divider />
        </CardContent>

        <Box sx={{ height: 480, width: "100%", p: 1 }}>
          <DataGrid
            rows={recentRows}
            columns={columns}
            disableRowSelectionOnClick
            getRowId={(r) => r.id}
            loading={loading}
            localeText={{ noRowsLabel: error ? `เกิดข้อผิดพลาด: ${error}` : "ยังไม่มีข้อมูล" }}
          />
        </Box>
      </Card>
    </Box>
  );
}

// ---------- ส่วนประกอบย่อย ----------
function KpiCard({
  icon, title, subtitle, value, hint, loading,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: number;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box sx={{ fontSize: 0 }}>{icon}</Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" fontWeight={800}>{value ?? 0}</Typography>
              {loading && <CircularProgress size={16} />}
            </Stack>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
            {hint && <Typography variant="caption" color="warning.main" sx={{ display: "block" }}>{hint}</Typography>}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
