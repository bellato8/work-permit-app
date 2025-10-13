// ======================================================================
// File: web/src/pages/admin/Users.tsx
// เวอร์ชัน: 2025-10-10  (เพิ่ม Daily Work Permissions)
// หน้าที่: จัดการผู้ใช้แอดมิน (ดู/เพิ่ม/แก้สิทธิ์/ปิดเปิด/ลบ/เชิญ)
// การเปลี่ยนแปลง:
//  - เพิ่ม DailyWorkCaps type (viewTodayWork, viewOtherDaysWork, checkInOut)
//  - เพิ่ม UI สำหรับสิทธิ์ Daily Work ใน CapsEditor
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

// 🔥 Firebase init
import { getApps, initializeApp } from "firebase/app";
try {
  if (typeof window !== "undefined" && getApps().length === 0) {
    initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    } as any);
  }
} catch {}

// 🔥 Auth
import { getAuth, getIdToken, onAuthStateChanged } from "firebase/auth";

// ---------- Types ----------
type Role = "superadmin" | "admin" | "approver" | "viewer";
type LegacyCaps = {
  approve?: boolean; reject?: boolean; delete?: boolean; export?: boolean;
  viewAll?: boolean; manageUsers?: boolean; settings?: boolean;
};
type NewCaps = {
  view_reports?: boolean; audit_log?: boolean; manage_master_data?: boolean;
  system_settings?: boolean; view_all?: boolean;
};
// 🆕 Daily Work Permissions
type DailyWorkCaps = {
  viewTodayWork?: boolean;      // ดูงานวันนี้
  viewOtherDaysWork?: boolean;  // ดูงานวันอื่น
  checkInOut?: boolean;          // เช็คอิน/เช็คเอาท์
};
type Caps = LegacyCaps & NewCaps & DailyWorkCaps;
type AdminRow = {
  email: string;
  role: Role; caps: Caps; enabled?: boolean;
  name?: string; updatedBy?: string;
  updatedAt?: number | string | { _seconds?: number; _nanoseconds?: number };
};

// ---------- Default caps per role ----------
const DEFAULT_CAPS_BY_ROLE: Record<Role, Caps> = {
  superadmin: { 
    view_all: true, 
    manageUsers: true, 
    system_settings: true, 
    view_reports: true, 
    audit_log: true,
    // 🆕 สิทธิ์ Daily Work
    viewTodayWork: true,
    viewOtherDaysWork: true,
    checkInOut: true,
  },
  admin: { 
    view_all: true, 
    view_reports: true, 
    audit_log: true,
    // 🆕 สิทธิ์ Daily Work
    viewTodayWork: true,
    viewOtherDaysWork: true,
    checkInOut: true,
  },
  approver: { 
    view_all: false,
    // 🆕 สิทธิ์ Daily Work (หัวหน้างานดูได้ทุกวัน + เช็คได้)
    viewTodayWork: true,
    viewOtherDaysWork: true,
    checkInOut: true,
  },
  viewer: { 
    view_all: false,
    // 🆕 สิทธิ์ Daily Work (ผู้ดูแค่วันนี้เท่านั้น)
    viewTodayWork: true,
    viewOtherDaysWork: false,
    checkInOut: false,
  },
};

// ---------- Function URLs ----------
const URLS = {
  list:   (import.meta.env.VITE_LIST_ADMINS_URL as string)        || "",
  add:    (import.meta.env.VITE_ADD_ADMIN_URL as string)          || "",
  update: (import.meta.env.VITE_UPDATE_ADMIN_ROLE_URL as string)  || "",
  remove: (import.meta.env.VITE_REMOVE_ADMIN_URL as string)       || "",
  invite: (import.meta.env.VITE_INVITE_ADMIN_URL as string)       || "",
};

// ======================================================================
// Auth helpers — บังคับรีเฟรช token เสมอก่อนเรียก API
// ======================================================================

function currentRequesterEmail(): string {
  const u = getAuth().currentUser;
  if (u?.email) return u.email;
  const env = (import.meta.env.VITE_APPROVER_EMAIL as string | undefined) || "";
  return (env || "").trim();
}

// ⬇⬇⬇ ปรับจุดเดียว: ใช้ getIdToken(user, true) เสมอ
async function authzHeaders(): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  // force refresh → ดึง claims ล่าสุดเข้ามาใน ID token
  const token = await getIdToken(user, true);
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
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

// ---------- Caps editor ----------
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

  // 🆕 Daily Work Permissions
  const dailyWork = [
    ["viewTodayWork", "ดูงานวันนี้", v.viewTodayWork ?? false],
    ["viewOtherDaysWork", "ดูงานวันอื่น", v.viewOtherDaysWork ?? false],
    ["checkInOut", "เช็คอิน/เช็คเอาท์", v.checkInOut ?? false],
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
      {/* 🆕 Daily Work Section */}
      <Stack>
        <Typography variant="caption" color="text.secondary">สิทธิ์งานรายวัน</Typography>
        <Stack>
          {dailyWork.map(([k, label, checked]) => (
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

// ---------- Page ----------
export default function Users() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // auth-ready gate
  const [authReady, setAuthReady] = useState(false);

  // requester
  const [requester, setRequester] = useState<string>(currentRequesterEmail());

  // search + add form
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");

  // per-row action states
  const [savingEmail, setSavingEmail] = useState("");
  const [togglingEmail, setTogglingEmail] = useState("");
  const [removingEmail, setRemovingEmail] = useState("");

  // invite
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResultOpen, setInviteResultOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const [snack, setSnack] = useState<{ open: boolean; ok?: boolean; msg: string }>({ open: false, msg: "" });

  // live authz
  const live = useAuthzLive() ?? {};
  const canManageUsersAuthz =
    isSuperadmin(live.role) || hasCap(live.caps, "manage_users", live.role);

  // wait for auth state before any API
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setRequester(u?.email || "");
      setAuthReady(true);
      if (u) {
        // บังคับรีเฟรช 1 ครั้งหลัง login เพื่อเคลียร์ claims เก่า
        try { await getIdToken(u, true); } catch {}
        loadList();
      } else {
        setRows([]);
        setErr(null); // ไม่แสดง error แดงจนกว่าจะกดปุ่มเอง
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load list
  async function loadList() {
    if (!URLS.list) { setErr("ยังไม่ได้ตั้งค่า VITE_LIST_ADMINS_URL"); return; }
    setLoading(true); setErr(null);
    try {
      const headers = await authzHeaders();
      const res = await fetch(URLS.list, { method: "POST", headers, body: JSON.stringify({}) });
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

  // === legacy + live gates ===
  const requesterLower = (requester || "").trim().toLowerCase();
  const me = useMemo(
    () => rows.find(r => r.email.toLowerCase() === requesterLower),
    [rows, requesterLower]
  );
  const canManageUsersLegacy = !!(me && (me.role === "superadmin" || (me.caps?.manageUsers === true)));
  const canManageUsers = !!(canManageUsersAuthz || canManageUsersLegacy);

  // === Add (2-phase) ===
  async function onAdd() {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!newEmail.trim() || !isEmail(newEmail)) {
      setSnack({ open: true, ok: false, msg: "กรุณากรอกอีเมลให้ถูกต้อง" });
      return;
    }
    const email = newEmail.trim().toLowerCase();
    try {
      const headers = await authzHeaders();

      // Phase 1: สร้างผู้ใช้ + ขอ link ตั้งรหัสผ่าน
      const res1 = await fetch(URLS.add, { method: "POST", headers, body: JSON.stringify({ email, role: newRole }) });
      const j1 = await res1.json().catch(() => ({}));
      if (!res1.ok || j1?.ok === false) throw new Error(j1?.error || `เพิ่มไม่สำเร็จ (HTTP ${res1.status})`);

      const link = String(j1?.link || "");
      if (link) {
        setInviteTarget(email);
        setInviteLink(link);
        setInviteResultOpen(true);
      }

      // Phase 2: เขียนเอกสาร admins/{email} ให้แน่ใจ
      const res2 = await fetch(URLS.update, { method: "POST", headers, body: JSON.stringify({ email, role: newRole, enabled: true }) });
      const j2 = await res2.json().catch(() => ({}));
      if (!res2.ok || j2?.ok === false) throw new Error(j2?.error || `อัปเดต Firestore ไม่สำเร็จ (HTTP ${res2.status})`);

      setNewEmail(""); setNewRole("viewer");
      await loadList();
      setSnack({ open: true, ok: true, msg: "เพิ่มผู้ใช้ + เขียนสิทธิ์สำเร็จ" });
    } catch (e: any) {
      setSnack({ open: true, ok: false, msg: `เพิ่มไม่สำเร็จ: ${e?.message || e}` });
    }
  }

  // Save
  async function onSaveRow(email: string, role: Role, caps: Caps) {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!isEmail(email)) { setSnack({ open: true, ok: false, msg: "ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (legacy)" }); return; }
    try {
      setSavingEmail(email);
      const headers = await authzHeaders();
      const res = await fetch(URLS.update, { method: "POST", headers, body: JSON.stringify({ email, role, caps }) });
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

  // Toggle enabled
  async function onToggle(email: string, enabled: boolean) {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!isEmail(email)) { setSnack({ open: true, ok: false, msg: "ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (legacy)" }); return; }
    try {
      setTogglingEmail(email);
      const headers = await authzHeaders();
      const res = await fetch(URLS.update, { method: "POST", headers, body: JSON.stringify({ email, enabled }) });
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

  // Remove
  async function onRemove(email: string) {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!isEmail(email)) { setSnack({ open: true, ok: false, msg: "ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (legacy)" }); return; }
    try {
      setRemovingEmail(email);
      const headers = await authzHeaders();
      const res = await fetch(URLS.remove, { method: "POST", headers, body: JSON.stringify({ email }) });
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

  // Invite
  function openInvite(email: string) { setInviteTarget(email); setInviteOpen(true); }
  function closeInvite() { if (!inviteLoading) setInviteOpen(false); }

  async function doInvite() {
    if (!canManageUsers) { setSnack({ open: true, ok: false, msg: "forbidden: need manage_users" }); return; }
    if (!URLS.invite) return setSnack({ open: true, ok: false, msg: "ยังไม่ได้ตั้งค่า VITE_INVITE_ADMIN_URL" });
    if (!isEmail(inviteTarget)) { setSnack({ open: true, ok: false, msg: "ระเบียนนี้ไม่มีอีเมลที่ถูกต้อง (legacy)" }); return; }
    try {
      setInviteLoading(true);
      const headers = await authzHeaders();
      const res = await fetch(URLS.invite, { method: "POST", headers, body: JSON.stringify({ email: inviteTarget }) });
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

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.email || "").toLowerCase().includes(q) ||
      (r.name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const showReadOnlyWarn = authReady && !canManageUsers;

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {showReadOnlyWarn && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          โหมดอ่านอย่างเดียว: ผู้ใช้ <b>{requester || "-"}</b> ไม่มีสิทธิ์ <code>manage_users</code> — ปุ่มแก้ไข/บันทึก/ลบ/เชิญถูกปิดไว้
        </Alert>
      )}

      {!authReady && (
        <Alert severity="info" sx={{ mb: 2 }}>
          กำลังตรวจสอบสถานะการเข้าสู่ระบบ...
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
            <span><IconButton onClick={loadList} disabled={loading || !authReady}><RefreshRoundedIcon /></IconButton></span>
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
              disabled={!canManageUsers || !authReady}
            />
            <FormControl size="small" sx={{ minWidth: 180 }} disabled={!canManageUsers || !authReady}>
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
              disabled={loading || !authReady}
            >
              เพิ่ม
            </CapButton>
            {loading && <LinearProgress sx={{ width: { xs: "100%", sm: 200 } }} />}
          </Stack>
        </Paper>
      </CapBlock>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
        {(loading && rows.length === 0)
          ? Array.from({ length: 4 }).map((_, i) => (
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
          : filtered.map((r, idx) => {
              const invalidEmail = !isEmail(r.email);
              return (
                <Box key={r.email || `no-email-${idx}`}>
                  <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <CardContent sx={{ pb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack spacing={.5}>
                          <Typography fontWeight={700}>{r.email || "(ระเบียนเก่า ไม่มีอีเมล)"}</Typography>
                          {!!r.name && <Typography variant="caption" color="text.secondary">{r.name}</Typography>}
                          <Stack direction="row" spacing={1} sx={{ mt: .5, flexWrap: "wrap" }}>
                            {invalidEmail && <Chip size="small" color="warning" label="legacy (no email)" />}
                            <Chip size="small" label={r.role} color={r.role === "superadmin" ? "secondary" : r.role === "admin" ? "primary" : "default"} />
                            <Chip size="small" variant="outlined" label={r.enabled === false ? "disabled" : "enabled"} />
                          </Stack>
                        </Stack>
                        <FormControl size="small" sx={{ minWidth: 160 }} disabled={!canManageUsers || invalidEmail || !authReady}>
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
                        disabled={!canManageUsers || invalidEmail || !authReady}
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
                              disabled={togglingEmail === r.email || !canManageUsers || invalidEmail || !authReady}>
                              <PowerSettingsNewRoundedIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="บันทึกการเปลี่ยนแปลง">
                          <span>
                            <IconButton color="primary" onClick={() => onSaveRow(r.email, r.role, r.caps)}
                              disabled={savingEmail === r.email || !canManageUsers || invalidEmail || !authReady}>
                              <SaveRoundedIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="เชิญตั้ง/รีเซ็ตรหัสผ่าน">
                          <span>
                            <IconButton color="secondary" onClick={() => openInvite(r.email)}
                              disabled={(inviteLoading && inviteTarget === r.email) || !canManageUsers || invalidEmail || !authReady}>
                              <SendRoundedIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                      <Tooltip title="ลบผู้มีสิทธิ์ (ถาวร)">
                        <span>
                          <IconButton color="error" onClick={() => onRemove(r.email)}
                            disabled={removingEmail === r.email || !canManageUsers || invalidEmail || !authReady}>
                            <DeleteForeverRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Box>
              );
            })
        }

        {(filtered.length === 0 && !loading) && (
          <Box sx={{ gridColumn: "1 / -1" }}>
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center", color: "text.secondary" }}>
              ไม่พบรายการที่ตรงกับคำค้น — ลองลบคำค้นหรือเพิ่มผู้ใช้ใหม่
            </Paper>
          </Box>
        )}
      </Box>
      {/* <-- จบ grid container */}

      {!!err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}

      {/* Dialog ยืนยันส่งคำเชิญ */}
      <Dialog open={inviteOpen} onClose={() => { if (!inviteLoading) setInviteOpen(false); }}>
        <DialogTitle>ส่งลิงก์ตั้ง/รีเซ็ตรหัสผ่าน</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ระบบจะส่งอีเมลคำเชิญไปยัง <b>{inviteTarget}</b> กรุณายืนยัน
          </DialogContentText>
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
        <DialogActions>
          <Button onClick={() => setInviteResultOpen(false)}>ปิด</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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