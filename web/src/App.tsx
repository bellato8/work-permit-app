// ======================================================================
// ไฟล์: src/App.tsx
// เวอร์ชัน: 2025-09-25 05:20 (Asia/Bangkok)
// เปลี่ยนแปลงรอบนี้:
//   • [ใหม่] เพิ่มเส้นทาง /auth/action → ใช้หน้า AuthAction (จัดการลิงก์อีเมล Firebase เช่น resetPassword)
//   • [ใหม่] เพิ่มเส้นทาง /admin/daily-operations → หน้างานประจำวัน
//   • [ใหม่] เพิ่มเส้นทาง /test-daily → หน้าทดสอบ Daily Operations Service
//   • คงโครงสร้างเดิมทั้งหมด (Rules, Form, Status, Login, Admin, Approvals ฯลฯ)
// หมายเหตุ:
//   • อย่าลืมตั้งค่า Email Action URL ใน Firebase ให้ชี้มาที่โดเมนเรา (เช่น https://imperialworld.asia/auth/action)
//     เพื่อให้ลิงก์รีเซ็ตรหัสผ่าน/ยืนยันอีเมลเปิดหน้านี้ของเราได้ (อ้างอิงเอกสาร Firebase), ดูในคอนโซล Authentication > Templates.
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

// ★ ใช้หน้า Login แบบสวย (hero) เป็นค่าเริ่มต้นเพียงตัวเดียว
import Login from "./pages/Login";

import LogoutPage from "./pages/LogoutPage";

// ★★★ [ใหม่] หน้าจัดการลิงก์อีเมลของ Firebase (resetPassword/verifyEmail/recoverEmail)
import AuthAction from "./pages/AuthAction";

// ★★★★ [ใหม่] หน้าทดสอบ Daily Operations Service
import TestDaily from "./pages/TestDaily";

// -------- Admin Layout + Pages --------
import AdminLayout from "./pages/admin/AdminLayout";
const Dashboard     = lazy(() => import("./pages/admin/Dashboard"));
const Permits       = lazy(() => import("./pages/admin/Permits"));
const PermitDetails = lazy(() => import("./pages/admin/PermitDetails"));
const Logs          = lazy(() => import("./pages/admin/Logs"));
const Users         = lazy(() => import("./pages/admin/Users"));
const Settings      = lazy(() => import("./pages/admin/Settings"));
const Reports       = lazy(() => import("./pages/admin/Reports"));
// ด้านบนตรงกลุ่ม lazy imports ของ admin pages
const Cleanup       = lazy(() => import("./pages/admin/Cleanup"));

// ★★ เพิ่ม Approvals (ใหม่) — โหลดแบบ lazy (เลซี่)
const Approvals     = lazy(() => import("./pages/admin/Approvals"));

// ★★★ [ใหม่] เพิ่ม DailyOperations — หน้างานประจำวัน
const DailyOperations = lazy(() => import("./pages/admin/DailyOperations"));

// (ถ้าต้องใช้แดชบอร์ดเก่า ให้คงไว้; ถ้าไม่ใช้สามารถลบทิ้งภายหลังได้)
const AdminPageLegacy = lazy(() => import("./pages/AdminPage"));

// ตั้งค่า Firebase จาก .env
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
  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setReady(true); }), []);
  if (!ready) return <div className="p-6">กำลังโหลด…</div>;
  if (!user)   return <Navigate to="/login" state={{ from: loc }} replace />;
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
      <Routes>
        {/* เริ่มที่หน้า "กฎ" */}
        <Route path="/" element={<Navigate to="/rules" replace />} />

        {/* -------- Public -------- */}
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/form" element={<RequireAccepted><RequestFormPage /></RequireAccepted>} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<LogoutPage />} />

        {/* ★★★ [ใหม่] ตัวจัดการลิงก์อีเมลของ Firebase (เช่น resetPassword) */}
        <Route path="/auth/action" element={<AuthAction />} />

        {/* ★★★★ [ใหม่] หน้าทดสอบ Daily Operations Service */}
        <Route path="/test-daily" element={<TestDaily />} />

        {/* -------- Admin legacy (ถ้าไม่ใช้ค่อยลบทีหลัง) -------- */}
        <Route path="/admin-legacy" element={<Page><AdminPageLegacy /></Page>} />

        {/* -------- Admin ใหม่ (มี Sidebar/Topbar) -------- */}
        <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          {/* index = /admin → Dashboard */}
          <Route index element={<Page><Dashboard /></Page>} />

          {/* ★★ เส้นทางใหม่ Approvals */}
          <Route path="approvals" element={<Page><Approvals /></Page>} />

          <Route path="permits" element={<Page><Permits /></Page>} />
          <Route path="permits/:id" element={<Page><PermitDetails /></Page>} />
          <Route path="logs" element={<Page><Logs /></Page>} />
          
          {/* ★★★ [ใหม่] เส้นทาง Daily Operations — งานประจำวัน */}
          <Route path="daily-operations" element={<Page><DailyOperations /></Page>} />
          
          <Route path="users" element={<Page><Users /></Page>} />
          <Route path="cleanup" element={<Page><Cleanup /></Page>} />
          <Route path="settings" element={<Page><Settings /></Page>} />
          <Route path="reports" element={<Page><Reports /></Page>} />
        </Route>

        {/* กัน 404 */}
        <Route path="*" element={<Navigate to="/rules" replace />} />
      </Routes>
    </BrowserRouter>
  );
}