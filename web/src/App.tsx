// ======================================================================
// ไฟล์: web/src/App.tsx
// เวอร์ชัน: 2025-10-26 21:30 (Asia/Bangkok)
// เปลี่ยนแปลงรอบนี้:
//   • [ใหม่] เส้นทาง Internal Portal: /internal/login, /internal/requests, /internal/requests/new
//   • [ใหม่] คอมโพเนนต์ RequireAuthInternal (redirect ไป /internal/login)
//   • [เพิ่ม] safeLazy imports สำหรับหน้า Internal (Login, RequestsDashboard, NewRequest)
//   • [เพิ่ม] redirect /internal → /internal/requests
//   • [คงเดิม] ErrorBoundary, Page(Suspense), RequireAuth(แอดมิน), Public/Admin/LP/Test routes ทั้งหมด
// หมายเหตุ: ใช้หน้า Internal ที่ส่งให้ก่อนหน้า (Login.tsx, RequestsDashboard.tsx, NewRequest.tsx)
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 26/10/2025 21:30
// ======================================================================

import React, { useEffect, useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";

// บันทึกเหตุการณ์ล็อกอิน-ออก
import AuthLogger from "./components/AuthLogger";

// -------- Public --------
import RulesPage from "./pages/RulesPage";
import RequestFormPage from "./pages/RequestFormPage";
import StatusPage from "./pages/StatusPage";

// ★ หน้า Login/Logout
import Login from "./pages/Login";
import LogoutPage from "./pages/LogoutPage";

// ★ ตัวจัดการลิงก์อีเมลของ Firebase
import AuthAction from "./pages/AuthAction";

// ★ หน้าทดสอบ Daily Operations Service
import TestDaily from "./pages/TestDaily";

// ★ หน้า Splash/Loading (พาไป /rules หรือมีปุ่มไปต่อ)
import Landing from "./pages/Landing";

// -------- Admin Layout + Pages (lazy) --------
import AdminLayout from "./pages/admin/AdminLayout";

// helper: lazy แบบมีข้อความตกหล่นกรณีไฟล์หาย/โหลดพลาด (กันหน้าขาว)
function safeLazy<T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  name: string
) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (e) {
      console.error(`❌ Failed to load page: ${name}`, e);
      const Fallback = (() => (
        <div style={{ padding: 24 }}>
          ไม่พบหน้า/โหลดหน้าไม่สำเร็จ: <b>{name}</b>
        </div>
      )) as unknown as T;
      return { default: Fallback };
    }
  });
}

const Dashboard       = safeLazy(() => import("./pages/admin/Dashboard"), "Dashboard");
const Permits         = safeLazy(() => import("./pages/admin/Permits"), "Permits");
const PermitDetails   = safeLazy(() => import("./pages/admin/PermitDetails"), "PermitDetails");
const Logs            = safeLazy(() => import("./pages/admin/Logs"), "Logs");
const Users           = safeLazy(() => import("./pages/admin/Users"), "Users");
const Settings        = safeLazy(() => import("./pages/admin/Settings"), "Settings");
const Reports         = safeLazy(() => import("./pages/admin/Reports"), "Reports");
const Cleanup         = safeLazy(() => import("./pages/admin/Cleanup"), "Cleanup");
const Approvals       = safeLazy(() => import("./pages/admin/Approvals"), "Approvals");
const DailyOperations = safeLazy(() => import("./pages/admin/DailyOperations"), "DailyOperations");
// (ถ้ายังใช้แดชบอร์ดเก่า)
const AdminPageLegacy = safeLazy(() => import("./pages/AdminPage"), "AdminPageLegacy");

// -------- Test Pages --------
const TestCheckboxGroup    = safeLazy(() => import("./pages/__test__/TestCheckboxGroup"), "TestCheckboxGroup");
const TestPermissionEditor = safeLazy(() => import("./pages/__test__/TestPermissionEditor"), "TestPermissionEditor");
const TestHook             = safeLazy(() => import("./pages/__test__/TestHook"), "TestHook");

// ★★★ LP Admin Pages (Module 2) — กัน 404 สำหรับเมนูใหม่ ★★★
const LP_InternalRequests = safeLazy(
  () => import("./pages/admin/lp/InternalRequestsQueue"),
  "LP/InternalRequestsQueue"
);
const LP_PermitApprovals = safeLazy(
  () => import("./pages/admin/lp/PermitApprovals"),
  "LP/PermitApprovals"
);
const LP_Locations = safeLazy(
  () => import("./pages/admin/lp/LocationsPage"),
  "LP/LocationsPage"
);
const LP_InternalUsers = safeLazy(
  () => import("./pages/admin/lp/InternalUsersPage"),
  "LP/InternalUsersPage"
);

// ★★★ Internal Portal Pages (Module 1) — เพิ่มรอบนี้ ★★★
const InternalLogin = safeLazy(
  () => import("./pages/internal/Login"),
  "Internal/Login"
);
const InternalRequestsDashboard = safeLazy(
  () => import("./pages/internal/RequestsDashboard"),
  "Internal/RequestsDashboard"
);
const InternalNewRequest = safeLazy(
  () => import("./pages/internal/NewRequest"),
  "Internal/NewRequest"
);

// ตั้งค่า Firebase จาก .env (Vite: import.meta.env.VITE_*)
const getFirebaseConfig = () => ({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "",
});
if (!getApps().length) initializeApp(getFirebaseConfig());
const auth = getAuth();

// ---------- ErrorBoundary กันหน้าขาว ----------
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; msg?: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, msg: err?.message || "เกิดข้อผิดพลาด" };
  }
  componentDidCatch(err: any, info: any) {
    console.error("App ErrorBoundary:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h3>เกิดข้อผิดพลาดในการแสดงผล</h3>
          <div style={{ color: "#b00020" }}>{this.state.msg}</div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

// ต้อง "ยอมรับกฎ" ก่อนเข้า /form
function RequireAccepted({ children }: { children: React.ReactNode }) {
  const accepted = typeof window !== "undefined" && localStorage.getItem("rulesAccepted") === "true";
  const loc = useLocation();
  if (!accepted) return <Navigate to="/rules" state={{ from: loc }} replace />;
  return <>{children}</>;
}

// ต้องล็อกอินก่อนเข้า /admin/**
function RequireAuth({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub(); // cleanup
  }, []);

  if (!ready) return <div className="p-6">กำลังโหลด…</div>;
  if (!user)   return <Navigate to="/login" state={{ from: loc }} replace />;
  return <>{children}</>;
}

// ต้องล็อกอินก่อนเข้า /internal/**
function RequireAuthInternal({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub(); // cleanup
  }, []);

  if (!ready) return <div className="p-6">กำลังโหลด…</div>;
  if (!user)   return <Navigate to="/internal/login" state={{ from: loc }} replace />;
  return <>{children}</>;
}

// ห่อ Suspense ตอนใช้คอมโพเนนต์ที่ lazy โหลด
function Page({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="p-6">กำลังโหลดหน้า…</div>}>{children}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthLogger />
      <ErrorBoundary>
        <Routes>
          {/* เริ่มที่หน้า Splash/Loading */}
          <Route path="/" element={<Landing />} />

          {/* -------- Public -------- */}
          <Route path="/rules" element={<RulesPage />} />
          <Route
            path="/form"
            element={
              <RequireAccepted>
                <RequestFormPage />
              </RequireAccepted>
            }
          />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<LogoutPage />} />

          {/* ตัวจัดการลิงก์อีเมลของ Firebase */}
          <Route path="/auth/action" element={<AuthAction />} />

          {/* หน้าทดสอบ Daily Operations Service */}
          <Route path="/test-daily" element={<TestDaily />} />

          {/* -------- Internal Portal (Module 1) -------- */}
          <Route path="/internal" element={<Navigate to="/internal/requests" replace />} />
          <Route path="/internal/login" element={<Page><InternalLogin /></Page>} />
          <Route
            path="/internal/requests"
            element={
              <RequireAuthInternal>
                <Page><InternalRequestsDashboard /></Page>
              </RequireAuthInternal>
            }
          />
          <Route
            path="/internal/requests/new"
            element={
              <RequireAuthInternal>
                <Page><InternalNewRequest /></Page>
              </RequireAuthInternal>
            }
          />

          {/* -------- Test routes (dev only ก็ใช้ได้จริง; ถ้าไฟล์หายจะขึ้นข้อความแทน) -------- */}
          <Route path="/__test__/checkbox-group" element={<Page><TestCheckboxGroup /></Page>} />
          <Route path="/__test__/permission-editor" element={<Page><TestPermissionEditor /></Page>} />
          <Route path="/__test__/admin-perms" element={<Page><TestHook /></Page>} />

          {/* -------- Admin legacy (ถ้าไม่ใช้ค่อยลบทีหลัง) -------- */}
          <Route path="/admin-legacy" element={<Page><AdminPageLegacy /></Page>} />

          {/* -------- Admin ใหม่ (มี Sidebar/Topbar) -------- */}
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            {/* index = /admin → Dashboard */}
            <Route index element={<Page><Dashboard /></Page>} />

            {/* เส้นทาง Approvals */}
            <Route path="approvals" element={<Page><Approvals /></Page>} />

            <Route path="permits" element={<Page><Permits /></Page>} />
            <Route path="permits/:id" element={<Page><PermitDetails /></Page>} />
            <Route path="logs" element={<Page><Logs /></Page>} />

            {/* งานประจำวัน */}
            <Route path="daily-operations" element={<Page><DailyOperations /></Page>} />

            <Route path="users" element={<Page><Users /></Page>} />
            <Route path="cleanup" element={<Page><Cleanup /></Page>} />
            <Route path="settings" element={<Page><Settings /></Page>} />
            <Route path="reports" element={<Page><Reports /></Page>} />

            {/* ★★★ LP Admin routes (Module 2) — กัน 404 สำหรับเมนูใหม่ ★★★ */}
            <Route path="lp">
              <Route path="internal-requests" element={<Page><LP_InternalRequests /></Page>} />
              <Route path="permit-approvals" element={<Page><LP_PermitApprovals /></Page>} />
              <Route path="locations" element={<Page><LP_Locations /></Page>} />
              <Route path="internal-users" element={<Page><LP_InternalUsers /></Page>} />
            </Route>
          </Route>

          {/* กัน 404 → ส่งกลับไป /rules */}
          <Route path="*" element={<Navigate to="/rules" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
