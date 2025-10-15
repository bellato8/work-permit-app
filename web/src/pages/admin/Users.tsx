// ======================================================================
// File: web/src/pages/admin/Users.tsx
// Version: 2025-10-16 (Process-10: Loading/Error/Snackbar UX Upgrade)
// Changes (Phase 2 - Step 10):
//   • เพิ่ม Snackbar แบบมี severity + helpers (showSnackbar/closeSnackbar)
//   • เปลี่ยน loading เป็น Skeleton (หัวข้อ/แผงกรอง/ตาราง)
//   • Error แบบ Fade + ปุ่ม "ลองใหม่"
//   • Loading Overlay ตอนรีเซ็ตสิทธิ์ทั้งหมด
//   • ทุก action แสดง feedback ชัดเจน (success/error)
//   • เก็บฟีเจอร์เดิมทั้งหมด (Reset-All, PermissionEditor, Filter/Search, Invite/Remove/Toggle/Change Role)
// ======================================================================

import React, { useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,      // ✨ added
  Fade,          // ✨ added
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import RefreshIcon from "@mui/icons-material/RefreshRounded";
import DeleteIcon from "@mui/icons-material/DeleteForeverRounded";
import PowerIcon from "@mui/icons-material/PowerSettingsNewRounded";
import SendIcon from "@mui/icons-material/SendRounded";
import AddIcon from "@mui/icons-material/AddRounded";
import FilterListIcon from "@mui/icons-material/FilterList";
// [NEW] ไอคอนเตือนใน Dialog
import WarningIcon from "@mui/icons-material/WarningAmberRounded";

import PermissionEditor from "../../components/PermissionEditor";
import { useAdminPermissions, Admin } from "../../hooks/useAdminPermissions";
import type { PagePermissions, PageKey } from "../../types/permissions";
import { getDefaultPermissions } from "../../lib/defaultPermissions";

import useAuthzLive from "../../hooks/useAuthzLive";
import { hasCap, isSuperadmin } from "../../lib/hasCap";
import {
  canAccessPage,
  hasPagePermission,
  guardPage,
  getAccessiblePages,
  getPermissionsSummary,
} from "../../lib/permissionHelpers";
import { PAGE_NAMES, PAGE_ICONS } from "../../constants/permissions";

import { getAuth, getIdToken } from "firebase/auth";

// ---------- ENV URLs (functions) ----------
const URLS = {
  add:    import.meta.env.VITE_ADD_ADMIN_URL as string | undefined,
  update: import.meta.env.VITE_UPDATE_ADMIN_ROLE_URL as string | undefined, // เปลี่ยนบทบาท / เปิด-ปิด
  remove: import.meta.env.VITE_REMOVE_ADMIN_URL as string | undefined,
  invite: import.meta.env.VITE_INVITE_ADMIN_URL as string | undefined,
};

type Role = "superadmin" | "admin" | "approver" | "viewer";
const roleOptions: Role[] = ["superadmin", "admin", "approver", "viewer"];

// ---------- Helpers ----------
function roleChipColor(role?: string) {
  switch ((role || "").toLowerCase()) {
    case "superadmin": return "error";
    case "admin":      return "warning";
    case "approver":   return "info";
    default:           return "default";
  }
}

async function authHeaders() {
  const u = getAuth().currentUser;
  if (!u) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const token = await getIdToken(u, true);
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ---------- แปลง PAGE_ICONS → ใช้ใน Chip ----------
function chipIconFor(page: PageKey) {
  const Icon: any = (PAGE_ICONS as any)?.[page];
  if (!Icon) return undefined;
  if (typeof Icon === "function") {
    try { return <Icon size={16} style={{ display: "inline-flex" }} />; }
    catch { return <Icon />; }
  }
  if (React.isValidElement(Icon)) return Icon;
  if (typeof Icon === "string") return <span style={{ fontSize: 14, lineHeight: 0 }}>{Icon}</span>;
  return undefined;
}

export default function Users() {
  // ---- data from hook ----
  const { admins, loading, error, refreshAdmins, updatePermissions } = useAdminPermissions();
  const rows = useMemo(() => admins ?? [], [admins]);

  // ---- permissions (UI gate) ----
  const live = useAuthzLive() ?? {};
  const canView   = !!(canAccessPage(live as any, "users") || hasCap(live.caps, "manage_users", live.role) || isSuperadmin(live.role));
  const canAdd    = !!(hasPagePermission(live as any, "users", "canAdd")    || hasCap(live.caps, "manage_users", live.role) || isSuperadmin(live.role));
  const canEdit   = !!(hasPagePermission(live as any, "users", "canEdit")   || hasCap(live.caps, "manage_users", live.role) || isSuperadmin(live.role));
  const canDelete = !!(hasPagePermission(live as any, "users", "canDelete") || hasCap(live.caps, "manage_users", live.role) || isSuperadmin(live.role));
  const canInvite = !!(hasPagePermission(live as any, "users", "canInvite") || hasCap(live.caps, "manage_users", live.role) || isSuperadmin(live.role));
  const guard = guardPage(live as any, "users");
  const blocked = !canView;

  // ---- UI states ----
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<Admin | null>(null);
  const [initialPerms, setInitialPerms] = useState<PagePermissions | null>(null);
  const [savingPerm, setSavingPerm] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");

  const [busy, setBusy] = useState<string>(""); // เช่น "__add__", "role:<email>", "<email>"

  // ✨ Snackbar state (ใหม่: มี severity)
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  // ---- Filter/Search states ----
  const [filterPage, setFilterPage] = useState<PageKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const ALL_PAGE_KEYS = useMemo(() => Object.keys(PAGE_NAMES) as unknown as PageKey[], []);
  const filteredRows = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return rows.filter((a) => {
      const matchesSearch =
        !q ||
        a.email.toLowerCase().includes(q) ||
        (a.name ? a.name.toLowerCase().includes(q) : false);
      if (!matchesSearch) return false;

      if (filterPage === "all") return true;
      if (!a.pagePermissions) return false;
      return canAccessPage(a.pagePermissions as any, filterPage);
    });
  }, [rows, searchQuery, filterPage]);

  // ---- helpers: snackbar ----
  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "info" | "warning" = "success"
  ) => setSnackbar({ open: true, message, severity });

  const closeSnackbar = () => setSnackbar((prev) => ({ ...prev, open: false }));

  // ---- open editor ----
  const openEditor = (admin: Admin) => {
    setSelected(admin);
    const base = (admin.pagePermissions as PagePermissions) || getDefaultPermissions(admin.role || "viewer");
    setInitialPerms(base);
    setEditorOpen(true);
    setSaveErr(null);
  };

  // ---- save page-permissions ----
  const handleSavePerms = async (perms: PagePermissions) => {
    if (!selected) return;
    try {
      setSavingPerm(true); setSaveErr(null);
      await updatePermissions(selected.email, perms);
      setEditorOpen(false);
      refreshAdmins();
      showSnackbar(`✅ บันทึกสิทธิ์ของ ${selected.email} เรียบร้อยแล้ว`, "success");
    } catch (e: any) {
      const msg = e?.message || "เกิดข้อผิดพลาดในการบันทึก";
      setSaveErr(msg);
      showSnackbar(`❌ ${msg}`, "error");
    } finally {
      setSavingPerm(false);
    }
  };

  // ---- common API caller ----
  async function call(url: string | undefined, body: unknown) {
    if (!url) throw new Error("ยังไม่ได้ตั้งค่า URL ฟังก์ชันใน .env");
    const headers = await authHeaders();
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body ?? {}) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${res.status}`);
    return j;
  }

  // ---- actions: add / toggle / remove / invite ----
  const onAdd = async () => {
    if (!canAdd) return showSnackbar("ไม่มีสิทธิ์เพิ่มผู้ใช้", "warning");
    const email = (newEmail || "").trim().toLowerCase();
    if (!/.+@.+\..+/.test(email)) return showSnackbar("กรุณากรอกอีเมลให้ถูกต้อง", "warning");
    try {
      setBusy("__add__");
      await call(URLS.add, { email, role: newRole });
      await call(URLS.update, { email, role: newRole, enabled: true });
      setNewEmail(""); setNewRole("viewer");
      await refreshAdmins();
      showSnackbar("✅ เพิ่มผู้ใช้สำเร็จ", "success");
    } catch (e: any) {
      showSnackbar(`❌ เพิ่มไม่สำเร็จ: ${e?.message || e}`, "error");
    } finally {
      setBusy("");
    }
  };

  const onToggle = async (email: string, enabled: boolean) => {
    if (!canEdit) return showSnackbar("ไม่มีสิทธิ์แก้ไข", "warning");
    try {
      setBusy(email);
      await call(URLS.update, { email, enabled });
      await refreshAdmins();
      showSnackbar(enabled ? "✅ เปิดใช้งานแล้ว" : "✅ ปิดใช้งานแล้ว", "success");
    } catch (e: any) {
      showSnackbar(`❌ อัปเดตไม่สำเร็จ: ${e?.message || e}`, "error");
    } finally {
      setBusy("");
    }
  };

  const onRemove = async (email: string) => {
    if (!canDelete) return showSnackbar("ไม่มีสิทธิ์ลบ", "warning");
    if (!confirm("คุณแน่ใจหรือไม่?")) return;
    try {
      setBusy(email);
      await call(URLS.remove, { email });
      await refreshAdmins();
      showSnackbar("✅ ลบสำเร็จ", "success");
    } catch (e: any) {
      showSnackbar(`❌ ลบไม่สำเร็จ: ${e?.message || e}`, "error");
    } finally {
      setBusy("");
    }
  };

  const onInvite = async (email: string) => {
    if (!canInvite) return showSnackbar("ไม่มีสิทธิ์เชิญ", "warning");
    try {
      setBusy(email);
      const j = await call(URLS.invite, { email });
      const link = String(j?.link || "");
      showSnackbar(link ? "✅ สร้างลิงก์เชิญแล้ว (ดู console เพื่อคัดลอก)" : "✅ ส่งคำเชิญแล้ว", "success");
      if (link) console.info("Invite link for %s: %s", email, link);
    } catch (e: any) {
      showSnackbar(`❌ เชิญไม่สำเร็จ: ${e?.message || e}`, "error");
    } finally {
      setBusy("");
    }
  };

  // ---- change role inline ----
  const onChangeRole = async (email: string, role: Role) => {
    if (!canEdit) return showSnackbar("ไม่มีสิทธิ์แก้ไขบทบาท", "warning");
    try {
      setBusy(`role:${email}`);
      await call(URLS.update, { email, role });
      await refreshAdmins();
      showSnackbar("✅ เปลี่ยนบทบาทแล้ว", "success");
    } catch (e: any) {
      showSnackbar(`❌ เปลี่ยนบทบาทไม่สำเร็จ: ${e?.message || e}`, "error");
    } finally {
      setBusy("");
    }
  };

  // ========================= (NEW) Reset-All Permissions =========================
  const [resetDialog, setResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetErr, setResetErr] = useState<string | null>(null);

  const handleResetAll = async () => {
    // ปุ่มยืนยันใน Dialog
    setResetting(true);
    setResetErr(null);

    const list = admins ?? [];
    let ok = 0;
    let fail = 0;

    try {
      for (const a of list) {
        try {
          const defaults = getDefaultPermissions(a.role || "viewer");
          await updatePermissions(a.email, defaults);
          ok++;
          // eslint-disable-next-line no-console
          console.log(`✅ Reset ${a.email} (${a.role})  [${ok}/${list.length}]`);
        } catch (e) {
          fail++;
          // eslint-disable-next-line no-console
          console.error(`❌ Failed to reset ${a.email}`, e);
        }
      }

      const summary =
        fail === 0
          ? `✅ รีเซ็ตสำเร็จทั้งหมด: ${ok}/${list.length} คน`
          : `⚠️ รีเซ็ตเสร็จสิ้น\nสำเร็จ: ${ok}\nล้มเหลว: ${fail}\nโปรดตรวจสอบ Console รายละเอียด`;

      alert(summary);
      showSnackbar(fail === 0 ? "✅ รีเซ็ตสิทธิ์ทั้งหมดเรียบร้อย" : "⚠️ รีเซ็ตเสร็จสิ้น (มีบางรายการล้มเหลว)", fail === 0 ? "success" : "warning");

      setResetDialog(false);
      await refreshAdmins();
    } catch (e: any) {
      setResetErr(e?.message || "เกิดข้อผิดพลาดในการรีเซ็ต");
      showSnackbar("❌ รีเซ็ตไม่สำเร็จ", "error");
    } finally {
      setResetting(false);
    }
  };
  // ==============================================================================

  // ---------- Loading Skeleton ----------
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {/* Header Skeleton */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Skeleton variant="text" width={200} height={36} />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Skeleton variant="rectangular" width={160} height={32} />
            <Skeleton variant="rectangular" width={100} height={32} />
          </Box>
        </Box>

        {/* Add User Panel */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 180px 100px" }, gap: 1 }}>
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
          </Box>
        </Paper>

        {/* Filter Panel */}
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Skeleton variant="text" width={120} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 1 }}>
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={40} />
          </Box>
        </Paper>

        {/* Table Skeleton */}
        <Paper sx={{ p: 2 }}>
          {[1,2,3,4,5].map((i) => (
            <Box key={i} sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 3fr 1fr 1fr", gap: 2, alignItems: "center", py: 1 }}>
              <Skeleton variant="text" />
              <Skeleton variant="text" />
              <Skeleton variant="rectangular" height={28} />
              <Skeleton variant="text" />
              <Skeleton variant="rectangular" height={24} />
              <Skeleton variant="rectangular" height={24} />
            </Box>
          ))}
        </Paper>
      </Box>
    );
  }

  // ---------- Error State ----------
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Fade in>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={refreshAdmins}>
                ลองใหม่
              </Button>
            }
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2" gutterBottom>
              ⚠️ ไม่สามารถโหลดข้อมูลผู้ใช้งานได้
            </Typography>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        </Fade>

        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ
          </Typography>
          <Button variant="contained" onClick={refreshAdmins} sx={{ mt: 2 }}>
            โหลดข้อมูลใหม่
          </Button>
        </Paper>
      </Box>
    );
  }

  // ---------- UI ----------
  return (
    <Box sx={{ p: 2 }}>
      {/* Overlay เฉพาะตอนรีเซ็ตสิทธิ์ทั้งหมด */}
      {resetting && (
        <Box
          sx={{
            position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.7)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            zIndex: 9999
          }}
        >
          <CircularProgress size={60} sx={{ color: "white" }} />
          <Typography variant="h6" color="white" sx={{ mt: 2 }}>
            กำลังรีเซ็ตสิทธิ์ทั้งหมด...
          </Typography>
        </Box>
      )}

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">ผู้ดูแลระบบ</Typography>
        <Stack direction="row" spacing={1}>
          {/* Reset-All button */}
          <Button
            variant="outlined"
            color="warning"
            startIcon={<RefreshIcon />}
            onClick={() => setResetDialog(true)}
            disabled={blocked || !canEdit || (admins?.length ?? 0) === 0}
            size="small"
          >
            รีเซ็ตสิทธิ์ทั้งหมด
          </Button>

          <Button
            onClick={refreshAdmins}
            startIcon={<RefreshIcon />}
            variant="outlined"
            size="small"
          >
            รีเฟรช
          </Button>
        </Stack>
      </Stack>

      {!canView && (
        <Alert severity="error" sx={{ mb: 2 }}>
          เข้าหน้านี้ไม่ได้: {("reason" in guard ? (guard as any).reason : null) === "not-logged-in"
            ? "ยังไม่เข้าสู่ระบบ" : ("reason" in guard ? (guard as any).reason : null) === "disabled"
            ? "บัญชีถูกปิดใช้งาน" : "ไม่มีสิทธิ์เพียงพอ"}
        </Alert>
      )}

      {/* เพิ่มผู้ใช้ */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, opacity: canAdd ? 1 : 0.6 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            label="อีเมลผู้ใช้ใหม่"
            size="small"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={!canAdd || blocked || busy === "__add__"}
            fullWidth
          />
          <FormControl size="small" sx={{ minWidth: 180 }} disabled={!canAdd || blocked || busy === "__add__"}>
            <InputLabel>บทบาท</InputLabel>
            <Select label="บทบาท" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
              {roleOptions.map((r) => (
                <MenuItem key={r} value={r}>{r.toUpperCase()}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            onClick={onAdd}
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!canAdd || blocked || busy === "__add__"}
          >
            เพิ่ม
          </Button>
        </Stack>
      </Paper>

      {/* แผงกรอง/ค้นหา */}
      <Paper elevation={2} sx={{ p: 2, mb: 2, opacity: blocked ? 0.6 : 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <FilterListIcon color="action" />
          <Typography variant="subtitle1">กรองและค้นหา</Typography>
        </Box>

        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2
        }}>
          <TextField
            label="ค้นหา (Email หรือชื่อ)"
            variant="outlined"
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="พิมพ์เพื่อค้นหา..."
            disabled={blocked}
          />

          <FormControl size="small" disabled={blocked}>
            <InputLabel>กรองตามหน้าที่มีสิทธิ์</InputLabel>
            <Select
              value={filterPage}
              label="กรองตามหน้าที่มีสิทธิ์"
              onChange={(e) => setFilterPage(e.target.value as any)}
            >
              <MenuItem value="all"><em>ทั้งหมด</em></MenuItem>
              {ALL_PAGE_KEYS.map((k) => (
                <MenuItem key={k} value={k}>
                  {PAGE_NAMES[k as keyof typeof PAGE_NAMES]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" component="span">
            แสดง {filteredRows.length} จาก {rows.length} ผู้ใช้
          </Typography>
          {(searchQuery || filterPage !== "all") && (
            <Button
              size="small"
              onClick={() => { setSearchQuery(""); setFilterPage("all"); }}
              sx={{ ml: 1 }}
            >
              ล้างตัวกรอง
            </Button>
          )}
        </Box>
      </Paper>

      <Paper sx={{ width: "100%", overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>อีเมล</TableCell>
              <TableCell>ชื่อ</TableCell>
              <TableCell>บทบาท</TableCell>
              <TableCell>สิทธิ์</TableCell>
              <TableCell align="center">สถานะ</TableCell>
              <TableCell align="right">การกระทำ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((a) => {
              const role = (a.role || "viewer").toLowerCase() as Role;
              const disabled = blocked;
              const working = busy === a.email;
              const workingRole = busy === `role:${a.email}`;
              return (
                <TableRow key={a.email} hover>
                  <TableCell>{a.email}</TableCell>
                  <TableCell>{a.name || "-"}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>บทบาท</InputLabel>
                        <Select
                          label="บทบาท"
                          value={role}
                          onChange={(e) => onChangeRole(a.email, (e.target.value as Role))}
                          disabled={disabled || working || workingRole}
                        >
                          {roleOptions.map((r) => (
                            <MenuItem key={r} value={r}>{r.toUpperCase()}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Chip label={(a.role || "viewer").toUpperCase()} color={roleChipColor(role) as any} size="small" />
                    )}
                  </TableCell>

                  <TableCell sx={{ minWidth: 260 }}>
                    {a.pagePermissions ? (
                      <>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                          สิทธิ์: {getPermissionsSummary(a.pagePermissions)}
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                          {getAccessiblePages(a.pagePermissions).length > 0 ? (
                            getAccessiblePages(a.pagePermissions).map((page) => (
                              <Chip
                                key={page}
                                icon={chipIconFor(page as PageKey)}
                                label={PAGE_NAMES[page as keyof typeof PAGE_NAMES]}
                                size="small"
                                variant="outlined"
                                color="primary"
                                sx={{
                                  borderRadius: 1,
                                  fontSize: "0.75rem",
                                  "& .MuiChip-label": { px: 1 },
                                  "& .MuiChip-icon": { mr: 0.5 },
                                }}
                              />
                            ))
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              ไม่มีสิทธิ์เข้าหน้าใดๆ
                            </Typography>
                          )}
                        </Box>
                      </>
                    ) : (
                      <Chip label="⚠️ ยังไม่ได้ตั้งค่าสิทธิ์" size="small" color="warning" variant="outlined" />
                    )}
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={a.enabled ? "ใช้งาน" : "ปิดใช้งาน"}
                      color={a.enabled ? "success" : "default"}
                      variant={a.enabled ? "filled" : "outlined"}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="แก้สิทธิ์ (page-permissions)">
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SettingsIcon />}
                          aria-label="จัดการสิทธิ์"
                          onClick={() => openEditor(a)}
                          disabled={disabled || !canEdit}
                          sx={{ mr: 1 }}
                        >
                          จัดการสิทธิ์
                        </Button>
                      </span>
                    </Tooltip>

                    <Tooltip title={a.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}>
                      <span>
                        <IconButton
                          aria-label={a.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          onClick={() => onToggle(a.email, !a.enabled)}
                          disabled={disabled || !canEdit || working}
                        >
                          <PowerIcon />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="เชิญตั้ง/รีเซ็ตรหัสผ่าน">
                      <span>
                        <IconButton
                          aria-label="เชิญผู้ใช้"
                          onClick={() => onInvite(a.email)}
                          disabled={disabled || !canInvite || working}
                        >
                          <SendIcon />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="ลบผู้มีสิทธิ์">
                      <span>
                        <IconButton
                          aria-label="ลบผู้ใช้"
                          onClick={() => onRemove(a.email)}
                          disabled={disabled || !canDelete || working}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}

            {!loading && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  {rows.length === 0 ? "ไม่พบผู้ดูแล" : "ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Permission Editor */}
      {selected && initialPerms && (
        <PermissionEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          email={selected.email}
          role={selected.role}
          currentPermissions={initialPerms}
          onSave={handleSavePerms}
        />
      )}

      {saveErr && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {saveErr}
        </Alert>
      )}
      {savingPerm && (
        <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={18} />
          <Typography component="span">กำลังบันทึกการเปลี่ยนแปลง…</Typography>
        </Box>
      )}

      {/* Confirm Reset Dialog */}
      <Dialog
        open={resetDialog}
        onClose={() => (!resetting ? setResetDialog(false) : null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningIcon color="warning" />
          ยืนยันการรีเซ็ตสิทธิ์ทั้งหมด
        </DialogTitle>

        <DialogContent>
          {resetErr && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {resetErr}
            </Alert>
          )}

          <DialogContentText>
            คุณต้องการรีเซ็ตสิทธิ์ของผู้ใช้ทุกคนให้กลับเป็นค่าเริ่มต้นตามบทบาท (Role) หรือไม่?
            การกระทำนี้มีผลกับผู้ใช้ทั้งหมดและไม่สามารถย้อนกลับได้
          </DialogContentText>

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">
              ผู้ที่จะได้รับผลกระทบ: <b>{admins?.length ?? 0} คน</b>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              • สิทธิ์ที่เคยปรับแต่งจะถูกแทนด้วยค่าเริ่มต้น <br />
              • แนะนำให้ตรวจสอบผลลัพธ์หลังรีเซ็ต
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setResetDialog(false)} disabled={resetting}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleResetAll}
            color="warning"
            variant="contained"
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={16} /> : <RefreshIcon />}
          >
            {resetting ? "กำลังรีเซ็ต..." : "ยืนยันรีเซ็ต"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✨ Snackbar (แบบมี Alert ข้างใน) */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
