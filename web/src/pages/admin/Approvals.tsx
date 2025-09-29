// ======================================================================
// File: web/src/pages/admin/Approvals.tsx
// เวอร์ชัน: 29/09/2025 22:25 (Asia/Bangkok)
// หน้าที่: หน้า Approvals — ดึงรายการคำขอ + เติมรายละเอียด โดย "ยืนยันตัวตนด้วย ID Token"
// เชื่อม auth ผ่าน "อะแดปเตอร์": Firebase Web Auth (getIdToken) → แนบ Authorization: Bearer <ID_TOKEN>
// การเปลี่ยนแปลงรอบนี้ (ถาวร):
//   1) ปิดการ override ค่า URL จาก Local Storage ใน production (อ่านจาก .env เป็นหลัก)
//      - อนุญาตอ่าน Local Storage เฉพาะโหมด DEV เพื่อเทสเร็วเท่านั้น
//   2) ปรับตัวตรวจ .env (envCheck) ให้ยึดตามข้อ 1 และกันค่าตัวอย่าง (<cloud-run-url>) หลุดเข้า fetch
// หมายเหตุ: Vite เปิดให้เข้าถึงตัวแปรแวดล้อมฝั่ง client ผ่าน import.meta.env.* (ต้องขึ้นต้น VITE_)
//          และ Cloud Run ฝั่ง end-user auth ให้แนบ ID Token ในหัว Authorization: Bearer …
//          อ้างอิง: Vite env docs, Cloud Run end-user auth docs, Firebase verify ID token docs
//          (ดูคอมเมนต์อ้างอิงในคำอธิบายขั้นตอน)
// ======================================================================

console.info("[Approvals TWO-PHASE][ID-TOKEN MODE][NO LS OVERRIDE IN PROD] running");

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Paper, Box, Typography, TextField, InputAdornment, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, LinearProgress, Stack, Button,
  ToggleButton, ToggleButtonGroup, Divider, Badge, Alert
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import BugReportIcon from "@mui/icons-material/BugReport";

// สิทธิ์/ตัวห่อ UI เดิม
import useAuthzLive from "../../hooks/useAuthzLive";
import { hasCap, isSuperadmin } from "../../lib/hasCap";
import CapBlock from "../../components/CapBlock";
import CapButton from "../../components/CapButton";

// Firebase Auth (ดึง ID Token)
import { getAuth } from "firebase/auth";

// ---------- ชนิดข้อมูล ----------
type PermitRow = {
  rid: string;
  requesterName?: string;
  company?: string;
  jobType?: string;
  status?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
  approvedAt?: number | string;
  rejectedAt?: number | string;
};

// ======================================================================
// ค่าช่วยตรวจ .env และการอ่านค่า (ถาวร: ไม่มี LS override ใน prod)
// ======================================================================
const IS_DEV = !!(import.meta as any).env?.DEV;

type EnvCheck = { ok: boolean; errors: string[]; messages: string[]; env: Record<string, string>; };

const REQUIRED_VARS = [
  "VITE_GET_REQUEST_ADMIN_URL",
  "VITE_LIST_REQUESTS_URL",
  "VITE_LIST_LOGS_URL",
  "VITE_UPDATE_STATUS_URL",
  "VITE_DECISION_PORTAL_URL",
  "VITE_LIST_ADMINS_URL",
  "VITE_ADD_ADMIN_URL",
  "VITE_UPDATE_ADMIN_ROLE_URL",
  "VITE_REMOVE_ADMIN_URL",
  "VITE_INVITE_ADMIN_URL",
];
const OPTIONAL_VARS = ["VITE_APPROVER_EMAIL"];

// map ใช้เฉพาะตอน DEV เพื่อเทสเร็ว
const LS_MAP: Record<string, string> = {
  VITE_LIST_REQUESTS_URL: "list_url",
  VITE_GET_REQUEST_ADMIN_URL: "details_url",
  VITE_APPROVER_EMAIL: "admin_requester_email",
};

function isPlaceholder(s?: string): boolean {
  if (!s) return true;
  const lower = s.toLowerCase();
  return /<.+>/.test(s) || lower.includes("example.com") || lower.includes("<cloud-run-url>") || /\[(url|key)\]/.test(lower);
}
function isValidUrl(u?: string): boolean {
  if (!u) return false;
  try { const x = new URL(u); return !!x.protocol && !!x.host; } catch { return false; }
}

/** อ่านค่าจาก .env เป็นหลัก; อนุญาตอ่าน Local Storage เฉพาะตอน DEV เท่านั้น */
function readEnvVar(name: string): string | undefined {
  // 1) จาก .env
  const raw = (import.meta as any).env?.[name] as string | undefined;
  if (raw && !isPlaceholder(raw)) {
    const v = raw.trim();
    if (name.startsWith("VITE_")) return v;
  }
  // 2) DEV เท่านั้น: อนุญาต LS (เทสเฉพาะเครื่อง)
  if (IS_DEV) {
    const lsKey = LS_MAP[name];
    if (lsKey) {
      try {
        const ls = globalThis.localStorage?.getItem(lsKey);
        if (ls && !isPlaceholder(ls)) {
          const v = ls.trim();
          // เฉพาะ URL ต้องเป็น http(s) ที่ valid
          if (!name.endsWith("_EMAIL")) {
            if (!/^https?:\/\//i.test(v) || !isValidUrl(v)) return undefined;
          }
          return v;
        }
      } catch { /* ignore */ }
    }
  }
  return undefined;
}

function validateAdminEnvInline(): EnvCheck {
  const env: Record<string, string> = {};
  const errors: string[] = [];
  const messages: string[] = [];

  for (const key of REQUIRED_VARS) {
    const val = readEnvVar(key);
    if (!val || !isValidUrl(val)) errors.push(key);
    else env[key] = val;
  }
  for (const key of OPTIONAL_VARS) {
    const val = readEnvVar(key);
    if (val) env[key] = val;
  }

  if (errors.length) {
    messages.push("⚠️ ระบบยังตั้งค่า URL บางรายการไม่ครบ/ไม่ถูกต้อง:");
    for (const e of errors) messages.push(`• ${e} — กรุณาตั้งค่าใน .env (โหมด DEV เท่านั้นที่อ่าน Local Storage ได้)`);
    messages.push("");
    if (IS_DEV) {
      messages.push("วิธีเทสแบบเร็ว (เฉพาะ DEV/เครื่องนี้):");
      messages.push("1) เปิด DevTools → Console แล้วพิมพ์");
      messages.push("   localStorage.setItem('list_url', 'https://listrequests-xxxx.run.app')");
      messages.push("   localStorage.setItem('details_url', 'https://getrequestadmin-xxxx.run.app')");
      messages.push("2) รีเฟรชหน้า แล้วลองใหม่");
      messages.push("");
    }
    messages.push("วิธีถาวร: เพิ่มค่าใน web/.env.* แล้ว build/deploy ใหม่ (แนะนำ).");
  }

  return { ok: errors.length === 0, errors, messages, env };
}

// ---------- Helpers: URL/Email ----------
function getListUrl(): string {
  // อ่านจาก .env เป็นหลัก; DEV เท่านั้นที่ยอมรับ LS
  return (
    readEnvVar("VITE_LIST_REQUESTS_URL") ||
    readEnvVar("VITE_LIST_REQUESTS_ADMIN_URL") || // เผื่อมีตัวนี้
    ""
  );
}
function getDetailsUrl(): string {
  const ds = readEnvVar("VITE_GET_REQUEST_ADMIN_URL");
  if (ds) return ds;
  const lu = getListUrl();
  try {
    // เดาเส้น get จาก list (กรณีตั้งชื่อบริการตามแพทเทิร์น)
    if (lu.includes("listRequests")) return lu.replace("listRequests", "getRequestAdmin");
  } catch { /* ignore */ }
  return "";
}
function getRequesterEmail(): string {
  // อนุญาต LS เฉพาะ DEV
  return readEnvVar("VITE_APPROVER_EMAIL") || "";
}

// ---------- เวลา/ฟอร์แมต ----------
function tsToMillis(v: any): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") {
    const abs = Math.abs(v);
    if (abs < 1e11) return v * 1000;
    if (abs < 1e13) return v;
    if (abs < 1e16) return Math.floor(v / 1e3);
    return Math.floor(v / 1e6);
  }
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
    const n = Number(v);
    if (Number.isFinite(n)) return tsToMillis(n);
    return undefined;
  }
  if (typeof v === "object") {
    if (typeof v._seconds === "number") {
      return v._seconds * 1000 + Math.round((v._nanoseconds || 0) / 1e6);
    }
    if (typeof v.seconds === "number") {
      return v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6);
    }
    if (typeof v.toDate === "function") return v.toDate().getTime();
  }
  return undefined;
}
function fmtDate(v?: number | string) {
  const ms = tsToMillis(v);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("th-TH", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}
const squash = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();

function normalizeOne(x: any): PermitRow | null {
  const rid = squash(x?.rid || x?.requester?.rid || x?.docId || x?.id || "");
  if (!rid) return null;
  const requesterName =
    squash(x?.requester?.fullname || x?.requester?.name || x?.employee || x?.contractorName || "") || undefined;
  const company = squash(x?.requester?.company || x?.company || "");
  const jobType = squash(x?.work?.type || x?.work?.location?.type || x?.jobType || x?.type || "");
  const createdAt = tsToMillis(x?.createdAt) ?? tsToMillis(x?.created_at) ?? tsToMillis(x?.created) ?? undefined;
  const updatedAt = tsToMillis(x?.updatedAt) ?? tsToMillis(x?.updated_at) ?? undefined;
  const approvedAt = tsToMillis(x?.approvedAt) ?? tsToMillis(x?.decision?.decidedAt) ?? undefined;
  const rejectedAt = tsToMillis(x?.rejectedAt) ?? tsToMillis(x?.decision?.decidedAt) ?? undefined;
  const status = squash(x?.status || x?.decision?.status || "pending");
  return { rid, requesterName, company, jobType, createdAt, updatedAt, approvedAt, rejectedAt, status };
}
function normalizeStatus(input?: string): "approved" | "rejected" | "pending" {
  const s = String(input || "").toLowerCase();
  if (!s) return "pending";
  if (s === "รออนุมัติ" || s.includes("รออนุมัติ") || s.includes("pending") || s.includes("waiting") || s.includes("รอ") || s.includes("submitted")) return "pending";
  if (s.includes("approve") || s.includes("อนุมัติ") || s === "approved" || s === "accept") return "approved";
  if (s.includes("reject") || s.includes("ปฏิเสธ") || s === "rejected" || s === "deny") return "rejected";
  return "pending";
}

// ======================================================================
// Fetch โดย "แนบ ID Token" (Authorization: Bearer …) — ถ้าผู้ใช้ยังไม่ล็อกอิน → โยน error
// ======================================================================
async function withIdTokenHeaders(extra?: HeadersInit) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน (ไม่พบผู้ใช้ปัจจุบัน)");
  const idToken = await user.getIdToken(false);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`,
  };
  const requester = getRequesterEmail();
  if (requester) headers["x-requester-email"] = requester;
  return { ...headers, ...(extra as Record<string, string>) };
}

async function fetchRequests(options: {
  status?: string;
  limit?: number;
  signal?: AbortSignal;
  url?: string;
} = {}): Promise<PermitRow[]> {
  const url = options.url || getListUrl();
  if (!url) throw new Error("ไม่พบ LIST URL — กรุณาตั้งค่าใน .env");

  const requester = getRequesterEmail();
  const u = new URL(url);
  u.searchParams.set("limit", String(options.limit || 300));
  if (options.status && options.status !== "all") u.searchParams.set("status", options.status);

  let json: any | undefined;
  let method = "unknown";

  try {
    method = "POST";
    const res = await fetch(url, {
      method: "POST",
      headers: await withIdTokenHeaders(),
      body: JSON.stringify({
        requester,
        status: options.status === "all" ? undefined : options.status,
        sort: "latest",
        page: 1,
        pageSize: options.limit || 300,
      }),
      signal: options.signal,
    });
    if (res.ok) json = await res.json();
    else {
      method = "GET";
      const res2 = await fetch(u.toString(), {
        method: "GET",
        headers: await withIdTokenHeaders(),
        signal: options.signal,
      });
      if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
      json = await res2.json();
    }
  } catch {
    method = "GET (fallback)";
    const res2 = await fetch(u.toString(), {
      method: "GET",
      headers: await withIdTokenHeaders(),
      signal: options.signal,
    });
    if (!res2.ok) throw new Error(`HTTP ${res2.status} - ${res2.statusText}`);
    json = await res2.json();
  }

  const rawItems: any[] = Array.isArray(json)
    ? json
    : Array.isArray(json?.data) ? json.data
    : Array.isArray(json?.items) ? json.items
    : Array.isArray(json?.data?.items) ? json.data.items
    : Array.isArray(json?.results) ? json.results
    : [];

  const normalized = rawItems.map(normalizeOne).filter(Boolean) as PermitRow[];
  return normalized;
}

async function hydrateRowsWithDetails(
  rows: PermitRow[],
  options: { signal?: AbortSignal; concurrency?: number; detailsUrl?: string } = {}
): Promise<PermitRow[]> {
  const detailsUrl = options.detailsUrl || getDetailsUrl();
  if (!detailsUrl || rows.length === 0) return rows;

  const out = [...rows];
  const limit = options.concurrency || 5;
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
        signal: options.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      const x = j?.data?.request || j?.data || j?.request || j?.item || j;

      const requesterName =
        x?.requester?.fullname ?? x?.requester?.name ?? x?.employee ?? x?.contractorName ?? r.requesterName;
      const company = x?.requester?.company ?? x?.company ?? r.company;
      const jobType = x?.work?.type ?? x?.work?.location?.type ?? x?.jobType ?? r.jobType;

      out[idx] = { ...r, requesterName, company, jobType };
    } catch (error) {
      console.warn("Hydration failed for", r.rid, ":", error);
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

// ---------- Export CSV ----------
function exportCsv(filename: string, rows: PermitRow[]) {
  const headers = ["RID", "ผู้ยื่น", "บริษัท", "ประเภทงาน", "สถานะ", "วันที่ยื่น", "วันที่อัปเดต"];
  const esc = (x: any) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        esc(r.rid),
        esc(r.requesterName ?? ""),
        esc(r.company ?? ""),
        esc(r.jobType ?? ""),
        esc(r.status ?? ""),
        esc(fmtDate(r.createdAt)),
        esc(fmtDate(r.updatedAt)),
      ].join(",")
    );
  }
  const csvWithBom = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function StatusChip({ value }: { value?: string }) {
  const val = normalizeStatus(value);
  const label = val === "approved" ? "อนุมัติ" : val === "rejected" ? "ไม่อนุมัติ" : "รออนุมัติ";
  const color = val === "approved" ? "success" : val === "rejected" ? "error" : "warning";
  return <Chip label={label} color={color as any} variant="filled" size="small" />;
}

// ======================================================================
// คอมโพเนนต์หลัก
// ======================================================================
export default function Approvals() {
  const [rows, setRows] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrating, setHydrating] = useState(false);
  const [error, setError] = useState<string>("");
  const [debugMode, setDebugMode] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "pending" | "approved" | "rejected">("pending");

  const live = useAuthzLive() ?? {};
  const canViewApprovals =
    isSuperadmin(live.role) ||
    hasCap(live.caps, "approve_requests", live.role) ||
    hasCap(live.caps, "review_requests", live.role) ||
    hasCap(live.caps, "view_permits", live.role) ||
    hasCap(live.caps, "view_all", live.role);
  const canExport =
    isSuperadmin(live.role) ||
    hasCap(live.caps, "export", live.role) ||
    hasCap(live.caps, "view_reports", live.role);

  const aliveRef = useRef(false);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  const envCheck = useMemo(() => validateAdminEnvInline(), []);

  async function load(signal?: AbortSignal) {
    setError("");
    setLoading(true);

    try {
      if (!canViewApprovals) { setRows([]); return; }

      // ตรวจว่าล็อกอินหรือยัง
      if (!getAuth().currentUser) {
        throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน (ไม่พบผู้ใช้ปัจจุบัน)");
      }

      // P1: ดึงลิสต์
      const list = await fetchRequests({
        status: undefined,
        limit: 500,
        signal,
        url: getListUrl(),
      });
      if (!aliveRef.current) return;

      list.sort(
        (a, b) =>
          (tsToMillis(b.updatedAt) || tsToMillis(b.createdAt) || 0) -
          (tsToMillis(a.updatedAt) || tsToMillis(a.createdAt) || 0)
      );
      setRows(list);

      // P2: เติมดีเทลถ้าจำเป็น
      const needHydrate = list.some((r) => !r.requesterName || !r.jobType || r.jobType === "-");
      if (needHydrate) {
        setHydrating(true);
        const hydrated = await hydrateRowsWithDetails(list, {
          signal,
          concurrency: 5,
          detailsUrl: getDetailsUrl(),
        });
        if (!aliveRef.current) return;
        hydrated.sort(
          (a, b) =>
            (tsToMillis(b.updatedAt) || tsToMillis(b.createdAt) || 0) -
            (tsToMillis(a.updatedAt) || tsToMillis(a.createdAt) || 0)
        );
        setRows(hydrated);
      }
    } catch (e: any) {
      const msg = (e?.message || "").toString();
      if (e?.name === "AbortError" || /abort/i.test(msg)) {
        // do nothing
      } else if (aliveRef.current) {
        setError(msg || "เกิดข้อผิดพลาดขณะโหลดข้อมูล");
      }
    } finally {
      if (aliveRef.current) { setLoading(false); setHydrating(false); }
    }
  }

  useEffect(() => {
    if (!envCheck.ok) return;
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewApprovals, envCheck.ok]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, approved: 0, rejected: 0 } as {
      all: number; pending: number; approved: number; rejected: number;
    };
    for (const r of rows) c[normalizeStatus(r.status)]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows || [])
      .filter((r) => (statusFilter === "all" ? true : normalizeStatus(r.status) === statusFilter))
      .filter((r) => {
        if (!term) return true;
        const name = (r.requesterName || r.company || "").toLowerCase();
        const type = (r.jobType || "").toLowerCase();
        return r.rid.toLowerCase().includes(term) || name.includes(term) || type.includes(term);
      });
  }, [rows, q, statusFilter]);

  const isSuper = isSuperadmin(live.role);

  if (!envCheck.ok) {
    return (
      <Box>
        <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
          Approvals (ตั้งค่าไม่ครบ)
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            พบการตั้งค่าบางรายการว่าง/ไม่ถูกต้อง จึงยังไม่ดึงข้อมูลจากเซิร์ฟเวอร์
          </Alert>
          <Box sx={{ color: "text.primary", lineHeight: 1.7 }}>
            {envCheck.messages.map((m, i) => (<Typography key={i}>{m}</Typography>))}
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box><Typography variant="h6" fontWeight={800}>Approvals (รออนุมัติ)</Typography></Box>
        <Stack direction="row" spacing={1}>
          {isSuper && (
            <IconButton size="small" onClick={() => setDebugMode(!debugMode)} color={debugMode ? "primary" : "default"}>
              <BugReportIcon />
            </IconButton>
          )}
          <CapButton
            anyOf={["export", "view_reports"]}
            variant="outlined" size="small"
            onClick={() => exportCsv(`approvals_${new Date().toISOString().slice(0, 10)}.csv`, filtered)}
            disabled={!canExport}
          >
            Export CSV
          </CapButton>
          <Button variant="contained" size="small" onClick={() => { const ac = new AbortController(); load(ac.signal); }}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <CapBlock
        anyOf={["approve_requests", "review_requests", "view_permits", "view_all"]}
        deniedText="คุณไม่มีสิทธิ์ดูรายการคำขอ (ต้องมีสิทธิ์ approve/review หรือ view_permits)"
      >
        {debugMode && isSuper && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="caption" component="div">
              📊 <strong>Debug Info:</strong><br />
              • Total Rows: {rows.length}<br />
              • Filtered: {filtered.length}<br />
              • Counts: P:{counts.pending} A:{counts.approved} R:{counts.rejected}<br />
              • Status Filter: {statusFilter}<br />
              • List URL source: .env {IS_DEV ? "(DEV: อนุญาต LS เทส)" : "(PROD: ไม่ใช้ LS)"}<br />
              • Requester Email: {getRequesterEmail() ? "✅" : "⚠️"}<br />
              • Search: "{q}"
            </Typography>
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              fullWidth size="small" placeholder="ค้นหา: RID / ชื่อผู้ยื่น / ประเภทงาน"
              value={q} onChange={(e) => setQ(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRoundedIcon /></InputAdornment>) }}
            />
            <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", sm: "block" } }} />
            <ToggleButtonGroup exclusive size="small" value={statusFilter} onChange={(_, v) => v && setStatusFilter(v)}>
              <ToggleButton value="pending"><Badge color="warning" badgeContent={counts.pending} max={999}>Pending</Badge></ToggleButton>
              <ToggleButton value="approved"><Badge color="success" badgeContent={counts.approved} max={999}>Approved</Badge></ToggleButton>
              <ToggleButton value="rejected"><Badge color="error" badgeContent={counts.rejected} max={999}>Rejected</Badge></ToggleButton>
              <ToggleButton value="all"><Badge color="primary" badgeContent={counts.all} max={999}>All</Badge></ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Paper>

        <Paper variant="outlined">
          {(loading || hydrating) && <LinearProgress />}
          {!loading && error && <Box sx={{ p: 2, color: "error.main", whiteSpace: "pre-wrap" }}>เกิดข้อผิดพลาด: {error}</Box>}
          {!loading && !error && filtered.length === 0 && (
            <Box sx={{ p: 2, color: "text.secondary" }}>
              {rows.length > 0 && statusFilter === "pending"
                ? `ขณะนี้ไม่มีคำขอสถานะ 'รออนุมัติ' (มีข้อมูลทั้งหมด ${rows.length} รายการ - ลองกด Approved/Rejected/All)`
                : rows.length > 0
                ? `ไม่พบรายการที่ตรงกับตัวกรอง "${statusFilter}" หรือคำค้นหา "${q}"`
                : "ไม่พบข้อมูลใดๆ - กรุณาตรวจสอบการตั้งค่า API"}
            </Box>
          )}

          {!loading && !error && filtered.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>RID</TableCell>
                    <TableCell>ผู้ยื่น</TableCell>
                    <TableCell>ประเภทงาน</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell>วันที่ยื่น/อัปเดต</TableCell>
                    <TableCell align="right">การทำงาน</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.rid} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{r.rid}</TableCell>
                      <TableCell>{r.requesterName || r.company || "-"}</TableCell>
                      <TableCell>{r.jobType || "-"}</TableCell>
                      <TableCell><StatusChip value={r.status} /></TableCell>
                      <TableCell>{fmtDate(r.updatedAt || r.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="เปิดดูรายละเอียด">
                            <IconButton component={Link as any} to={`/admin/permits/${encodeURIComponent(r.rid)}`} size="small">
                              <OpenInNewRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </CapBlock>
    </Box>
  );
}
