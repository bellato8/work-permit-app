//======================================================================
// File: web/src/pages/dept-admin/Layout.tsx
// หน้าที่: Layout หลักสำหรับ Department Admin Portal
// สร้างเมื่อ: 30/10/2025
// คุณสมบัติ:
//   - Sidebar navigation
//   - Header with user info
//   - Protected route (ต้อง login และเป็น deptAdmin)
//======================================================================
import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import type { DepartmentAdmin } from "../../types";

const layoutStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  fontFamily: "Sarabun, sans-serif",
  background: "#f9fafb",
};

const sidebar: React.CSSProperties = {
  width: 280,
  background: "linear-gradient(180deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  position: "fixed",
  height: "100vh",
  overflowY: "auto",
};

const sidebarHeader: React.CSSProperties = {
  padding: "24px 20px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const sidebarTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const nav: React.CSSProperties = {
  flex: 1,
  padding: "20px 0",
};

const navLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 20px",
  color: "rgba(255,255,255,0.9)",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 500,
  transition: "all 0.2s",
};

const navLinkActiveStyle: React.CSSProperties = {
  ...navLinkStyle,
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  fontWeight: 700,
};

const mainContent: React.CSSProperties = {
  flex: 1,
  marginLeft: 280,
  display: "flex",
  flexDirection: "column",
};

const header: React.CSSProperties = {
  background: "#fff",
  borderBottom: "1px solid #e5e7eb",
  padding: "16px 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const userInfo: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const avatar: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontWeight: 700,
  fontSize: 16,
};

const logoutBtn: React.CSSProperties = {
  padding: "8px 16px",
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  color: "#374151",
  transition: "all 0.2s",
};

const content: React.CSSProperties = {
  flex: 1,
  padding: 24,
};

const loading: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100vh",
  fontSize: 18,
  color: "#6b7280",
};

export default function DeptAdminLayout() {
  const navigate = useNavigate();
  const auth = getAuth();
  const db = getFirestore();

  const [admin, setAdmin] = useState<DepartmentAdmin | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/dept-admin/login", { replace: true });
        return;
      }

      try {
        // ดึงข้อมูล dept admin
        const deptAdminRef = doc(db, "dept_admins", user.email || user.uid);
        const deptAdminSnap = await getDoc(deptAdminRef);

        if (!deptAdminSnap.exists() || !deptAdminSnap.data()?.enabled) {
          await auth.signOut();
          navigate("/dept-admin/login", { replace: true });
          return;
        }

        setAdmin({
          id: deptAdminSnap.id,
          ...deptAdminSnap.data(),
        } as DepartmentAdmin);
      } catch (error) {
        console.error("Error loading dept admin:", error);
        await auth.signOut();
        navigate("/dept-admin/login", { replace: true });
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsub();
  }, [auth, db, navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/dept-admin/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loadingAuth) {
    return <div style={loading}>กำลังโหลด...</div>;
  }

  if (!admin) {
    return null;
  }

  const initials = admin.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "DA";

  return (
    <div style={layoutStyle}>
      {/* Sidebar */}
      <aside style={sidebar}>
        <div style={sidebarHeader}>
          <h1 style={sidebarTitle}>
            <span>👨‍💼</span>
            <span>ผู้บริหารแผนก</span>
          </h1>
          <div style={{ fontSize: 13, marginTop: 4, opacity: 0.8 }}>
            {admin.department}
          </div>
        </div>

        <nav style={nav}>
          <NavLink
            to="/dept-admin/dashboard"
            style={({ isActive }) =>
              isActive ? navLinkActiveStyle : navLinkStyle
            }
          >
            <span>📊</span>
            <span>แดชบอร์ด</span>
          </NavLink>

          <NavLink
            to="/dept-admin/members"
            style={({ isActive }) =>
              isActive ? navLinkActiveStyle : navLinkStyle
            }
          >
            <span>👥</span>
            <span>สมาชิกในแผนก</span>
          </NavLink>

          <NavLink
            to="/dept-admin/work-requests"
            style={({ isActive }) =>
              isActive ? navLinkActiveStyle : navLinkStyle
            }
          >
            <span>📋</span>
            <span>งานของแผนก</span>
          </NavLink>
        </nav>

        <div style={{ padding: "20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
            เข้าสู่ระบบด้วย
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{admin.email}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={mainContent}>
        <header style={header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
              ระบบจัดการแผนก
            </h2>
          </div>

          <div style={userInfo}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                {admin.fullName}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {admin.department}
              </div>
            </div>
            <div style={avatar}>{initials}</div>
            <button
              style={logoutBtn}
              onClick={handleLogout}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e5e7eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
              }}
            >
              ออกจากระบบ
            </button>
          </div>
        </header>

        <div style={content}>
          <Outlet context={{ admin }} />
        </div>
      </main>
    </div>
  );
}
