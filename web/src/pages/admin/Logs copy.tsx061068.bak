// ======================================================================
// File: web/src/pages/admin/Logs.tsx
// เวอร์ชัน: 29/09/2025 00:00 (Asia/Bangkok)
// หน้าที่: หน้า System Logs (ค้นหา/กรอง/Export) — เปลี่ยนเป็นยืนยันตัวตนด้วย "ID Token"
// เชื่อม auth ผ่าน "อะแดปเตอร์": ใช้ Firebase Auth (getAuth + getIdToken) แนบ Authorization: Bearer <ID_TOKEN>
// การเปลี่ยนแปลงรอบนี้ (จากไฟล์เดิม 2025-09-23 23:40):
//   - เลิกพึ่งพา approver_key และ localStorage 'admin_requester_email' ขณะดึงข้อมูล
//   - เพิ่มฟังก์ชัน authzHeaders(): สร้าง Header พร้อม Authorization: Bearer <ID_TOKEN> และ x-requester-email จาก user.email
//   - ปรับ fetchLogs() ให้ใช้ Header ใหม่นี้ และแจ้งเตือนหากยังไม่ล็อกอิน
//   - เก็บโค้ดเดิมไว้เป็นคอมเมนต์ // OLD: เพื่อย้อนกลับได้ง่าย
// หมายเหตุ:
//   - ถ้ายังไม่ได้ล็อกอิน ระบบจะขึ้นข้อความ "กรุณาเข้าสู่ระบบก่อนใช้งาน" และไม่ยิงคำขอ
//   - ฝั่งเซิร์ฟเวอร์ควรตรวจสอบ ID Token ตามมาตรฐาน Firebase Admin SDK/Cloud Run
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, TextField, Button, Select, MenuItem,
  Alert, InputLabel, FormControl, Chip, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CodeIcon from "@mui/icons-material/Code";

// 🔐 Firebase Auth: ใช้ดึงผู้ใช้และ ID Token
import { getAuth, getIdToken } from "firebase/auth";

// ---- CONFIG ----
const LIST_LOGS_URL = (import.meta.env.VITE_LIST_LOGS_URL as string) || "";

// key เก็บฟิลเตอร์ใน localStorage
const MEM_KEYS = {
  q: "logs_filter_q",
  from: "logs_filter_from",
  to: "logs_filter_to",
  action: "logs_filter_action",
};

// =======================
// 🔄 ตัวช่วย AUTH/REQUESTER (ใหม่)
// =======================

/** ดึงอีเมลผู้ที่ล็อกอิน (fallback ไป .env ถ้าจำเป็น เฉพาะแสดงผล/บันทึกฝั่งเซิร์ฟเวอร์) */
function getRequesterEmail(): string {
  const u = getAuth().currentUser;
  if (u?.email) return u.email;
  const fromEnv = (import.meta.env.VITE_APPROVER_EMAIL as string | undefined) || "";
  return fromEnv.trim();
}

/** สร้าง Header พร้อมแนบ ID Token (Authorization: Bearer …) + x-requester-email */
async function authzHeaders(): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน (ยังไม่พบผู้ใช้ที่ล็อกอิน)");
  }
  const idToken = await getIdToken(user); // ออก ID Token ปัจจุบัน
  const h: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };
  const requester = getRequesterEmail();
  if (requester) h["x-requester-email"] = requester;
  return h;
}

// =======================
// ⛔️ โค้ดเดิมที่เลิกใช้ (เก็บเป็นหลักฐานย้อนกลับได้)
// =======================
// OLD: อ่านค่าคีย์/อีเมลจาก localStorage -> .env
// const getKey = () =>
//   (localStorage.getItem("approver_key") || String(import.meta.env.VITE_APPROVER_KEY || "")).trim();
// const getRequester = () =>
//   (localStorage.getItem("admin_requester_email") || String(import.meta.env.VITE_APPROVER_EMAIL || "")).trim();
//
// OLD: header มาตรฐานเดิม (x-api-key)
// const hdr = (key: string, requester: string) => {
//   const h: Record<string, string> = {};
//   if (key) h["x-api-key"] = key;
//   if (requester) h["x-requester-email"] = requester;
//   return h;
// };


// เติม query
const withQuery = (
  baseUrl: string,
  params: Record<string, string | number | undefined | null>
) => {
  const u = new URL(baseUrl);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
};

/* ---------------- เวลา: แก้ปีเพี้ยน + รองรับ atMillis + สตริง UTC/GMT/ICT ---------------- */
// ทำให้สตริงวันที่อ่านง่ายขึ้นสำหรับ Date.parse()
function normalizeDateString(s: string): string {
  let t = String(s || "").trim();
  if (/ at /i.test(t)) t = t.replace(/ at /i, " "); // "at" → เว้นวรรค

  // แปลง "UTC +7" หรือ "UTC+7" หรือ "GMT+7" → "+07:00"
  const zone = t.match(/\b(UTC|GMT)\s*\+?(-?\d{1,2})\b/i);
  if (zone) {
    const num = parseInt(zone[2], 10);
    const sign = num >= 0 ? "+" : "-";
    const hh = String(Math.abs(num)).padStart(2, "0");
    t = t.replace(zone[0], `${sign}${hh}:00`);
  }

  // เคสย่อ "ICT" (เวลาไทย) → "+07:00"
  t = t.replace(/\bICT\b/g, "+07:00");

  return t;
}

// แปลงค่าหลากหลายรูปแบบ → milliseconds
function toMillis(v: any): number | null {
  if (v == null) return null;

  if (typeof v?.toMillis === "function") {
    try { return v.toMillis(); } catch {}
  }

  // โครงสร้าง seconds/nanoseconds แบบ Timestamp-plain
  if (typeof v === "object" && (typeof v.seconds === "number" || typeof v._seconds === "number")) {
    const sec = (v.seconds ?? v._seconds) as number;
    const ns  = (v.nanoseconds ?? v._nanoseconds ?? 0) as number;
    return sec * 1000 + Math.floor(ns / 1e6);
  }

  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  if (typeof v === "number") { // วินาที/มิลลิวินาที
    return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  }

  if (typeof v === "string") { // "20 September 2025 at 17:45:16 UTC+7"
    const parsed = Date.parse(normalizeDateString(v));
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

const fmtTime = (d: any) => {
  const m = typeof d === "number" ? d : toMillis(d);
  if (m == null) return "-";
  try {
    // ใช้ปฏิทินพุทธ + โซนไทย
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZone: "Asia/Bangkok",
    }).format(m);
  } catch {
    return new Date(m).toLocaleString("th-TH", { hour12: false, timeZone: "Asia/Bangkok" });
  }
};

// ---------------- ผู้ทำ: หาอีเมลแบบ fallback จากทุกมุม ----------------
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

// เดินหาอีเมลในอ็อบเจ็กต์แบบลึกไม่เกิน 3 ชั้น
function findEmailDeep(obj: any, depth = 0): string | undefined {
  if (!obj || depth > 3) return undefined;
  if (typeof obj === "string" && EMAIL_RE.test(obj)) return obj.match(EMAIL_RE)?.[0] || undefined;
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const f = findEmailDeep(it, depth + 1);
      if (f) return f;
    }
    return undefined;
  }
  if (typeof obj === "object") {
    const hot = (obj as any).email || (obj as any).byEmail || (obj as any).adminEmail ||
                (obj as any).userEmail || (obj as any).requester || (obj as any).requesterEmail;
    if (typeof hot === "string" && EMAIL_RE.test(hot)) return hot.match(EMAIL_RE)?.[0];
    for (const v of Object.values(obj)) {
      const f = findEmailDeep(v, depth + 1);
      if (f) return f;
    }
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

  const anyEmail = findEmailDeep(x) || findEmailDeep(x.raw);
  return anyEmail || "-";
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

/* ---------- UA parser (ย่อ) ---------- */
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
  else if (/samsungbrowser\//i.test(l)) { browser = "Samsung"; version = pick(/samsungbrowser\/(\d+)/i.exec(l)); }
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

/* ---------- ชนิดข้อมูลหลัง normalize ---------- */
type Row = {
  id?: string;
  at?: any;
  atMillis?: any; // รองรับฝั่งฟังก์ชันที่ส่ง atMillis มา
  by: string;
  action: string;
  target: string;
  note?: string;
  ip?: string;
  ua?: string;
  method?: string;
  raw?: any; // เก็บดิบไว้เปิดใน Dialog
};
const normalize = (x: any): Row => ({
  id: x.id,
  // เวลา: รองรับหลายฟิลด์ (มี atMillis มาก่อน)
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

/* ---------- ตัวช่วย: ดึง millis จากทั้ง row และ raw ---------- */
function pickMillisFromRow(r: any): number | null {
  return (
    toMillis(r?.atMillis) ??
    toMillis(r?.at) ??
    toMillis(r?.timestamp) ??
    toMillis(r?.createdAt) ??
    // มองเข้าไปใน raw ด้วย (กันข้อมูลเก่า/ไม่สม่ำเสมอ)
    toMillis(r?.raw?.atMillis) ??
    toMillis(r?.raw?.at) ??
    toMillis(r?.raw?.timestamp) ??
    toMillis(r?.raw?.createdAt) ??
    null
  );
}

/* ---------- CSV ---------- */
function rowsToCSV(rows: Row[]): string {
  const header = ["time", "actor", "action", "target", "note", "ip", "ua", "method"];
  const esc = (s: any) => {
    const str = (s ?? "").toString();
    const needsQuote = /[\",\n]/.test(str);
    const inner = str.replace(/\"/g, "\"\"");
    return needsQuote ? `"${inner}"` : inner;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    const ms = pickMillisFromRow(r);
    lines.push([
      esc(fmtTime(ms)),
      esc(r.by),
      esc(r.action),
      esc(r.target),
      esc(r.note),
      esc(r.ip ?? ""),
      esc(r.ua ?? ""),
      esc(r.method ?? ""),
    ].join(","));
  }
  return lines.join("\n");
}
function downloadCSV(content: string, filename = "system-logs.csv") {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ===================== Component ===================== */
export default function Logs() {
  // ฟิลเตอร์หลัก (โหลดจากความจำครั้งแรก)
  const [q, setQ] = useState<string>(() => localStorage.getItem(MEM_KEYS.q) || "");
  const [from, setFrom] = useState<string>(() => localStorage.getItem(MEM_KEYS.from) || "");
  const [to,   setTo]   = useState<string>(() => localStorage.getItem(MEM_KEYS.to) || "");
  const [action, setAction] = useState<string>(() => localStorage.getItem(MEM_KEYS.action) || "");

  // สถานะโหลด/ข้อผิดพลาด/ข้อมูล
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  // คัดลอก + แจ้งเตือน
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({ open: false, msg: "" });

  // Dialog ดูดิบ
  const [openRaw, setOpenRaw] = useState(false);
  const [rawRow, setRawRow] = useState<Row | null>(null);

  // บันทึกฟิลเตอร์ทุกครั้งที่เปลี่ยน
  useEffect(() => { localStorage.setItem(MEM_KEYS.q, q || ""); }, [q]);
  useEffect(() => { localStorage.setItem(MEM_KEYS.from, from || ""); }, [from]);
  useEffect(() => { localStorage.setItem(MEM_KEYS.to, to || ""); }, [to]);
  useEffect(() => { localStorage.setItem(MEM_KEYS.action, action || ""); }, [action]);

  // โหลดครั้งแรก
  useEffect(() => { fetchLogs(); /* eslint-disable-next-line */ }, []);

  async function fetchLogs() {
    if (!LIST_LOGS_URL) return setErr("ยังไม่ได้ตั้งค่า VITE_LIST_LOGS_URL");

    setLoading(true);
    setErr(null);
    try {
      // ต้องล็อกอินก่อนเสมอ (เพื่อออก ID Token)
      const user = getAuth().currentUser;
      if (!user) {
        throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
      }

      const qFrom = from ? new Date(from).toISOString() : undefined;
      const qTo   = to   ? new Date(to).toISOString()   : undefined;

      const url = withQuery(LIST_LOGS_URL, {
        q: q || undefined,
        from: qFrom, to: qTo,
        action: action || undefined,
        orderBy: "at", orderDir: "desc",
        // ส่ง requester เป็น query เพิ่มเติม (ช่วยฝั่งบันทึก/ตรวจสอบ)
        requester: getRequesterEmail() || undefined,
      });

      const res = await fetch(url, {
        method: "GET",
        headers: await authzHeaders(),
        mode: "cors",
      });

      const text = await res.text();

      if (res.status === 401) throw new Error("401 Unauthorized — กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("403 Forbidden — บัญชีนี้ยังไม่มีสิทธิ์ audit_log");

      let json: any = {};
      try { json = JSON.parse(text); } catch {}
      const items: any[] =
        (Array.isArray(json?.data?.items) && json.data.items) ||
        (Array.isArray(json?.items) && json.items) ||
        (Array.isArray(json) && json) ||
        [];
      setRows(items.map(normalize));
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const handleExport = () => {
    if (rows.length === 0) return;
    const csv = rowsToCSV(rows);
    downloadCSV(csv, "system-logs.csv");
  };

  const handleClear = () => {
    setQ(""); setFrom(""); setTo(""); setAction("");
    localStorage.removeItem(MEM_KEYS.q);
    localStorage.removeItem(MEM_KEYS.from);
    localStorage.removeItem(MEM_KEYS.to);
    localStorage.removeItem(MEM_KEYS.action);
    fetchLogs();
  };

  // คัดลอกข้อความ
  async function copyText(text?: string | null, label = "คัดลอกแล้ว") {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setSnack({ open: true, msg: label });
  }

  // สีของ action เป็น Chip
  const renderActionChip = (val?: string) => {
    const a = String(val || "-").toLowerCase();
    const map: Record<string, any> = {
      create: "success",
      update: "info",
      delete: "error",
      status: "warning",
      login: "secondary",
    };
    const color = map[a] || "default";
    return <Chip size="small" label={val || "-"} color={color as any} variant="outlined" />;
  };

  // ตารางแบบ DataGrid — วิธี A: valueGetter (ms), valueFormatter (แสดงผล), sortComparator เป็นเลข
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "at",
        headerName: "เวลา",
        minWidth: 200,
        type: "number",
        valueGetter: (_value, row) => pickMillisFromRow(row) ?? 0,
        valueFormatter: ({ value }) => fmtTime(value as number),
        sortComparator: (a, b) => (Number(a ?? 0) - Number(b ?? 0)),
        renderCell: (p) => <Typography variant="body2">{fmtTime(p.value)}</Typography>,
      },
      { field: "by", headerName: "ผู้ทำ", minWidth: 220, flex: 1, valueGetter: (_v, r) => r.by || "-" },
      {
        field: "action",
        headerName: "Action",
        minWidth: 160,
        renderCell: (p) => renderActionChip(String(p.row?.action || "-")),
        sortable: false,
      },
      {
        field: "target",
        headerName: "Target",
        minWidth: 260,
        flex: 1,
        renderCell: (p) => {
          const txt = String(p.row?.target || "-");
          return (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%", overflow: "hidden" }}>
              <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {txt}
              </Typography>
              {txt !== "-" && (
                <Tooltip title="คัดลอก Target">
                  <IconButton size="small" onClick={() => copyText(txt, "คัดลอก Target แล้ว")}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          );
        },
      },
      {
        field: "note",
        headerName: "Note",
        minWidth: 200,
        flex: 1,
        renderCell: (p) =>
          p.value ? <Typography variant="body2">{String(p.value)}</Typography> :
          <Typography variant="body2" color="text.secondary">-</Typography>,
      },
      {
        field: "ip",
        headerName: "IP",
        minWidth: 190,
        renderCell: (p) => {
          const ip = String(p.row?.ip || "-");
          return (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{ip}</Typography>
              {ip !== "-" && (
                <Tooltip title="คัดลอก IP">
                  <IconButton size="small" onClick={() => copyText(ip, "คัดลอก IP แล้ว")}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          );
        },
      },
      { field: "ua", headerName: "อุปกรณ์/วิธีการ", minWidth: 220, flex: 1, valueGetter: (_v, r) => formatUA(r.ua, r.method) },
      {
        field: "tools",
        headerName: "เครื่องมือ",
        minWidth: 120,
        sortable: false,
        filterable: false,
        renderCell: (p) => (
          <Tooltip title="ดูข้อมูลดิบ">
            <IconButton
              size="small"
              onClick={() => { setRawRow(p.row); setOpenRaw(true); }}
            >
              <CodeIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    []
  );

  const gridRows = useMemo(() => rows.map((r, i) => ({ ...r, __id: r.id ?? `row-${i}` })), [rows]);

  return (
    <Box sx={{ p: 2, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        System Logs
      </Typography>

      <Card variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="action / ผู้ทำ / target / note / ip ..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              fullWidth
            />
            <TextField
              label="จากวันที่"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />
            <TextField
              label="ถึงวันที่"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 180 }}
            />
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel id="action-label">action (ทั้งหมด)</InputLabel>
              <Select
                labelId="action-label"
                label="action (ทั้งหมด)"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <MenuItem value="">ทั้งหมด</MenuItem>
                <MenuItem value="create">create</MenuItem>
                <MenuItem value="update">update</MenuItem>
                <MenuItem value="delete">delete</MenuItem>
                <MenuItem value="status">status</MenuItem>
                <MenuItem value="login">login</MenuItem>
              </Select>
            </FormControl>

            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={fetchLogs} disabled={loading}>
                {loading ? "Loading..." : "ค้นหา"}
              </Button>
              <Button variant="outlined" onClick={handleExport} disabled={rows.length === 0}>
                Export CSV
              </Button>
              <Button variant="text" onClick={handleClear}>
                เคลียร์
              </Button>
            </Stack>
          </Stack>

          {!!err && <Alert severity="error" sx={{ mt: 2, whiteSpace: "pre-wrap" }}>{err}</Alert>}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ height: 560, p: 1 }}>
          <DataGrid
            rows={gridRows}
            columns={columns}
            getRowId={(r) => r.__id}
            disableRowSelectionOnClick
            loading={loading}
            localeText={{
              noRowsLabel: loading ? "กำลังโหลด…" : "— ไม่มีรายการ —",
            }}
            initialState={{
              pagination: { paginationModel: { pageSize: 100, page: 0 } },
              sorting: { sortModel: [{ field: "at", sort: "desc" }] },
            }}
            pageSizeOptions={[25, 50, 100, 200]}
          />
        </CardContent>
      </Card>

      {/* Dialog แสดง JSON ดิบ */}
      <Dialog open={openRaw} onClose={() => setOpenRaw(false)} maxWidth="md" fullWidth>
        <DialogTitle>ข้อมูลดิบ (Raw JSON)</DialogTitle>
        <DialogContent dividers>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {rawRow ? JSON.stringify(rawRow.raw ?? rawRow, null, 2) : "-"}
          </pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRaw(false)}>ปิด</Button>
          <Button
            variant="outlined"
            onClick={() => copyText(JSON.stringify(rawRow?.raw ?? rawRow ?? {}, null, 2), "คัดลอก JSON แล้ว")}
          >
            คัดลอก JSON
          </Button>
        </DialogActions>
      </Dialog>

      {/* แจ้งเตือนคัดลอก */}
      <Snackbar
        open={snack.open}
        autoHideDuration={1800}
        onClose={() => setSnack({ open: false, msg: "" })}
        message={snack.msg}
      />
    </Box>
  );
}
// ======================================================================
