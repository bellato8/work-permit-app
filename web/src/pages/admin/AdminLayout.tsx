// ======================================================================
// File: src/pages/admin/AdminLayout.tsx
// เวอร์ชัน: 2025-09-22 01:05 (Asia/Bangkok)
// หน้าที่: โครงหน้าผู้ดูแล (Sidebar + Topbar + Content) พร้อมรองรับมือถือ
// การเปลี่ยนแปลงรอบนี้ (Mobile Drawer – Step 3):
//  - ปิด SwipeableDrawer อัตโนมัติเมื่อเปลี่ยนเส้นทาง (route) หรือสลับเป็นจอ md+
//  - คง UX/A11y ตามแนวทาง WAI-ARIA & Material; คง safe-area ด้านล่างสำหรับ iOS notch
//  - [ใหม่] เพิ่มเมนู "งานประจำวัน" (Daily Operations)
// เชื่อม auth ผ่าน "อะแดปเตอร์": ../../lib/auth และสิทธิ์สด: ../../hooks/useAuthzLive
// หมายเหตุ: ไม่ตัดฟีเจอร์เดิม (สิทธิ์/เมนู/ปุ่มเดิมทั้งหมดอยู่ครบ)
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

// ---- MUI ----
import {
  ThemeProvider, createTheme, CssBaseline,
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, Divider, Tooltip, Avatar, Button,
  IconButton
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";

// ไอคอน
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

// ---- Auth adapter ----
import { getCurrentUser, signOut } from "../../lib/auth";

// ---- Authz สด + ตัวช่วย UI gating ----
import useAuthzLive from "../../hooks/useAuthzLive";
import RequireCap, { NoPermissionBadge } from "../../components/RequireCap";
import { canAny } from "../../lib/hasCap";

// ค่าจาก .env
const SITE_NAME = import.meta.env.VITE_SITE_NAME || "Work Permit App";
const drawerWidth = 264;

// ธีม Navy + Teal
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0F172A" },
    secondary: { main: "#14B8A6" },
    background: { default: "#F5F7FB", paper: "#FFFFFF" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: `"Sarabun", ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", Arial`,
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 }
  },
  components: {
    MuiAppBar: { styleOverrides: { root: { boxShadow: "none", borderBottom: "1px solid #e5e7eb" } } },
    MuiDrawer: { styleOverrides: { paper: { borderRight: "1px solid #e5e7eb" } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: "2px 6px",
          "&.active": {
            background: "linear-gradient(90deg, rgba(20,184,166,0.15), rgba(2,132,199,0.15))",
            color: "#0F172A",
          },
        },
      },
    },
  },
});

// รายการเมนู + เงื่อนไขสิทธิ์ขั้นต่ำ
type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
  pageKey?: "dashboard" | "approvals" | "permits" | "dailyWork" | "reports" | "users" | "logs" | "cleanup" | "settings";
  anyOfCaps: string[]; // เก็บไว้ชั่วคราวสำหรับ fallback
  requireSuperadmin?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    to: "/admin",
    label: "แดชบอร์ด",
    icon: <DashboardRoundedIcon />,
    exact: true,
    pageKey: "dashboard",
    anyOfCaps: ["view_dashboard", "manage_users", "approve_requests", "view_reports", "view_permits", "view_logs", "manage_settings"],
  },
  { to: "/admin/approvals", label: "รออนุมัติ", icon: <AssignmentTurnedInRoundedIcon />, pageKey: "approvals", anyOfCaps: ["approve_requests", "review_requests"] },
  { to: "/admin/permits",   label: "ใบงาน",   icon: <ArticleRoundedIcon />,          pageKey: "permits", anyOfCaps: ["view_permits", "approve_requests"] },
  { to: "/admin/logs",      label: "บันทึกการใช้งาน",      icon: <HistoryRoundedIcon />,          pageKey: "logs", anyOfCaps: ["view_logs", "manage_settings"] },
  { to: "/admin/daily-operations", label: "งานประจำวัน", icon: <CalendarTodayIcon />, pageKey: "dailyWork", anyOfCaps: ["viewTodayWork", "view_permits", "approve_requests"] },
  { to: "/admin/users",     label: "ผู้ใช้",     icon: <GroupRoundedIcon />,            pageKey: "users", anyOfCaps: ["manage_users"] },
  { to: "/admin/reports",   label: "รายงาน",   icon: <BarChartRoundedIcon />,         pageKey: "reports", anyOfCaps: ["view_reports"] },
  {
    to: "/admin/cleanup",
    label: "ล้างข้อมูล",
    icon: <DeleteSweepRoundedIcon />,
    pageKey: "cleanup",
    anyOfCaps: ["manage_settings"],
    requireSuperadmin: true,
  },
  { to: "/admin/settings",  label: "ตั้งค่า",  icon: <SettingsRoundedIcon />,         pageKey: "settings", anyOfCaps: ["manage_settings"] },
];

// -------------------------------------------------------------
// คอมโพเนนต์ย่อย: SidebarContent (ใช้ซ้ำระหว่าง temporary/permanent)
// -------------------------------------------------------------
type SidebarContentProps = {
  siteName: string;
  allowedItems: NavItem[];
  role: any;
  caps: any;
  displayName: string;
  locPathname: string;
  onNavigate?: () => void;
};

function SidebarContent({
  siteName,
  allowedItems,
  role,
  caps,
  displayName,
  locPathname,
  onNavigate,
}: SidebarContentProps) {
  return (
    <Box role="navigation" aria-label="เมนูผู้ดูแลระบบ" sx={{ height: "100%", display: "flex", flexDirection: "column", p: 1.2 }}>
      {/* Logo/ชื่อระบบ */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, px: 1, py: 1.2 }}>
        <Box sx={{ width: 12, height: 12, bgcolor: "secondary.main", borderRadius: 99, boxShadow: 3 }} />
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ lineHeight: 1 }}>
            {siteName}
          </Typography>
          <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.1 }}>
            Admin Panel
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 1 }} />

      <List component="nav" sx={{ px: 0.5 }}>
        {allowedItems.length === 0 ? (
          <Box sx={{ px: 2, py: 2 }}>
            <NoPermissionBadge />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              คุณไม่มีสิทธิ์เห็นเมนูใด ๆ
            </Typography>
          </Box>
        ) : (
          allowedItems.map((m) => {
            const isActive = m.exact
              ? locPathname === "/admin" || locPathname === "/admin/"
              : locPathname.startsWith(m.to);
            return (
              <RequireCap key={m.to} role={role} caps={caps} anyOf={m.anyOfCaps}>
                <ListItemButton
                  component={NavLink as any}
                  to={m.to}
                  className={isActive ? "active" : undefined}
                  onClick={() => onNavigate?.()}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: isActive ? "primary.main" : "text.secondary" }}>
                    {m.icon}
                  </ListItemIcon>
                  <ListItemText primary={m.label} />
                </ListItemButton>
              </RequireCap>
            );
          })
        )}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      {/* แถบล่างของ Sidebar (safe-area สำหรับ iPhone) */}
      <Box sx={{ px: 1, pb: "calc(8px + env(safe-area-inset-bottom))" }}>
        <Divider sx={{ mb: 1 }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, px: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: "secondary.main" }}>
            {displayName?.slice(0, 1).toUpperCase() || "A"}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {displayName || "Admin"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {role ? String(role) : "—"}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [displayName, setDisplayName] = useState<string>("");

  // อ่านสิทธิ์สด
  const authz: any = useAuthzLive?.() ?? {};
  const role: string | null | undefined = authz?.role;
  const caps = authz?.caps;
  const pagePermissions = authz?.pagePermissions;

  // ★ คำนวณว่าเป็น superadmin หรือไม่
  const isSuperadmin = useMemo(() => {
    return (
      role === "superadmin" ||
      caps?.includes?.("superadmin") === true ||
      authz?.superadmin === true ||
      authz?.roles?.superadmin === true
    );
  }, [role, caps, authz]);

  // กรองเมนูที่ผู้ใช้ "มีสิทธิ์เห็น"
  const allowedItems = useMemo(
    () =>
      NAV_ITEMS.filter((it) => {
        // ตรวจสอบ superadmin ก่อน
        if (it.requireSuperadmin && !isSuperadmin) return false;
        
        // ถ้ามี pagePermissions ให้ใช้เป็นหลัก
        if (pagePermissions && it.pageKey) {
          return pagePermissions[it.pageKey]?.canView === true;
        }
        
        // fallback: ใช้ caps แบบเก่า
        return canAny({ role, caps }, it.anyOfCaps);
      }),
    [role, caps, pagePermissions, isSuperadmin]
  );

  useEffect(() => {
    getCurrentUser().then((u) => {
      const name = u?.displayName || u?.email || "Admin";
      setDisplayName(name);
    });
  }, []);

  async function handleSignOut() {
    await signOut();
    nav("/login");
  }

  // ---------- Responsive Drawer ----------
  const isMdUp = useMediaQuery(theme.breakpoints.up("md")); // md ขึ้นไปถือว่าเดสก์ท็อป
  const [mobileOpen, setMobileOpen] = useState(false);
  const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  // ★ ปิด Drawer อัตโนมัติเมื่อเปลี่ยนเส้นทาง หรือสลับเป็นจอ md+
  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
  }, [loc.pathname, isMdUp]); // เมื่อที่อยู่หน้าเปลี่ยน หรือจอขยายเป็น md+

  const sidebar = (
    <SidebarContent
      siteName={SITE_NAME}
      allowedItems={allowedItems}
      role={role}
      caps={caps}
      displayName={displayName}
      locPathname={loc.pathname}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        {/* Sidebar - เดสก์ท็อป (md ขึ้นไป) */}
        {isMdUp && (
          <Drawer
            variant="permanent"
            open
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              display: { xs: "none", md: "block" },
              "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box", bgcolor: "background.paper" },
            }}
          >
            {sidebar}
            <Box sx={{ px: 1, pb: 1 }}>
              <Button
                startIcon={<LogoutRoundedIcon />}
                onClick={handleSignOut}
                fullWidth
                sx={{ mt: 1.2 }}
                variant="outlined"
              >
                ออกจากระบบ
              </Button>
            </Box>
          </Drawer>
        )}

        {/* Sidebar - มือถือ/แท็บเล็ตเล็ก (md ลงไป) */}
        {!isMdUp && (
          <SwipeableDrawer
            open={mobileOpen}
            onOpen={() => setMobileOpen(true)}
            onClose={() => setMobileOpen(false)}
            anchor="left"
            disableBackdropTransition={iOS}
            disableDiscovery={iOS}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: drawerWidth } }}
          >
            {sidebar}
            <Box sx={{ px: 1, pb: "calc(8px + env(safe-area-inset-bottom))" }}>
              <Button
                startIcon={<LogoutRoundedIcon />}
                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                fullWidth
                sx={{ mt: 1.2 }}
                variant="outlined"
              >
                ออกจากระบบ
              </Button>
            </Box>
          </SwipeableDrawer>
        )}

        {/* Main area */}
        <Box component="main" sx={{ flexGrow: 1 }}>
          {/* Topbar */}
          <AppBar position="sticky" color="inherit" sx={{ bgcolor: "background.paper" }}>
            <Toolbar sx={{ gap: 1, minHeight: 64 }}>
              {/* ปุ่ม ☰ เฉพาะหน้าจอเล็ก */}
              {!isMdUp && (
                <IconButton
                  aria-label="เปิดเมนูผู้ดูแล"
                  onClick={() => setMobileOpen(true)}
                  edge="start"
                  size="large"
                  sx={{ mr: 0.5 }}
                >
                  <MenuRoundedIcon />
                </IconButton>
              )}

              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Work Permit / Admin
              </Typography>

              {/* ลิงก์ไปหน้าสาธารณะ */}
              <Tooltip title="Rules (กฎการทำงาน)">
                <Button size="small" color="primary" endIcon={<OpenInNewRoundedIcon />} href="/rules" target="_blank">
                  Rules
                </Button>
              </Tooltip>
              <Tooltip title="Status (ตรวจสอบสถานะ)">
                <Button size="small" color="primary" endIcon={<OpenInNewRoundedIcon />} href="/status" target="_blank">
                  Status
                </Button>
              </Tooltip>
            </Toolbar>
          </AppBar>

          {/* เนื้อหา */}
          {allowedItems.length === 0 ? (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <NoPermissionBadge />
                <Typography>คุณไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ</Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Outlet />
            </Box>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}