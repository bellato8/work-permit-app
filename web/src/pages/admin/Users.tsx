// ======================================================================
// File: web/src/pages/admin/Users.tsx
// เวอร์ชัน: 29/09/2025 21:05 (Asia/Bangkok)
// หน้าที่: จัดการผู้ใช้แอดมิน (ดู/เพิ่ม/แก้สิทธิ์/ปิดเปิด/ลบ/เชิญ)
// เชื่อม auth ผ่าน "อะแดปเตอร์":
//   - Firebase Auth (getIdToken) → แนบ Authorization: Bearer <ID_TOKEN>
//   - โหมดเข้ากันได้ชั่วคราว: แนบ x-api-key (ถ้ามีใน .env/localStorage) + requester ทั้ง header+query
// เหตุผล: ระหว่างย้ายไปใช้ ID Token เต็มรูปแบบ ฝั่ง backend บางตัวอาจยังเช็ค x-api-key → กัน 403
// เอกสารอ้างอิง: Cloud Run end-user auth + verify Firebase ID token ฝั่งเซิร์ฟเวอร์
//   - https://cloud.google.com/run/docs/authenticating/end-users
//   - https://cloud.google.com/run/docs/tutorials/identity-platform
//   - https://firebase.google.com/docs/auth/admin/verify-id-tokens
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Container, Card, CardContent, CardActions, Paper, Typography, TextField,
  Button, Stack, Chip, Select, MenuItem, FormControl, InputLabel,
  Checkbox, FormControlLabel, IconButton, Tooltip, LinearProgress,
  Snackbar, Alert, Divider, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Skeleton, InputAdornment
} from "@mui/material";

import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import PowerSettingsNewRoundedIcon from "@mui/icons-material/PowerSettingsNewRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import useAuthzLive from "../../hooks/useAuthzLive";
import { hasCap, isSuperadmin } from "../../lib/hasCap";
import CapButton from "../../components/CapButton";
import CapBlock from "../../components/CapBlock";

// 🔐 Firebase — guard ให้แอปถูก initialize เสมอ ก่อนเรียก getAuth()
import { getApps, initializeApp } from "firebase/app";
try {
  if (typeof window !== "undefined" && getApps().length === 0) {
    initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    } as any);
    // console.debug("[Users][init] Firebase app initialized by Users.tsx");
  }
} catch (e) {
  // เงียบไว้ ถ้าโปรเจกต์คุณมีไฟล์ init ส่วนกลางอยู่แล้ว
  // console.warn("[Users][init] Firebase init guard error:", e);
}

// 🔐 Firebase Auth — ใช้ดึง user และ ID Token
import { getAuth, getIdToken, onAuthStateChanged } from "firebase/auth";

// ---------- ประเภทข้อมูล ----------
type Role = "superadmin" | "admin" | "approver" | "viewer";
type LegacyCaps = {
  approve?: boolean; reject?: boolean; delete?: boolean; export?: boolean;
  viewAll?: boolean; manageUsers?: boolean; settings?: boolean;
};
type NewCaps = {
  view_reports?: boolean; audit_log?: boolean; manage_master_data?: boolean;
  system_settings?: boolean; view_all?: boolean;
};
type Caps = LegacyCaps & NewCaps;
type AdminRow = {
  email: string;
  role: Role; caps: Caps; enabled?: boolean;
  name?: string; updatedBy?: string;
  updatedAt?: number | string | { _seconds?: number; _nanoseconds?: number };
};

// ---------- ค่าเริ่มต้นตามบทบาท ----------
const DEFAULT_CAPS_BY_ROLE: Record<Role, Caps> = {
  superadmin: { view_all: true, manageUsers: true, system_settings: true, view_reports: true, audit_log: true },
  admin:      { view_all: true, view_reports: true, audit_log: true },
  approver:   { view_all: false },
  viewer:     { view_all: false },
};

// ---------- URL ฟังก์ชัน ----------
const URLS = {
  list:   (import.meta.env.VITE_LIST_ADMINS_URL as string)        || "",
  add:    (import.meta.env.VITE_ADD_ADMIN_URL as string)          || "",
  update: (import.meta.env.VITE_UPDATE_ADMIN_ROLE_URL as string)  || "",
  remove: (import.meta.env.VITE_REMOVE_ADMIN_URL as string)       || "",
  invite: (import.meta.env.VITE_INVITE_ADMIN_URL as string)       || "",
};

// ======================================================================
// 🔄 AUTH HELPERS: Bearer + (Compat) x-api-key
// ======================================================================
/** คืนค่า approver_key (เฉพาะกรณีเป็น ASCII ล้วน) เพื่อกัน fetch ล่มบน Firefox */
function getLegacyKey(): string {
  try {
    const raw =
      (localStorage.getItem("approver_key") ||
        (import.meta.env.VITE_APPROVER_KEY as string) ||
        ""
      ).trim();

    // อนุญาตเฉพาะอักขระ ASCII ที่พิมพ์ได้เท่านั้น (0x20-0x7E)
    // กันเคสที่ใส่ข้อความไทยในคีย์ → ทำให้ fetch โยน ByteString error บน Firefox
    const isPrintableASCII = /^[\x20-\x7E]*$/.test(raw);
    return isPrintableASCII ? raw : "";
  } catch {
    return "";
  }
}

function currentRequesterEmail(): string {
  const u = getAuth().currentUser;
  if (u?.email) return u.email;
  const env = (import.meta.env.VITE_APPROVER_EMAIL as string | undefined) || "";
  return env.trim();
}

/** Header มาตรฐาน: Authorization (ID Token) + x-requester-email + (compat) x-api-key */
async function authzHeaders(): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const token = await getIdToken(user);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
  const requester = currentRequesterEmail();
  if (requester) headers["x-requester-email"] = requester;

  // โหมดเข้ากันได้: แนบ x-api-key เฉพาะเมื่อเป็น ASCII เท่านั้น
  const legacyKey = getLegacyKey();
  if (legacyKey) headers["x-api-key"] = legacyKey;

  // debug เบาๆ
  // console.debug("[Users][debug] authzHeaders()", { hasUser: !!user, email: requester, tokenLen: token?.length, hasApikey: !!legacyKey });

  return headers;
}

/** เติม requester(+key ถ้ามี) เป็น query กัน proxy ตัด header และช่วย log ฝั่ง server */
function withCompatQuery(url: string, requester: string, legacyKey?: string) {
  try {
    const u = new URL(url);
    if (requester) u.searchParams.set("requester", requester);
    if (legacyKey) u.searchParams.set("key", legacyKey);
    return u.toString();
  } catch { return url; }
}

// ---------- Utils ----------
const isEmail = (s: string) => /.+@.+\..+/.test(String(s || "").trim());

const ms = (v: any) =>
  v == null ? null : typeof v === "number" ? v :
  v?._seconds ? v._seconds * 1000 :
  (isNaN(Date.parse(v)) ? null : Date.parse(v));

const fmt = (d: any) => {
  const m = ms(d);
  return m == null ? "-" : new Date(m).toLocaleString("th-TH", { hour12: false });
};

const cloneCaps = (c: Caps) => JSON.parse(JSON.stringify(c || {}));

function roleRank(r?: string | null) {
  const s = (r ?? "").toLowerCase().trim();
  if (s === "superadmin") return 3;
  if (s === "admin") return 2;
  if (s === "approver") return 1;
  return 0;
}

// ---------- ส่วนเลือกสิทธิ์ ----------
function CapsEditor({
  value,
  onChange,
  disabled,
}: {
  value: Caps;
  onChange: (k: keyof Caps, v: boolean) => void;
  disabled?: boolean;
}) {
  const v = value || {};
  const basic = [
    ["approve", "อนุมัติ", v.approve ?? false],
    ["reject", "ปฏิเสธ", v.reject ?? false],
    ["delete", "ลบ", v.delete ?? false],
    ["export", "ส่งออก", v.export ?? false],
    ["viewAll", "ดูทั้งหมด (เดิม)", v.viewAll ?? (v.view_all ?? false)],
    ["manageUsers", "จัดการผู้ใช้", v.manageUsers ?? false],
    ["settings", "ตั้งค่า (เดิม)", v.settings ?? false],
  ] as const;

  const extra = [
    ["view_reports", "ดูรายงาน", v.view_reports ?? false],
    ["audit_log", "ดูบันทึกการใช้งาน", v.audit_log ?? false],
    ["manage_master_data", "จัดการข้อมูลหลัก", v.manage_master_data ?? false],
    ["system_settings", "ตั้งค่าระบบ (ใหม่)", v.system_settings ?? false],
    ["view_all", "ดูทั้งหมด (คีย์ใหม่)", v.view_all ?? (v.viewAll ?? false)],
  ] as const;

  return (
    <Stack direction="row" spacing={4} sx={{ flexWrap: "wrap" }}>
      <Stack>
        <Typography variant="caption" color="text.secondary">สิทธิ์พื้นฐาน</Typography>
        <Stack>
          {basic.map(([k, label, checked]) => (
            <FormControlLabel
              key={String(k)}
              control={<Checkbox checked={!!checked} onChange={e => onChange(k as keyof Caps, e.target.checked)} disabled={disabled} />}
              label={label as string}
            />
          ))}
        </Stack>
      </Stack>
      <Stack>
        <Typography variant="caption" color="text.secondary">สิทธิ์พิเศษ</Typography>
        <Stack>
          {extra.map(([k, label, checked]) => (
            <FormControlLabel
              key={String(k)}
              control={<Checkbox checked={!!checked} onChange={e => onChange(k as keyof Caps, e.target.checked)} disabled={disabled} />}
              label={label as string}
            />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}

// ---------- หน้า Users ----------
export default function Users() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // requester ปัจจุบัน (อ่านจากผู้ที่ล็อกอิน)
  const [requester, setRequester] = useState<string>(currentRequesterEmail());

  // ช่องค้นหา + ฟอร์มเพิ่ม
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");

  // สถานะทำงานรายแถว
  const [savingEmail, setSavingEmail] = useState("");
  const [togglingEmail, setTogglingEmail] = useState("");
  const [removingEmail, setRemovingEmail] = useState("");

  // เชิญตั้งรหัสผ่าน
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResultOpen, setInviteResultOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const [snack, setSnack] = useState<{ open: boolean; ok?: boolean; msg: string }>({ open: false, msg: "" });

  // === อ่านสิทธิ์สด (ด่านกลาง) ===
  const live = useAuthzLive() ?? {};
  const canManageUsersAuthz =
    isSuperadmin(live.role) || hasCap(live.caps, "manage_users", live.role);

  // อัปเดต requester เมื่อสถานะล็อกอินเปลี่ยน
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setRequester(u?.email || "");
    });
    return () => unsub();
  }, []);

  // โหลดรายการผู้ใช้จาก API
  async function loadList() {
    if (!URLS.list) { setErr("ยังไม่ได้ตั้งค่า VITE_LIST_ADMINS_URL"); return; }
    setLoading(true); setErr(null);
    try {
      const headers = await authzHeaders();
      const url = withCompatQuery(URLS.list, requester, getLegacyKey());
      // console.debug("[Users][debug] loadList():", { url, requester, hasApikey: !!getLegacyKey() });
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({}) });
      if (res.status === 401) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `โหลดรายการไม่สำเร็จ (HTTP ${res.status})`);

      const arr: any[] =
        Array.isArray(j?.data?.items) ? j.data.items :
        Array.isArray(j?.items) ? j.items :
        Array.isArray(j) ? j : [];

      const tmp: AdminRow[] = arr.map((it: any) => {
        const candidate = String(it.email ?? it.emailLower ?? "").trim().toLowerCase();
        const email = isEmail(candidate) ? candidate : "";
        const role = (String(it.role || "approver").toLowerCase() as Role);
        const caps = cloneCaps(it.caps || DEFAULT_CAPS_BY_ROLE[role]);
        const enabled = typeof it.enabled === "boolean" ? it.enabled : true;
        return { email, role, caps, name: it.name, enabled, updatedBy: it.updatedBy, updatedAt: it.updatedAt };
      });

      const m = new Map<string, AdminRow>();
      for (const x of tmp) {
        if (!isEmail(x.email)) continue;
        const prev = m.get(x.email);
        if (!prev) m.set(x.email, x);
        else {
          const choose =
            roleRank(x.role) > roleRank(prev.role) ? x :
            roleRank(x.role) < roleRank(prev.role) ? prev :
            (prev.enabled === false && x.enabled !== false ? x : prev);
          m.set(x.email, choose);
        }
      }
      const legacy = tmp.filter(x => !isEmail(x.email));
      setRows([...m.values(), ...legacy]);
    } catch (e: any) {
      setErr(e?.message || "โหลดรายการไม่สำเร็จ"); setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, []);

  // === คำนวณสิทธิ์ของ requester (frontend gating เดิม + สิทธิ์สด) ===
  const requesterLower = (requester || "").trim().toLowerCase();
  const me = useMemo(
    () => rows.find(r => r.email.toLowerCase() === requesterLower),
    [rows, requesterLower]
  );
  const canManageUsersLegacy = !!(me && (me.role === "superadmin" || (me.caps?.manageUsers === true)));
  const canManageUsers = !!(canManageUsersAuthz || canManageUsersLegacy);

  // เพิ่มผู้มีสิทธิ์ใหม่
  async function onAdd() {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!newEmail.trim() || !isEmail(newEmail)) {
      setSnack({ open: true, ok: false, msg: "กรุณากรอกอีเมลให้ถูกต้อง" });
      return;
    }
    try {
      const headers = await authzHeaders();
      const u = withCompatQuery(URLS.add, requester, getLegacyKey());
      const res = await fetch(u, { method: "POST", headers, body: JSON.stringify({ email: newEmail.trim(), role: newRole }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `เพิ่มไม่สำเร็จ (HTTP ${res.status})`);
      setNewEmail(""); setNewRole("viewer");
      await loadList();
      setSnack({ open: true, ok: true, msg: "เพิ่มผู้มีสิทธิ์สำเร็จ" });
    } catch (e: any) {
      setSnack({ open: true, ok: false, msg: `เพิ่มไม่สำเร็จ: ${e?.message || e}` });
    }
  }

  // บันทึกสิทธิ์/บทบาท
  async function onSaveRow(email: string, role: Role, caps: Caps) {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!isEmail(email)) { setSnack({ open: true, ok: false, msg: "ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (legacy)" }); return; }
    try {
      setSavingEmail(email);
      const headers = await authzHeaders();
      const u = withCompatQuery(URLS.update, requester, getLegacyKey());
      const res = await fetch(u, { method: "POST", headers, body: JSON.stringify({ email, role, caps }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `บันทึกไม่สำเร็จ (HTTP ${res.status})`);
      await loadList();
      setSnack({ open: true, ok: true, msg: "บันทึกสำเร็จ" });
    } catch (e: any) {
      setSnack({ open: true, ok: false, msg: `บันทึกไม่สำเร็จ: ${e?.message || e}` });
    } finally {
      setSavingEmail("");
    }
  }

  // เปิด/ปิดการใช้งาน
  async function onToggle(email: string, enabled: boolean) {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!isEmail(email)) { setSnack({ open: true, ok: false, msg: "ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (legacy)" }); return; }
    try {
      setTogglingEmail(email);
      const headers = await authzHeaders();
      const u = withCompatQuery(URLS.update, requester, getLegacyKey());
      const res = await fetch(u, { method: "POST", headers, body: JSON.stringify({ email, enabled }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `อัปเดตไม่สำเร็จ (HTTP ${res.status})`);
      await loadList();
      setSnack({ open: true, ok: true, msg: enabled ? "เปิดการใช้งานแล้ว" : "ปิดการใช้งานแล้ว" });
    } catch (e: any) {
      setSnack({ open: true, ok: false, msg: `อัปเดตสถานะไม่สำเร็จ: ${e?.message || e}` });
    } finally {
      setTogglingEmail("");
    }
  }

  // ลบผู้มีสิทธิ์
  async function onRemove(email: string) {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!isEmail(email)) { setSnack({ open: true, ok: false, msg: "ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (legacy)" }); return; }
    try {
      setRemovingEmail(email);
      const headers = await authzHeaders();
      const u = withCompatQuery(URLS.remove, requester, getLegacyKey());
      const res = await fetch(u, { method: "POST", headers, body: JSON.stringify({ email }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `ลบไม่สำเร็จ (HTTP ${res.status})`);
      await loadList();
      setSnack({ open: true, ok: true, msg: "ลบสำเร็จ" });
    } catch (e: any) {
      setSnack({ open: true, ok: false, msg: `ลบไม่สำเร็จ: ${e?.message || e}` });
    } finally {
      setRemovingEmail("");
    }
  }

  // === เชิญตั้ง/รีเซ็ตรหัสผ่าน ===
  function openInvite(email: string) { setInviteTarget(email); setInviteOpen(true); }
  function closeInvite() { if (!inviteLoading) setInviteOpen(false); }

  async function doInvite() {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!URLS.invite) return setSnack({ open: true, ok: false, msg: "ยังไม่ได้ตั้งค่า VITE_INVITE_ADMIN_URL" });
    if (!isEmail(inviteTarget)) { setSnack({ open: true, ok: false, msg: "ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (legacy)" }); return; }
    try {
      setInviteLoading(true);
      const headers = await authzHeaders();
      const u = withCompatQuery(URLS.invite, requester, getLegacyKey());
      const res = await fetch(u, { method: "POST", headers, body: JSON.stringify({ email: inviteTarget }) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
      const link = String(json?.link || "");
      setInviteLink(link);
      setInviteOpen(false);
      setInviteResultOpen(true);
      setSnack({ open: true, ok: true, msg: "ส่งคำขอเชิญแล้ว" });
    } catch (e: any) {
      setSnack({ open: true, ok: false, msg: `ส่งคำเชิญไม่สำเร็จ: ${e?.message || e}` });
    } finally {
      setInviteLoading(false);
    }
  }

  // กรองรายการตามช่องค้นหา
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.email || "").toLowerCase().includes(q) ||
      (r.name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {!canManageUsers && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          โหมดอ่านอย่างเดียว: ผู้ใช้ <b>{requester || "-"}</b> ไม่มีสิทธิ์ <code>manage_users</code> — ปุ่มแก้ไข/บันทึก/ลบ/เชิญถูกปิดไว้
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Typography variant="h5" fontWeight={700}>Work Permit / Admin</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="ค้นหา (อีเมล/ชื่อ)"
            size="small"
            placeholder="ค้นหา admin..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ opacity: .6 }} />
                </InputAdornment>
              ),
            }}
          />
          <Tooltip title="รีเฟรชรายการ">
            <span><IconButton onClick={loadList} disabled={loading}><RefreshRoundedIcon /></IconButton></span>
          </Tooltip>
        </Stack>
      </Stack>

      <CapBlock cap="manage_users" deniedText="คุณไม่มีสิทธิ์เพิ่ม/แก้ผู้ดูแล (manage_users)">
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              label="อีเมล"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              size="small"
              fullWidth
              disabled={!canManageUsers}
            />
            <FormControl size="small" sx={{ minWidth: 180 }} disabled={!canManageUsers}>
              <InputLabel>บทบาท</InputLabel>
              <Select label="บทบาท" value={newRole} onChange={e => setNewRole(e.target.value as Role)}>
                <MenuItem value="superadmin">Super Admin</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="approver">Approver</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
            <CapButton
              cap="manage_users"
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={onAdd}
              disabled={loading}
            >
              เพิ่ม
            </CapButton>
            {loading && <LinearProgress sx={{ width: { xs: "100%", sm: 200 } }} />}
          </Stack>
        </Paper>
      </CapBlock>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        {(loading && rows.length === 0)
          ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Box key={`sk-${i}`}>
                <Card variant="outlined">
                  <CardContent>
                    <Skeleton width="60%" />
                    <Skeleton width="30%" />
                    <Divider sx={{ my: 2 }} />
                    <Skeleton height={120} />
                  </CardContent>
                </Card>
              </Box>
            ))
          )
          : (
            filtered.map((r, idx) => {
              const invalidEmail = !isEmail(r.email);
              return (
                <Box key={r.email || `no-email-${idx}`}>
                  <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <CardContent sx={{ pb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack spacing={0.5}>
                          <Typography fontWeight={700}>{r.email || "(ระเบียนเก่า ไม่มีอีเมล)"}</Typography>
                          {!!r.name && <Typography variant="caption" color="text.secondary">{r.name}</Typography>}
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                            {invalidEmail && <Chip size="small" color="warning" label="legacy (no email)" />}
                            <Chip
                              size="small"
                              label={r.role}
                              color={r.role === "superadmin" ? "secondary" : r.role === "admin" ? "primary" : "default"}
                            />
                            <Chip size="small" variant="outlined" label={r.enabled === false ? "disabled" : "enabled"} />
                          </Stack>
                        </Stack>
                        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!canManageUsers || invalidEmail}>
                          <InputLabel>บทบาท</InputLabel>
                          <Select
                            label="บทบาท"
                            value={r.role}
                            onChange={e => {
                              const role = e.target.value as Role;
                              setRows(prev => prev.map(x => x.email === r.email ? { ...x, role } : x));
                            }}
                          >
                            <MenuItem value="superadmin">Super Admin</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="approver">Approver</MenuItem>
                            <MenuItem value="viewer">Viewer</MenuItem>
                          </Select>
                        </FormControl>
                      </Stack>

                      <Divider sx={{ my: 2 }} />

                      <CapsEditor
                        value={r.caps || {}}
                        disabled={!canManageUsers || invalidEmail}
                        onChange={(k, v) =>
                          setRows(prev => prev.map(x => x.email === r.email ? { ...x, caps: { ...(x.caps || {}), [k]: v } } : x))
                        }
                      />

                      <Divider sx={{ my: 2 }} />

                      <Stack direction="row" spacing={2} sx={{ color: "text.secondary" }} flexWrap="wrap">
                        <Typography variant="caption">แก้ไขล่าสุดโดย: <b>{r.updatedBy || "-"}</b></Typography>
                        <Typography variant="caption">เมื่อไหร่: <b>{fmt(r.updatedAt)}</b></Typography>
                      </Stack>

                      {invalidEmail && (
                        <Alert severity="info" sx={{ mt: 1 }}>
                          ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (เอกสารเก่า) — แนะนำให้ <b>เพิ่มผู้ใช้ใหม่ด้วยอีเมลจริง</b> เพื่อใช้งานการแก้สิทธิ์/เชิญ/ปิดเปิด
                        </Alert>
                      )}
                    </CardContent>

                    <CardActions sx={{ mt: "auto", justifyContent: "space-between", px: 2, pb: 2 }}>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title={r.enabled === false ? "เปิดการใช้งาน" : "ปิดการใช้งาน"}>
                          <span>
                            <IconButton onClick={() => onToggle(r.email, !(r.enabled !== false))}
                              disabled={togglingEmail === r.email || !canManageUsers || invalidEmail}>
                              <PowerSettingsNewRoundedIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="บันทึกการเปลี่ยนแปลง">
                          <span>
                            <IconButton color="primary" onClick={() => onSaveRow(r.email, r.role, r.caps)}
                              disabled={savingEmail === r.email || !canManageUsers || invalidEmail}>
                              <SaveRoundedIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="เชิญตั้ง/รีเซ็ตรหัสผ่าน">
                          <span>
                            <IconButton color="secondary" onClick={() => openInvite(r.email)}
                              disabled={(inviteLoading && inviteTarget === r.email) || !canManageUsers || invalidEmail}>
                              <SendRoundedIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                      <Tooltip title="ลบผู้มีสิทธิ์ (ถาวร)">
                        <span>
                          <IconButton color="error" onClick={() => onRemove(r.email)}
                            disabled={removingEmail === r.email || !canManageUsers || invalidEmail}>
                            <DeleteForeverRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Box>
              );
            })
          )}

        {(filtered.length === 0 && !loading) && (
          <Box sx={{ gridColumn: "1 / -1" }}>
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
              ไม่พบรายการที่ตรงกับคำค้น — ลองลบคำค้นหรือเพิ่มผู้ใช้ใหม่
            </Paper>
          </Box>
        )}
      </Box>

      {!!err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}

      {/* Dialog ยืนยันส่งคำเชิญ */}
      <Dialog open={inviteOpen} onClose={() => { if (!inviteLoading) setInviteOpen(false); }}>
        <DialogTitle>ส่งลิงก์ตั้ง/รีเซ็ตรหัสผ่าน</DialogTitle>
        <DialogContent>
          <DialogContentText>ระบบจะส่งอีเมลคำเชิญไปยัง <b>{inviteTarget}</b> กรุณายืนยัน</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { if (!inviteLoading) setInviteOpen(false); }} disabled={inviteLoading}>ยกเลิก</Button>
          <CapButton cap="manage_users" variant="contained" startIcon={<SendRoundedIcon />} onClick={doInvite} disabled={inviteLoading}>
            ยืนยันส่ง
          </CapButton>
        </DialogActions>
      </Dialog>

      {/* Dialog แสดงลิงก์หลังเชิญสำเร็จ */}
      <Dialog open={inviteResultOpen} onClose={() => setInviteResultOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>ลิงก์รีเซ็ตรหัสผ่านถูกสร้างแล้ว</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ wordBreak: "break-all" }}>{inviteLink || "ลิงก์ไม่ระบุ"}</DialogContentText>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button onClick={() => navigator.clipboard.writeText(inviteLink || "")}>คัดลอกลิงก์</Button>
            <Button href={inviteLink || "#"} target="_blank">เปิดลิงก์</Button>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setInviteResultOpen(false)}>ปิด</Button></DialogActions>
      </Dialog>

      {/* Snackbar แจ้งผล */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnack(s => ({ ...s, open: false }))} severity={snack.ok ? "success" : "error"} sx={{ width: "100%" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
