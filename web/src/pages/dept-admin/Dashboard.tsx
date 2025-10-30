//======================================================================
// File: web/src/pages/dept-admin/Dashboard.tsx
// หน้าที่: Dashboard สำหรับผู้บริหารแผนก
// สร้างเมื่อ: 30/10/2025
// แสดง: สถิติและข้อมูลภาพรวมของแผนก
//======================================================================
import React, { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, getFirestore } from "firebase/firestore";
import type { DepartmentAdmin, DepartmentMember, InternalRequest } from "../../types";

const pageTitle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 8,
};

const pageSubtitle: React.CSSProperties = {
  fontSize: 16,
  color: "#6b7280",
  marginBottom: 32,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 20,
  marginBottom: 32,
};

const statCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  display: "flex",
  alignItems: "center",
  gap: 16,
  transition: "all 0.2s",
  cursor: "pointer",
};

const statIcon: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
};

const statContent: React.CSSProperties = {
  flex: 1,
};

const statLabel: React.CSSProperties = {
  fontSize: 14,
  color: "#6b7280",
  marginBottom: 4,
};

const statValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: "#111827",
};

const quickActions: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
  marginBottom: 32,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
  marginBottom: 16,
};

const actionsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 16,
};

const actionBtn: React.CSSProperties = {
  padding: "16px 20px",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 10,
  transition: "all 0.2s",
};

const recentActivity: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 24,
};

const activityList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const activityItem: React.CSSProperties = {
  padding: 16,
  background: "#f9fafb",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderLeft: "4px solid #667eea",
};

const loading: React.CSSProperties = {
  textAlign: "center",
  padding: 40,
  color: "#6b7280",
};

export default function DeptAdminDashboard() {
  const navigate = useNavigate();
  const { admin } = useOutletContext<{ admin: DepartmentAdmin }>();
  const db = getFirestore();

  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalRequests: 0,
    pendingRequests: 0,
  });
  const [recentRequests, setRecentRequests] = useState<InternalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [admin.department]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load members count
      const membersRef = collection(db, "dept_members");
      const membersQuery = query(membersRef, where("department", "==", admin.department));
      const membersSnap = await getDocs(membersQuery);

      const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DepartmentMember[];
      const activeMembers = members.filter(m => m.enabled).length;

      // Load requests - need to scan all users' internal_requests
      // For now, we'll use a simple approach (in production, use a better indexing strategy)
      let totalRequests = 0;
      let pendingRequests = 0;

      // Note: This is simplified - in production, you'd want to denormalize or use a better query pattern
      const usersRef = collection(db, "artifacts", "app", "users");
      const usersSnap = await getDocs(usersRef);

      const recentReqs: InternalRequest[] = [];

      for (const userDoc of usersSnap.docs) {
        const requestsRef = collection(db, "artifacts", "app", "users", userDoc.id, "internal_requests");
        const requestsSnap = await getDocs(requestsRef);

        for (const reqDoc of requestsSnap.docs) {
          const reqData = reqDoc.data();
          // Check if requester is from this department
          const memberEmail = reqData.requesterEmail?.toLowerCase();
          const member = members.find(m => m.email.toLowerCase() === memberEmail);

          if (member) {
            totalRequests++;
            if (reqData.status === "รอดำเนินการ") {
              pendingRequests++;
            }
            recentReqs.push({
              id: reqDoc.id,
              ...reqData,
            } as InternalRequest);
          }
        }
      }

      // Sort by createdAt descending and take first 5
      recentReqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setStats({
        totalMembers: members.length,
        activeMembers,
        totalRequests,
        pendingRequests,
      });
      setRecentRequests(recentReqs.slice(0, 5));
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div style={loading}>กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div>
      <h1 style={pageTitle}>แดชบอร์ด</h1>
      <p style={pageSubtitle}>ภาพรวมของแผนก {admin.department}</p>

      {/* Stats Grid */}
      <div style={statsGrid}>
        <div
          style={statCard}
          onClick={() => navigate("/dept-admin/members")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ ...statIcon, background: "#dbeafe" }}>👥</div>
          <div style={statContent}>
            <div style={statLabel}>สมาชิกทั้งหมด</div>
            <div style={statValue}>{stats.totalMembers}</div>
          </div>
        </div>

        <div
          style={statCard}
          onClick={() => navigate("/dept-admin/members")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ ...statIcon, background: "#d1fae5" }}>✅</div>
          <div style={statContent}>
            <div style={statLabel}>สมาชิกที่ใช้งานอยู่</div>
            <div style={statValue}>{stats.activeMembers}</div>
          </div>
        </div>

        <div
          style={statCard}
          onClick={() => navigate("/dept-admin/work-requests")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ ...statIcon, background: "#fef3c7" }}>📋</div>
          <div style={statContent}>
            <div style={statLabel}>งานทั้งหมด</div>
            <div style={statValue}>{stats.totalRequests}</div>
          </div>
        </div>

        <div
          style={statCard}
          onClick={() => navigate("/dept-admin/work-requests")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{ ...statIcon, background: "#fee2e2" }}>⏳</div>
          <div style={statContent}>
            <div style={statLabel}>งานรอดำเนินการ</div>
            <div style={statValue}>{stats.pendingRequests}</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={quickActions}>
        <h2 style={sectionTitle}>เมนูด่วน</h2>
        <div style={actionsGrid}>
          <button
            style={actionBtn}
            onClick={() => navigate("/dept-admin/members?action=add")}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 20px rgba(102, 126, 234, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span>➕</span>
            <span>เพิ่มสมาชิกใหม่</span>
          </button>

          <button
            style={actionBtn}
            onClick={() => navigate("/dept-admin/members")}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 20px rgba(102, 126, 234, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span>👥</span>
            <span>จัดการสมาชิก</span>
          </button>

          <button
            style={actionBtn}
            onClick={() => navigate("/dept-admin/work-requests")}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 20px rgba(102, 126, 234, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span>📋</span>
            <span>ดูงานของแผนก</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={recentActivity}>
        <h2 style={sectionTitle}>งานล่าสุด</h2>
        {recentRequests.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
            ยังไม่มีงานในแผนก
          </div>
        ) : (
          <div style={activityList}>
            {recentRequests.map((req) => (
              <div key={req.id} style={activityItem}>
                <div style={{ fontSize: 24 }}>📄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {req.shopName} - {req.floor}
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    {req.workDetails.substring(0, 60)}
                    {req.workDetails.length > 60 ? "..." : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    {new Date(req.createdAt).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 12px",
                    background: req.status === "รอดำเนินการ" ? "#fef3c7" : "#d1fae5",
                    color: req.status === "รอดำเนินการ" ? "#92400e" : "#065f46",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {req.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
