// ======================================================================
// File: web/src/pages/admin/Logs.tsx
// เวอร์ชัน: 2025-10-22
// เรื่อง: แก้ import guard ให้เข้ากันได้กับหลายชื่อ (useCurrentAdminGuard / useAdminPermissions / usePageGuard / default)
// พร้อมคง UI แท็บแบบ "เม็ดยา" + แปลไทย + Export CSV + Dialog JSON
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, TextField, Button, Select, MenuItem,
  Alert, InputLabel, FormControl, Chip, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, CircularProgress, Tabs, Tab, Badge,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeIcon from "@mui/icons-material/Code";
import { getAuth, getIdToken } from "firebase/auth";

// 🔧 เปลี่ยนเป็น import แบบ namespace เพื่อรองรับชื่อ hook หลายแบบ
import * as AdminPerms from "../../hooks/useAdminPermissions";

// ---------------- ENV ----------------
const LIST_LOGS_URL = (import.meta.env.VITE_LIST_LOGS_URL as string) || "";

// ---------------- LocalStorage keys ----------------
const MEM_KEYS = {
  q: "logs_filter_q",
  from: "logs_filter_from",
  to: "logs_filter_to",
  action: "logs_filter_action",
  tab: "logs_tab_key",
};

// ---------------- Auth helpers ----------------
function getRequesterEmail(): string {
  const u = getAuth().currentUser;
  if (u?.email) return u.email;
  const fromEnv = (import.meta.env.VITE_APPROVER_EMAIL as string | undefined) || "";
  return fromEnv.trim();
}

async function authzHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const idToken = await getIdToken(user, forceRefresh);
  const h: Record<string, string> = { Authorization: `Bearer ${idToken}` };
  const requester = getRequesterEmail();
  if (requester) h["x-requester-email"] = requester;
  return h;
}

const withQuery = (baseUrl: string, params: Record<string, string | number | undefined | null>) => {
  const u = new URL(baseUrl);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === "") return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
};

// ---------------- Date helpers ----------------
function normalizeDateString(s: string): string {
  let t = String(s || "").trim();
  if (/ at /i.test(t)) t = t.replace(/ at /i, " ");
  const zone = t.match(/\b(UTC|GMT)\s*\+?(-?\d{1,2})\b/i);
  if (zone) {
    const num = parseInt(zone[2], 10);
    const sign = num >= 0 ? "+" : "-";
    const hh = String(Math.abs(num)).padStart(2, "0");
    t = t.replace(zone[0], `${sign}${hh}:00`);
  }
  t = t.replace(/\bICT\b/g, "+07:00");
  return t;
}
function toMillis(v: any): number | null {
  if (v == null) return null;
  if (typeof v?.toMillis === "function") { try { return v.toMillis(); } catch {} }
  if (typeof v === "object" && (typeof v.seconds === "number" || typeof v._seconds === "number")) {
    const sec = (v.seconds ?? v._seconds) as number;
    const ns  = (v.nanoseconds ?? v._nanoseconds ?? 0) as number;
    return sec * 1000 + Math.floor(ns / 1e6);
  }
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  if (typeof v === "number") return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  if (typeof v === "string") {
    const parsed = Date.parse(normalizeDateString(v));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
const fmtTime = (d: any) => {
  const m = typeof d === "number" ? d : toMillis(d);
  if (m == null) return "-";
  try {
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZone: "Asia/Bangkok",
    }).format(m);
  } catch {
    return new Date(m).toLocaleString("th-TH", { hour12: false, timeZone: "Asia/Bangkok" });
  }
};

// ---------------- render helpers ----------------
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
function findEmailDeep(obj: any, depth = 0): string | undefined {
  if (!obj || depth > 3) return undefined;
  if (typeof obj === "string" && EMAIL_RE.test(obj)) return obj.match(EMAIL_RE)?.[0] || undefined;
  if (Array.isArray(obj)) { for (const it of obj) { const f = findEmailDeep(it, depth + 1); if (f) return f; } return undefined; }
  if (typeof obj === "object") {
    const hot = (obj as any).email || (obj as any).byEmail || (obj as any).adminEmail ||
                (obj as any).userEmail || (obj as any).requester || (obj as any).requesterEmail;
    if (typeof hot === "string" && EMAIL_RE.test(hot)) return hot.match(EMAIL_RE)?.[0];
    for (const v of Object.values(obj)) { const f = findEmailDeep(v, depth + 1); if (f) return f; }
  }
  return undefined;
}
function renderBySmart(x: any): string {
  const by = x.by ?? x.actor ?? x.user ?? x.requester ?? { email: x.adminEmail ?? x.email };
  if (typeof by === "string") return by || "-";
  const fromBy =
    by?.email || by?.byEmail || by?.adminEmail || by?.userEmail || by?.requesterEmail ||
    by?.extra?.email || by?.name || by?.userName;
  if (fromBy) return String(fromBy);
  const target = x.target ?? x.rid ?? x.requestId ?? x.id;
  if (typeof target === "string" && target.startsWith("auth:")) {
    const after = target.slice("auth:".length);
    if (EMAIL_RE.test(after)) return after;
  }
  return findEmailDeep(x) || findEmailDeep(x.raw) || "-";
}
const renderTarget = (target: any): string => {
  if (!target) return "-";
  if (typeof target === "string") return target || "-";
  const type = (target as any).type || (target as any).targetType;
  const rid  = (target as any).rid;
  const id   = (target as any).id || (target as any).targetId || (target as any).documentId;
  if (type && (rid || id)) return `${type}:${rid || id}`;
  return String(rid || id || type || "-");
};
const normalizeIp = (x: any): string | undefined =>
  x?.ip ?? x?.clientIp ?? x?.remoteIp ?? x?.request_ip ?? x?.extra?.ip ?? undefined;

type ParsedUA = { browser?: string; version?: string; os?: string };
function parseUA(ua?: string | null): ParsedUA {
  if (!ua) return {};
  const s = ua;
  const l = ua.toLowerCase();
  const os =
    /windows nt/i.test(s) ? "Windows" :
    /android/i.test(s) ? "Android" :
    /(iphone|ipad|ipod)/i.test(s) ? "iOS" :
    /mac os x/i.test(s) ? "macOS" :
    /cros/i.test(s) ? "ChromeOS" :
    /linux/i.test(s) ? "Linux" : undefined;

  let browser: string | undefined; let version: string | undefined;
  const pick = (m: RegExpExecArray | null) => (m ? m[1] : undefined);
  if (/edg\//i.test(l)) { browser = "Edge"; version = pick(/edg\/(\d+)/i.exec(l)); }
  else if (/firefox\//i.test(l)) { browser = "Firefox"; version = pick(/firefox\/(\d+)/i.exec(l)); }
  else if (/(chrome|crios)\//i.test(l)) { browser = "Chrome"; version = pick(/(?:chrome|crios)\/(\d+)/i.exec(l)); }
  else if (/safari/i.test(l)) { browser = "Safari"; version = pick(/version\/(\d+)/i.exec(l)) || pick(/safari\/(\d+)/i.exec(l)); }
  return { browser, version, os };
}
function formatUA(ua?: string | null, method?: string | null): string {
  const p = parseUA(ua);
  const b = p.browser ? (p.version ? `${p.browser} ${p.version}` : p.browser) : (ua ? "unknown" : "-");
  const os = p.os ? ` (${p.os})` : "";
  const m = method ? ` • ${String(method).toUpperCase()}` : "";
  return `${b}${os}${m}`;
}

// ---------------- Row normalize ----------------
type Row = {
  id?: string; at?: any; atMillis?: any;
  by: string; action: string; target: string;
  note?: string; ip?: string; ua?: string; method?: string; raw?: any;
};
const normalize = (x: any): Row => ({
  id: x.id,
  at: x.at ?? x.atMillis ?? x.createdAt ?? x.timestamp ?? x.time ?? x.date,
  atMillis: x.atMillis ?? undefined,
  by: renderBySmart(x),
  action: x.action ?? x.event ?? x.type ?? "-",
  target: renderTarget(x.target ?? x.rid ?? x.requestId ?? x.id),
  note: x.note ?? x.reason ?? x.message ?? "",
  ip: normalizeIp(x),
  ua: x.ua ?? x.userAgent ?? x.details?.ua ?? x.extra?.ua ?? undefined,
  method: x.method ?? x.httpMethod ?? x.details?.method ?? x.extra?.method ?? undefined,
  raw: x,
});
function toMillisFromRow(r: any): number | null {
  return (
    toMillis(r?.atMillis) ?? toMillis(r?.at) ?? toMillis(r?.timestamp) ?? toMillis(r?.createdAt) ??
    toMillis(r?.raw?.atMillis) ?? toMillis(r?.raw?.at) ?? toMillis(r?.raw?.timestamp) ?? toMillis(r?.raw?.createdAt) ?? null
  );
}

// ---------------- Action mapping (ไทย) + Tabs ----------------
const ACTION_THAI: Record<string, string> = {
  login: "เข้าสู่ระบบ",
  create: "สร้าง",
  update: "แก้ไขข้อมูล",
  edit: "แก้ไขข้อมูล",
  delete: "ลบ",
  remove: "ลบ",
  export: "ส่งออก",
  download: "ดาวน์โหลด",
  status: "เปลี่ยนสถานะ",
  status_update: "ปรับสถานะ",
  status_update_reject: "ปรับสถานะ: ไม่อนุมัติ",
  status_update_approve: "ปรับสถานะ: อนุมัติ",
  get_request: "ดึงคำขอ",
  get_request_admin: "เปิดคำขอในผู้ดูแล",
  get_request_list: "ดึงรายการคำขอ",
  view_request: "ดูคำขอ",
  open_request: "เปิดคำขอ",
  audit: "บันทึกระบบ",
  config_change: "เปลี่ยนค่าระบบ",
  permission_change: "เปลี่ยนสิทธิ์",
};
type TabKey = "all" | "login" | "request" | "status" | "update" | "delete" | "export" | "system" | "other";
type TabDef = { key: TabKey; label: string; actions: readonly string[] };
const TAB_DEFS: ReadonlyArray<TabDef> = [
  { key: "all",    label: "ทั้งหมด",       actions: [] },
  { key: "login",  label: "เข้าสู่ระบบ",   actions: ["login"] },
  { key: "request",label: "คำขอ/ดูคำขอ",  actions: ["get_request_admin", "get_request", "view_request", "open_request"] },
  { key: "status", label: "อัปเดตสถานะ",  actions: ["status", "status_update", "status_update_reject", "status_update_approve"] },
  { key: "update", label: "แก้ไขข้อมูล",   actions: ["update", "edit"] },
  { key: "delete", label: "ลบ",            actions: ["delete", "remove"] },
  { key: "export", label: "ส่งออก",        actions: ["export", "download"] },
  { key: "system", label: "ระบบ",          actions: ["audit", "config_change", "permission_change"] },
  { key: "other",  label: "อื่น ๆ",        actions: [] },
];
function toKey(a?: string | null) { return String(a || "").trim().toLowerCase(); }
function actionToThai(a?: string | null) { const k = toKey(a); return ACTION_THAI[k] || (k ? k.replaceAll("_", " ") : "-"); }
function getActionGroup(a?: string | null): TabKey {
  const k = toKey(a);
  if (!k || k === "-") return "other";
  for (const t of TAB_DEFS) {
    if (t.key === "all" || t.key === "other") continue;
    if (t.actions.length && t.actions.includes(k)) return t.key;
    if (t.key === "request" && (k.includes("request") || k.startsWith("get_request"))) return "request";
    if (t.key === "status"  && (k.startsWith("status") || k.includes("status_update"))) return "status";
  }
  return "other";
}
const GROUP_COLOR: Record<TabKey, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
  all: "default", login: "secondary", request: "info", status: "warning", update: "primary", delete: "error", export: "success", system: "default", other: "default",
};
const pillSxFor = (key: TabKey) => (theme: any) => {
  const palettes: Record<TabKey, any> = {
    all: theme.palette.grey, login: theme.palette.secondary, request: theme.palette.info, status: theme.palette.warning,
    update: theme.palette.primary, delete: theme.palette.error, export: theme.palette.success, system: theme.palette.grey, other: theme.palette.grey,
  };
  const pal = palettes[key] || theme.palette.grey;
  const selBg = pal.main || theme.palette.grey[900];
  const selFg = pal.contrastText || theme.palette.common.white;
  return {
    textTransform: "none", fontWeight: 600, borderRadius: 999, minHeight: 36, px: 1, mr: 1, alignItems: "center",
    border: "1px solid", borderColor: theme.palette.divider, color: theme.palette.text.primary,
    "& .MuiBadge-badge": { fontWeight: 600 },
    "&:hover": { backgroundColor: theme.palette.action.hover },
    "&.Mui-selected": {
      backgroundColor: selBg, color: selFg, borderColor: selBg, boxShadow: "0 2px 10px rgba(0,0,0,.12)",
      "& .MuiBadge-badge": { backgroundColor: selFg, color: selBg },
    },
  };
};

// ---------------- CSV ----------------
function rowsToCSV(rows: Row[]): string {
  const header = ["time", "actor", "action_thai", "target", "note", "ip", "ua", "method"];
  const esc = (s: any) => {
    const str = (s ?? "").toString();
    const needsQuote = /[\",\n]/.test(str);
    const inner = str.replace(/\"/g, "\"\"");
    return needsQuote ? `"${inner}"` : inner;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    const ms = toMillisFromRow(r);
    lines.push([ esc(fmtTime(ms)), esc(r.by), esc(actionToThai(r.action)), esc(r.target), esc(r.note), esc(r.ip ?? ""), esc(r.ua ?? ""), esc(r.method ?? "") ].join(","));
  }
  return lines.join("\n");
}
function downloadCSV(content: string, filename = "system-logs.csv") {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ======================================================================
// Component
// ======================================================================
export default function Logs() {
  // 🔒 Guard (compat): รองรับหลายชื่อ hook ในโปรเจกต์จริง
  const useGuard =
    (AdminPerms as any).useCurrentAdminGuard ||
    (AdminPerms as any).useAdminPermissions ||
    (AdminPerms as any).usePageGuard ||
    (AdminPerms as any).default;

  const guardRes = useGuard ? useGuard() : { loading: false, error: undefined, role: "superadmin", has: () => true };
  const permLoading: boolean = !!guardRes.loading;
  const permError: string | undefined = guardRes.error;
  const role: string | undefined = guardRes.role;
  const has: (section: string, perm: string) => boolean = guardRes.has || (() => true);

  const canView = has("logs", "canView") || role === "superadmin";

  // ----- filters -----
  const [q, setQ] = useState<string>(() => localStorage.getItem(MEM_KEYS.q) || "");
  const [from, setFrom] = useState<string>(() => localStorage.getItem(MEM_KEYS.from) || "");
  const [to,   setTo]   = useState<string>(() => localStorage.getItem(MEM_KEYS.to) || "");
  const [action, setAction] = useState<string>(() => localStorage.getItem(MEM_KEYS.action) || "");
  const [tab, setTab] = useState<TabKey>(() => (localStorage.getItem(MEM_KEYS.tab) as TabKey) || "all");

  useEffect(() => { localStorage.setItem(MEM_KEYS.tab, tab); }, [tab]);
  useEffect(() => { localStorage.setItem(MEM_KEYS.q, q || ""); }, [q]);
  useEffect(() => { localStorage.setItem(MEM_KEYS.from, from || ""); }, [from]);
  useEffect(() => { localStorage.setItem(MEM_KEYS.to, to || ""); }, [to]);
  useEffect(() => { localStorage.setItem(MEM_KEYS.action, action || ""); }, [action]);

  // ----- data -----
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({ open: false, msg: "" });
  const [openRaw, setOpenRaw] = useState(false);
  const [rawRow, setRawRow] = useState<Row | null>(null);

  useEffect(() => { if (canView) fetchLogs(); /* eslint-disable-next-line */ }, [canView]);

  async function fetchLogs() {
    if (!LIST_LOGS_URL) return setErr("ยังไม่ได้ตั้งค่า VITE_LIST_LOGS_URL");
    setLoading(true); setErr(null);
    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");

      const qFrom = from ? new Date(from).toISOString() : undefined;
      const qTo   = to   ? new Date(to).toISOString()   : undefined;

      const url = withQuery(LIST_LOGS_URL, {
        q: q || undefined, from: qFrom, to: qTo, action: action || undefined,
        orderBy: "at", orderDir: "desc", requester: getRequesterEmail() || undefined,
      });

      let res = await fetch(url, { method: "GET", headers: await authzHeaders(false), mode: "cors" });
      let text = await res.text();

      if (res.status === 401) {
        res = await fetch(url, { method: "GET", headers: await authzHeaders(true), mode: "cors" });
        text = await res.text();
      }
      if (res.status === 401) throw new Error("401 Unauthorized — กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("403 Forbidden — บัญชีนี้ยังไม่มีสิทธิ์ audit_log");

      let json: any = {};
      try { json = JSON.parse(text); } catch {}
      const items: any[] =
        (Array.isArray(json?.data?.items) && json.data.items) ||
        (Array.isArray(json?.items) && json.items) ||
        (Array.isArray(json) && json) || [];
      setRows(items.map(normalize));
    } catch (e: any) {
      setRows([]); setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // ----- counts & filter by tab -----
  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: 0, login: 0, request: 0, status: 0, update: 0, delete: 0, export: 0, system: 0, other: 0 };
    for (const r of rows) {
      const g = getActionGroup(r.action);
      counts[g] = (counts[g] || 0) + 1;
      counts.all += 1;
    }
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => (tab === "all" ? rows : rows.filter((r) => getActionGroup(r.action) === tab)), [rows, tab]);

  // ----- actions -----
  const handleExport = () => {
    if (filteredRows.length === 0) return;
    const csv = rowsToCSV(filteredRows);
    downloadCSV(csv, "system-logs.csv");
  };
  const handleClear = () => {
    setQ(""); setFrom(""); setTo(""); setAction("");
    localStorage.removeItem(MEM_KEYS.q);
    localStorage.removeItem(MEM_KEYS.from);
    localStorage.removeItem(MEM_KEYS.to);
    localStorage.removeItem(MEM_KEYS.action);
    if (canView) fetchLogs();
  };
  async function copyText(text?: string | null, label = "คัดลอกแล้ว") {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); ta.remove();
    }
    setSnack({ open: true, msg: label });
  }

  const renderActionChip = (val?: string) => {
    const group = getActionGroup(val);
    const color = GROUP_COLOR[group] || "default";
    return <Chip size="small" label={actionToThai(val)} color={color as any} variant="outlined" />;
  };

  // ----- table -----
  const columns: GridColDef[] = useMemo(() => [
    {
      field: "at", headerName: "เวลา", minWidth: 200, type: "number",
      valueGetter: (_v, row) => toMillisFromRow(row) ?? 0,
      valueFormatter: ({ value }) => fmtTime(value as number),
      sortComparator: (a, b) => (Number(a ?? 0) - Number(b ?? 0)),
      renderCell: (p) => <Typography variant="body2">{fmtTime(p.value)}</Typography>,
    },
    { field: "by", headerName: "ผู้ทำ", minWidth: 220, flex: 1, valueGetter: (_v, r) => r.by || "-" },
    { field: "action", headerName: "การกระทำ", minWidth: 180, renderCell: (p) => renderActionChip(String(p.row?.action || "-")), sortable: false },
    {
      field: "target", headerName: "เป้าหมาย", minWidth: 260, flex: 1,
      renderCell: (p) => {
        const txt = String(p.row?.target || "-");
        return (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%", overflow: "hidden" }}>
            <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{txt}</Typography>
            {txt !== "-" && (
              <Tooltip title="คัดลอกเป้าหมาย">
                <IconButton size="small" onClick={() => copyText(txt, "คัดลอก Target แล้ว")}><ContentCopyIcon fontSize="inherit" /></IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
    {
      field: "note", headerName: "หมายเหตุ", minWidth: 200, flex: 1,
      renderCell: (p) => p.value ? <Typography variant="body2">{String(p.value)}</Typography> : <Typography variant="body2" color="text.secondary">-</Typography>,
    },
    {
      field: "ip", headerName: "IP", minWidth: 190,
      renderCell: (p) => {
        const ip = String(p.row?.ip || "-");
        return (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
            <Typography variant="body2" sx={{ flex: 1 }}>{ip}</Typography>
            {ip !== "-" && (
              <Tooltip title="คัดลอก IP">
                <IconButton size="small" onClick={() => copyText(ip, "คัดลอก IP แล้ว")}><ContentCopyIcon fontSize="inherit" /></IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
    { field: "ua", headerName: "อุปกรณ์/วิธีการ", minWidth: 220, flex: 1, valueGetter: (_v, r) => formatUA(r.ua, r.method) },
    {
      field: "tools", headerName: "เครื่องมือ", minWidth: 120, sortable: false, filterable: false,
      renderCell: (p) => (
        <Tooltip title="ดูข้อมูลดิบ">
          <IconButton size="small" onClick={() => { setRawRow(p.row); setOpenRaw(true); }}><CodeIcon fontSize="inherit" /></IconButton>
        </Tooltip>
      ),
    },
  ], []);

  const gridRows = useMemo(() => filteredRows.map((r, i) => ({ ...r, __id: r.id ?? `row-${i}` })), [filteredRows]);

  // ----- guard renders -----
  if (permLoading) {
    return (
      <Box sx={{ p: 2, maxWidth: 960, mx: "auto" }}>
        <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={20} /><Typography>กำลังโหลดสิทธิ์…</Typography></Stack>
      </Box>
    );
  }
  if (permError && permError !== "disabled" && permError !== "not-found") {
    return <Box sx={{ p: 2, maxWidth: 960, mx: "auto" }}><Alert severity="error">เกิดข้อผิดพลาดในการตรวจสิทธิ์: {permError}</Alert></Box>;
  }
  if (!canView) {
    return (
      <Box sx={{ p: 2, maxWidth: 960, mx: "auto" }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>บันทึกระบบ (Logs)</Typography>
        <Alert severity="warning">⛔ คุณไม่มีสิทธิ์เข้าหน้านี้ (เฉพาะผู้มีสิทธิ์ดูบันทึกระบบ หรือ Super Admin)</Alert>
      </Box>
    );
  }

  // ----- main view -----
  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>บันทึกระบบ (Logs)</Typography>

      {/* Tabs: เม็ดยา */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
        <CardContent sx={{ pb: 0 }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" aria-label="tabs for action groups">
            {TAB_DEFS.map((t) => (
              <Tab
                key={t.key}
                value={t.key}
                sx={pillSxFor(t.key)}
                label={<Badge color="default" showZero badgeContent={tabCounts[t.key]}><span style={{ padding: "0 6px" }}>{t.label}</span></Badge>}
              />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField label="ค้นหา (การกระทำ/ผู้ทำ/เป้าหมาย/หมายเหตุ/IP ...)" value={q} onChange={(e) => setQ(e.target.value)} fullWidth />
            <TextField label="จากวันที่" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 180 }} />
            <TextField label="ถึงวันที่" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 180 }} />
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="action-label">การกระทำ (ทั้งหมด)</InputLabel>
              <Select labelId="action-label" label="การกระทำ (ทั้งหมด)" value={action} onChange={(e) => setAction(e.target.value)}>
                <MenuItem value="">ทั้งหมด</MenuItem>
                <MenuItem value="login">เข้าสู่ระบบ (login)</MenuItem>
                <MenuItem value="update">แก้ไขข้อมูล (update)</MenuItem>
                <MenuItem value="delete">ลบ (delete)</MenuItem>
                <MenuItem value="status">เปลี่ยนสถานะ (status)</MenuItem>
                <MenuItem value="create">สร้าง (create)</MenuItem>
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={fetchLogs} disabled={loading}>{loading ? "กำลังโหลด..." : "ค้นหา"}</Button>
              <Button variant="outlined" onClick={handleExport} disabled={filteredRows.length === 0}>ส่งออก CSV</Button>
              <Button variant="text" onClick={handleClear}>เคลียร์</Button>
            </Stack>
          </Stack>

          {!!err && <Alert severity="error" sx={{ mt: 2, whiteSpace: "pre-wrap" }}>{err}</Alert>}
        </CardContent>
      </Card>

      {/* Table */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ height: 560, p: 1 }}>
          <DataGrid
            rows={gridRows}
            columns={columns}
            getRowId={(r) => r.__id}
            disableRowSelectionOnClick
            loading={loading}
            localeText={{ noRowsLabel: loading ? "กำลังโหลด…" : "— ไม่มีรายการ —" }}
            initialState={{
              pagination: { paginationModel: { pageSize: 100, page: 0 } },
              sorting: { sortModel: [{ field: "at", sort: "desc" }] },
            }}
            pageSizeOptions={[25, 50, 100, 200]}
          />
        </CardContent>
      </Card>

      {/* Raw JSON dialog */}
      <Dialog open={openRaw} onClose={() => setOpenRaw(false)} maxWidth="md" fullWidth>
        <DialogTitle>ข้อมูลดิบ (Raw JSON)</DialogTitle>
        <DialogContent dividers>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {rawRow ? JSON.stringify(rawRow.raw ?? rawRow, null, 2) : "-"}
          </pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRaw(false)}>ปิด</Button>
          <Button variant="outlined" onClick={() => {
            const txt = JSON.stringify(rawRow?.raw ?? rawRow ?? {}, null, 2);
            navigator.clipboard.writeText(txt).then(() => setSnack({ open: true, msg: "คัดลอก JSON แล้ว" }));
          }}>คัดลอก JSON</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={1800} onClose={() => setSnack({ open: false, msg: "" })} message={snack.msg} />
    </Box>
  );
}
// ======================================================================
