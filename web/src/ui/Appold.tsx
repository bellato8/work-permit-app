import React, { useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import PlexusBackground from "./PlexusBackground";

export default function App() {
  const { pathname } = useLocation();
  const siteName = import.meta.env.VITE_SITE_NAME || "ใบขออนุญาตเข้าทำงาน";

  useEffect(() => {
    const map: Record<string, string> = {
      "/": "กฎระเบียบ",
      "/request": "ยื่นคำขอ",
      "/status": "ตรวจสอบสถานะ",
      "/admin": "ผู้อนุมัติ"
    };
    const label = map[pathname] || "";
    document.title = label ? `${label} • ${siteName}` : siteName;
  }, [pathname, siteName]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <PlexusBackground />

      <header className="fixed top-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold tracking-wide">
          {siteName}
        </Link>
        <nav className="flex gap-3 text-sm">
          <Link className={`badge ${pathname==="/"?"!bg-[#FFE8A6] !border-[#ffe08a]":""}`} to="/">กฎระเบียบ</Link>
          <Link className={`badge ${pathname.startsWith("/request")?"!bg-[#FFE8A6] !border-[#ffe08a]":""}`} to="/request">ยื่นคำขอ</Link>
          <Link className={`badge ${pathname.startsWith("/status")?"!bg-[#FFE8A6] !border-[#ffe08a]":""}`} to="/status">ตรวจสอบสถานะ</Link>
          <Link className={`badge ${pathname.startsWith("/admin")?"!bg-[#FFE8A6] !border-[#ffe08a]":""}`} to="/admin">ผู้อนุมัติ</Link>
        </nav>
      </header>

      <main className="relative z-10 pt-20 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 pb-6">
        © {new Date().getFullYear()} Work Permit System
      </footer>
    </div>
  );
}
