// ============================================================
// ไฟล์: web/src/pages/admin/Dashboard.tsx (Fixed Data Issues)
// ผู้เขียน (Written by): AI Helper - Fixed Data Mapping & API
// เวลา/เวอร์ชัน: 2025-09-08 19:45 (Asia/Bangkok) 
// หน้าที่ไฟล์: Dashboard แสดง KPI, Top Types, Trend 7 วัน, Recent + Export CSV
// แก้ไข: แก้ Data mapping, Date format, API error handling
// ============================================================

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

// คีย์/อีเมล
const getKey = () =>
  (localStorage.getItem("approver_key") || String(import.meta.env.VITE_APPROVER_KEY || "")).trim();
const getRequester = () =>
  (localStorage.getItem("admin_requester_email") || String(import.meta.env.VITE_APPROVER_EMAIL || "")).trim();

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

async function fetchJsonSmart(url: string) {
  const useProxy = isProxyUrl(url);
  const init: RequestInit = useProxy
    ? { method: "GET" }
    : {
        method: "GET",
        headers: (() => {
          const h: Record<string, string> = {};
          const key = getKey();
          const req = getRequester();
          if (key) h["x-api-key"] = key;
          if (req) h["x-requester-email"] = req;
          return h;
        })(),
      };
  
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  
  // Debug logging
  console.log("API Response:", { url, status: res.status, ok: res.ok, data });
  
  return { ok: res.ok, status: res.status, data, text };
}

// **แก้ไข Date handling**
function tsToMillis(v: any): number | null {
  if (v === undefined || v === null) return null;
  
  // Handle Firestore Timestamp
  if (typeof v === "object" && v._seconds) {
    return v._seconds * 1000 + (v._nanoseconds ? Math.floor(v._nanoseconds / 1e6) : 0);
  }
  
  // Handle number (assume Unix timestamp)
  if (typeof v === "number") {
    // If it's already in milliseconds
    if (v > 1e12) return v;
    // If it's in seconds, convert to milliseconds
    return v * 1000;
  }
  
  // Handle string dates
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  
  return null;
}

const toTime = (v?: number | string | any) => (v === undefined ? null : tsToMillis(v));

// **แก้ไข Date comparison สำหรับ KPI**
const isSameLocalDay = (t: number, base = Date.now()) => {
  const d1 = new Date(t);
  const d2 = new Date(base);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const withinDays = (t: number, days: number, base = Date.now()) => {
  const diff = base - t;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

// **แก้ไข Date formatting - ใช้ภาษาไทย**
const toDateLabel = (v?: number | string | any) => {
  const n = toTime(v);
  if (n == null) return "-";
  
  const date = new Date(n);
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit", 
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
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

// **แก้ไข Data extraction - เพิ่ม debug เต็มรูปแบบ**
function extractItems(data: any): any[] {
  console.log("=== EXTRACTING ITEMS ===");
  console.log("Raw API data structure:", JSON.stringify(data, null, 2));
  
  if (!data) return [];
  
  // ลองหลายรูปแบบที่เป็นไปได้
  let items: any[] = [];
  
  if (Array.isArray(data.items)) {
    items = data.items;
    console.log("Found items in data.items");
  } else if (Array.isArray(data.data?.items)) {
    items = data.data.items;
    console.log("Found items in data.data.items");
  } else if (Array.isArray(data.requests)) {
    items = data.requests;
    console.log("Found items in data.requests");
  } else if (Array.isArray(data.data?.requests)) {
    items = data.data.requests;
    console.log("Found items in data.data.requests");
  } else if (Array.isArray(data.data)) {
    items = data.data;
    console.log("Found items in data.data");
  } else if (Array.isArray(data)) {
    items = data;
    console.log("Found items in root array");
  } else {
    // ถ้าเป็น object ที่มี key เดียว ลองดึงมา
    const keys = Object.keys(data);
    if (keys.length === 1 && Array.isArray(data[keys[0]])) {
      items = data[keys[0]];
      console.log(`Found items in data.${keys[0]}`);
    }
  }
  
  console.log(`Extracted ${items.length} items:`, items);
  
  // Debug แต่ละ item
  if (items.length > 0) {
    console.log("=== SAMPLE ITEM STRUCTURE ===");
    console.log("First item:", JSON.stringify(items[0], null, 2));
    
    if (items.length > 1) {
      console.log("Second item:", JSON.stringify(items[1], null, 2));
    }
  }
  
  return items;
}

// **แก้ไข Item normalization - ใช้ flat structure ตามข้อมูลจริง**
function normalizeItem(raw: any): RequestItem | null {
  console.log("=== NORMALIZING ITEM ===");
  console.log("Raw item:", JSON.stringify(raw, null, 2));
  
  if (!raw || typeof raw !== "object") {
    console.log("Invalid raw item, skipping");
    return null;
  }
  
  // ลอง rid หลายรูปแบบ
  const rid = String(
    raw.rid || 
    raw.requestId || 
    raw.id || 
    raw.RID ||
    raw.documentId ||
    ""
  ).trim();
  
  console.log("Available keys in raw item:", Object.keys(raw));
  console.log("RID candidates:", {
    rid: raw.rid,
    requestId: raw.requestId,
    id: raw.id,
    extracted: rid
  });
  
  if (!rid) {
    console.log("No valid RID found, skipping item");
    return null;
  }

  // **แก้ไข Status - ตาม API response จริง**
  let status = "pending";
  if (raw.status) {
    status = String(raw.status).trim().toLowerCase();
  } else if (raw.requestStatus) {
    status = String(raw.requestStatus).trim().toLowerCase();
  } else if (raw.approvalStatus) {
    status = String(raw.approvalStatus).trim().toLowerCase();
  }

  // **แก้ไข Requester - ใช้ flat fields ตาม API**
  console.log("Requester debug (flat fields):", {
    contractorName: raw.contractorName,
    requesterName: raw.requesterName,
    fullname: raw.fullname,
    name: raw.name,
    applicantName: raw.applicantName,
    submittedBy: raw.submittedBy
  });

  const requesterName = String(
    raw.contractorName ||                // จาก Console log เห็นมี contractorName
    raw.requesterName ||
    raw.fullname ||
    raw.name ||
    raw.applicantName ||
    raw.submittedBy ||
    raw.applicant ||
    raw.createdBy?.name ||
    raw.contact?.name ||
    // ลอง nested ด้วย (just in case)
    raw.requester?.fullname ||
    raw.requester?.name ||
    ""
  ).trim();

  const company = String(
    raw.contractorCompany ||
    raw.requesterCompany ||
    raw.company ||
    raw.requester?.company ||
    ""
  ).trim();

  // **แก้ไข Work type - ใช้ flat fields ตาม API**
  console.log("Work debug (flat fields):", {
    workType: raw.workType,
    jobType: raw.jobType,
    permitType: raw.permitType,
    type: raw.type,
    category: raw.category,
    workCategory: raw.workCategory
  });

  const workType = String(
    raw.workType ||                      // จาก Console log น่าจะมี workType
    raw.jobType ||
    raw.permitType ||
    raw.type ||
    raw.category ||
    raw.workCategory ||
    // ลอง nested ด้วย (just in case)
    raw.work?.type ||
    raw.work?.category ||
    ""
  ).trim() || "ไม่ระบุ";

  console.log("Final extracted values:", {
    rid,
    status,
    requesterName,
    company,
    workType
  });

  return {
    id: rid,
    rid,
    status,
    createdAt: toTime(raw.createdAt || raw.createdDate || raw.submittedAt),
    approvedAt: toTime(raw.approvedAt || raw.approvedDate),
    rejectedAt: toTime(raw.rejectedAt || raw.rejectedDate),
    updatedAt: toTime(raw.updatedAt || raw.lastModified || raw.modifiedAt),
    requester: { 
      fullname: requesterName || undefined, 
      company: company || undefined,
      name: requesterName || undefined
    },
    work: { 
      type: workType, 
      category: workType
    },
  };
}

// ---------- คอมโพเนนต์หลัก ----------
export default function Dashboard() {
  const [rows, setRows] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [userCount, setUserCount] = useState<number | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  // โหลดรายการคำขอ
  useEffect(() => {
    let alive = true;
    (async () => {
      console.log("Loading requests...");
      
      if (!PROXY_LIST_URL && !DIRECT_LIST_URL) {
        setError("ยังไม่ได้ตั้งค่า URL รายการคำขอ");
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError("");
      
      try {
        let finalData: any = null;
        let finalError = "";

        // ลอง Proxy ก่อน
        if (PROXY_LIST_URL) {
          try {
            const proxyUrl = addQuery(PROXY_LIST_URL, { 
              limit: 500, 
              key: getKey() || undefined, 
              requester: getRequester() || undefined 
            });
            console.log("Trying proxy URL:", proxyUrl);
            const resProxy = await fetchJsonSmart(proxyUrl);
            
            if (resProxy.ok && resProxy.data) {
              finalData = resProxy.data;
              console.log("Proxy success:", finalData);
            } else {
              finalError = resProxy.text || `Proxy failed (${resProxy.status})`;
              console.log("Proxy failed:", finalError);
            }
          } catch (e: any) {
            finalError = e?.message || "Proxy error";
            console.log("Proxy error:", e);
          }
        }

        // ถ้า Proxy ล้ม ลอง Direct
        if (!finalData && DIRECT_LIST_URL) {
          try {
            const directUrl = addQuery(DIRECT_LIST_URL, { limit: 500 });
            console.log("Trying direct URL:", directUrl);
            const resDirect = await fetchJsonSmart(directUrl);
            
            if (resDirect.ok && resDirect.data) {
              finalData = resDirect.data;
              finalError = "";
              console.log("Direct success:", finalData);
            } else {
              finalError = resDirect.text || `Direct failed (${resDirect.status})`;
              console.log("Direct failed:", finalError);
            }
          } catch (e: any) {
            finalError = e?.message || "Direct error";
            console.log("Direct error:", e);
          }
        }

        if (!finalData) {
          setRows([]);
          setError(finalError || "ไม่สามารถโหลดข้อมูลได้");
          return;
        }

        const items = extractItems(finalData);
        console.log("Extracted items:", items);
        
        const safe: RequestItem[] = items
          .map(normalizeItem)
          .filter((x: any): x is RequestItem => !!x);

        console.log("Normalized items:", safe);

        // เรียงตาม updatedAt
        safe.sort((a, b) => {
          const ta = toTime(a.approvedAt) ?? toTime(a.rejectedAt) ?? toTime(a.updatedAt) ?? toTime(a.createdAt) ?? 0;
          const tb = toTime(b.approvedAt) ?? toTime(b.rejectedAt) ?? toTime(b.updatedAt) ?? toTime(b.createdAt) ?? 0;
          return (tb as number) - (ta as number);
        });

        setRows(safe);
      } catch (e: any) {
        console.error("Load error:", e);
        setRows([]);
        setError(/Failed to fetch/i.test(String(e)) ? "เชื่อมต่อไม่ได้ (CORS/เครือข่าย)" : (e?.message || "เกิดข้อผิดพลาด"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // โหลดจำนวนผู้ใช้
  useEffect(() => {
    let alive = true;
    (async () => {
      console.log("Loading users...");
      setUsersLoading(true);
      setUsersError("");
      
      if (!PROXY_ADMINS_URL && !DIRECT_ADMINS_URL) {
        setUsersError("ยังไม่ได้ตั้งค่า URL รายชื่อผู้ใช้");
        setUserCount(0);
        setUsersLoading(false);
        return;
      }

      try {
        let finalData: any = null;
        let finalError = "";

        // ลอง Proxy ก่อน
        if (PROXY_ADMINS_URL) {
          try {
            const proxyUrl = addQuery(PROXY_ADMINS_URL, { 
              key: getKey() || undefined, 
              requester: getRequester() || undefined 
            });
            const resProxy = await fetchJsonSmart(proxyUrl);
            
            if (resProxy.ok && resProxy.data) {
              finalData = resProxy.data;
            } else {
              finalError = `Proxy users failed (${resProxy.status})`;
            }
          } catch (e: any) {
            finalError = e?.message || "Proxy users error";
          }
        }

        // ถ้า Proxy ล้ม ลอง Direct
        if (!finalData && DIRECT_ADMINS_URL) {
          try {
            const resDirect = await fetchJsonSmart(DIRECT_ADMINS_URL);
            
            if (resDirect.ok && resDirect.data) {
              finalData = resDirect.data;
              finalError = "";
            } else {
              finalError = `Direct users failed (${resDirect.status})`;
            }
          } catch (e: any) {
            finalError = e?.message || "Direct users error";
          }
        }

        if (!finalData) {
          setUsersError(finalError || "ไม่สามารถโหลดรายชื่อผู้ใช้ได้");
          setUserCount(0);
          return;
        }

        const items: any[] = extractItems(finalData);
        setUserCount(items.length || 0);
        setUsersError("");
        
      } catch (e: any) {
        console.error("Users load error:", e);
        setUsersError(/Failed to fetch/i.test(String(e)) ? "เชื่อมต่อไม่ได้" : (e?.message || "เกิดข้อผิดพลาด"));
        setUserCount(0);
      } finally {
        if (alive) {
          setUsersLoading(false);
        }
      }
    })();
    return () => { alive = false; };
  }, []);

  // **แก้ไข KPI calculation**
  const now = Date.now();
  const stats = useMemo(() => {
    console.log("Calculating stats for rows:", rows);
    
    let pending = 0, approvedToday = 0, rejected7d = 0;
    
    for (const r of rows || []) {
      const status = (r?.status || "").toLowerCase();
      console.log(`Processing ${r.rid}: status=${status}`);
      
      // Pending count
      if (status !== "approved" && status !== "rejected") {
        pending++;
      }
      
      // Approved today
      if (status === "approved") {
        const approveTime = toTime(r.approvedAt) ?? toTime(r.updatedAt) ?? toTime(r.createdAt);
        console.log(`${r.rid} approved time:`, approveTime, approveTime ? new Date(approveTime) : null);
        
        if (approveTime !== null && isSameLocalDay(approveTime, now)) {
          approvedToday++;
          console.log(`${r.rid} approved today!`);
        }
      }
      
      // Rejected in 7 days
      if (status === "rejected") {
        const rejectTime = toTime(r.rejectedAt) ?? toTime(r.updatedAt) ?? toTime(r.createdAt);
        console.log(`${r.rid} rejected time:`, rejectTime, rejectTime ? new Date(rejectTime) : null);
        
        if (rejectTime !== null && withinDays(rejectTime, 7, now)) {
          rejected7d++;
          console.log(`${r.rid} rejected within 7 days!`);
        }
      }
    }
    
    const result = { pending, approvedToday, rejected7d };
    console.log("Final stats:", result);
    return result;
  }, [rows, now]);

  // ---------- ประเภทงานยอดนิยม ----------
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

  // ---------- แนวโน้ม 7 วัน ----------
  const trend = useMemo(() => {
    const days = 7;
    const labels: string[] = [];
    const counts: number[] = new Array(days).fill(0);
    const base = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
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

  // ---------- Export CSV ----------
  const handleExportCsv = () => {
    const recent = Array.isArray(rows) ? rows.slice(0, 100) : [];
    const header = ["RID", "ผู้ยื่น", "ประเภทงาน", "สถานะ", "วันที่ยื่น/อัปเดตล่าสุด"];
    const lines = [header.join(",")];

    for (const r of recent) {
      const requester = r?.requester?.fullname || r?.requester?.name || r?.requester?.company || "-";
      const type = r?.work?.type || r?.work?.category || "ไม่ระบุ";
      const t = r?.createdAt ?? r?.updatedAt ?? r?.approvedAt ?? r?.rejectedAt;
      const dateStr = toDateLabel(t);
      const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
      lines.push([r.rid, requester, type, r.status || "-", dateStr].map(esc).join(","));
    }

    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const now = new Date();
    const ts = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `recent-requests-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ---------- DataGrid ----------
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
      valueGetter: (_value, row) => {
        const name = row?.requester?.fullname || row?.requester?.name || row?.requester?.company || "-";
        console.log(`Requester for ${row.rid}:`, name, row.requester);
        return name;
      },
    },
    {
      field: "workType",
      headerName: "ประเภทงาน",
      minWidth: 140,
      flex: 1,
      valueGetter: (_value, row) => {
        const type = row?.work?.type || row?.work?.category || "ไม่ระบุ";
        console.log(`Work type for ${row.rid}:`, type, row.work);
        return type;
      },
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
              document.body.appendChild(a);
              a.click();
              a.remove();
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
  return (
    <Box sx={{ p: 2 }}>
      
      {/* หัวข้อ + ปุ่ม */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => location.reload()}>
            รีโหลด
          </Button>
          <Button size="small" variant="outlined" onClick={handleExportCsv}>
            Export CSV
          </Button>
          <Button component={RouterLink} to="/admin/permits" size="small">
            ดูทั้งหมด
          </Button>
        </Stack>
      </Stack>

      {/* KPI การ์ด */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
          mb: 2,
        }}
      >
        <KpiCard 
          icon={<PendingActionsIcon color="warning" />} 
          title="Pending Permits" 
          subtitle="ที่รออนุมัติ" 
          value={stats.pending} 
        />
        <KpiCard 
          icon={<CheckCircleOutlineIcon color="success" />} 
          title="Approved Today" 
          subtitle="อนุมัติวันนี้" 
          value={stats.approvedToday} 
        />
        <KpiCard 
          icon={<CancelOutlinedIcon color="error" />} 
          title="Rejected (7d)" 
          subtitle="ปฏิเสธใน 7 วัน" 
          value={stats.rejected7d} 
        />
        <KpiCard 
          icon={<PeopleAltOutlinedIcon color="primary" />} 
          title="Total Users" 
          subtitle={usersLoading ? "กำลังโหลด..." : "ผู้ใช้งานทั้งหมด"} 
          value={userCount ?? 0} 
          hint={usersError ? `⚠ ${usersError}` : undefined}
          loading={usersLoading}
        />
      </Box>

      {/* Top types + Trend */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2,
          mb: 2,
        }}
      >
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700}>Top Permit Types</Typography>
            {topTypes.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                ยังไม่มีข้อมูลประเภทงาน
              </Typography>
            ) : (
              <Stack spacing={1.25} sx={{ mt: 2 }}>
                {topTypes.map((it, idx) => {
                  const max = topTypes[0]?.count || 1;
                  const percent = Math.max(4, Math.round((it.count / max) * 100));
                  return (
                    <Box key={idx}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>{it.type}</Typography>
                        <Typography variant="body2" color="text.secondary">{it.count}</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={percent} />
                    </Box>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700}>Requests Trend (7 วัน)</Typography>
            <Box sx={{ mt: 1.5, width: "100%" }}>
              <svg viewBox={`0 0 ${trend.W} ${trend.H}`} width="100%" height={trend.H}>
                <polyline
                  points={`12,${trend.H - trend.PADY} ${trend.W - trend.PADX},${trend.H - trend.PADY}`}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <polyline
                  points={trend.points}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
                {trend.counts.map((v, i) => {
                  const x = 12 + (i * (trend.W - trend.PADX * 2)) / (trend.counts.length - 1);
                  const min = 0, max = Math.max(1, ...trend.counts);
                  const y = trend.H - trend.PADY - ((v - min) / (max - min)) * (trend.H - trend.PADY * 2);
                  return <circle key={i} cx={x} cy={y} r="3" fill="#3b82f6" />;
                })}
              </svg>
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                {trend.labels.map((lb, i) => (
                  <Typography key={i} variant="caption" color="text.secondary">{lb}</Typography>
                ))}
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ตารางล่าสุด */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ pb: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Recent Requests ({rows.length} รายการ)
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => location.reload()}>
                รีโหลด
              </Button>
              <Button size="small" variant="outlined" onClick={handleExportCsv}>
                Export CSV
              </Button>
              <Button size="small" component={RouterLink} to="/admin/permits">
                ดูทั้งหมด
              </Button>
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
            localeText={{
              noRowsLabel: error ? `เกิดข้อผิดพลาด: ${error}` : "ยังไม่มีข้อมูล",
            }}
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