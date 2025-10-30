//======================================================================
// File: web/src/pages/dept-admin/WorkRequests.tsx
// หน้าที่: ดูงานที่สมาชิกในแผนกส่งไป
// สร้างเมื่อ: 30/10/2025
// คุณสมบัติ:
//   - แสดงรายการงานทั้งหมดของแผนก
//   - Filter by status
//   - ดูรายละเอียดงาน
//======================================================================
import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  getFirestore,
} from "firebase/firestore";
import type { DepartmentAdmin, DepartmentMember, InternalRequest } from "../../types";

const pageTitle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 8,
};

const pageHeader: React.CSSProperties = {
  marginBottom: 24,
};

const filterBar: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 24,
  flexWrap: "wrap",
};

const filterBtn: React.CSSProperties = {
  padding: "10px 16px",
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  color: "#374151",
  transition: "all 0.2s",
};

const filterBtnActive: React.CSSProperties = {
  ...filterBtn,
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  borderColor: "transparent",
};

const cardsGrid: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  transition: "all 0.2s",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 12,
};

const cardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
  marginBottom: 4,
};

const cardMeta: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  marginBottom: 12,
};

const cardBody: React.CSSProperties = {
  marginBottom: 16,
};

const badge: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  display: "inline-block",
};

const infoRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
  padding: 16,
  background: "#f9fafb",
  borderRadius: 8,
  fontSize: 14,
};

const infoItem: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const infoLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 600,
};

const infoValue: React.CSSProperties = {
  fontSize: 14,
  color: "#111827",
};

const loading: React.CSSProperties = {
  textAlign: "center",
  padding: 40,
  color: "#6b7280",
};

const empty: React.CSSProperties = {
  textAlign: "center",
  padding: 60,
  color: "#6b7280",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
};

type FilterStatus = "all" | "รอดำเนินการ" | "LP รับทราบ (รอผู้รับเหมา)" | "รอ LP ตรวจสอบ" | "อนุมัติเข้าทำงาน" | "ไม่อนุมัติ";

export default function DeptAdminWorkRequests() {
  const { admin } = useOutletContext<{ admin: DepartmentAdmin }>();
  const db = getFirestore();

  const [requests, setRequests] = useState<(InternalRequest & { submittedByName: string })[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<(InternalRequest & { submittedByName: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    loadRequests();
  }, [admin.department]);

  useEffect(() => {
    if (filter === "all") {
      setFilteredRequests(requests);
    } else {
      setFilteredRequests(requests.filter((r) => r.status === filter));
    }
  }, [filter, requests]);

  const loadRequests = async () => {
    try {
      setIsLoading(true);

      // Load department members first
      const membersRef = collection(db, "dept_members");
      const membersQuery = query(
        membersRef,
        where("department", "==", admin.department)
      );
      const membersSnap = await getDocs(membersQuery);

      const members = membersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DepartmentMember[];

      // Build email -> name map
      const emailToName = new Map<string, string>();
      members.forEach((m) => {
        emailToName.set(m.email.toLowerCase(), m.fullName);
      });

      // Load all requests from all users
      const allRequests: (InternalRequest & { submittedByName: string })[] = [];

      // Get all users
      const usersRef = collection(db, "artifacts", "app", "users");
      const usersSnap = await getDocs(usersRef);

      for (const userDoc of usersSnap.docs) {
        const requestsRef = collection(
          db,
          "artifacts",
          "app",
          "users",
          userDoc.id,
          "internal_requests"
        );
        const requestsSnap = await getDocs(requestsRef);

        for (const reqDoc of requestsSnap.docs) {
          const reqData = reqDoc.data();
          const requesterEmail = reqData.requesterEmail?.toLowerCase();

          // Check if this requester is in our department
          if (emailToName.has(requesterEmail)) {
            allRequests.push({
              id: reqDoc.id,
              ...reqData,
              submittedByName: emailToName.get(requesterEmail) || requesterEmail,
            } as InternalRequest & { submittedByName: string });
          }
        }
      }

      // Sort by created date descending
      allRequests.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setRequests(allRequests);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const styles: Record<string, React.CSSProperties> = {
      "รอดำเนินการ": { background: "#fef3c7", color: "#92400e" },
      "LP รับทราบ (รอผู้รับเหมา)": { background: "#dbeafe", color: "#1e40af" },
      "รอ LP ตรวจสอบ": { background: "#fef3c7", color: "#92400e" },
      "อนุมัติเข้าทำงาน": { background: "#d1fae5", color: "#065f46" },
      "ไม่อนุมัติ": { background: "#fee2e2", color: "#991b1b" },
    };
    return { ...badge, ...(styles[status] || {}) };
  };

  if (isLoading) {
    return <div style={loading}>กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div>
      <div style={pageHeader}>
        <h1 style={pageTitle}>งานของแผนก</h1>
        <p style={{ color: "#6b7280", marginTop: 8 }}>
          รายการงานทั้งหมดที่สมาชิกในแผนก {admin.department} ส่งไป
        </p>
      </div>

      {/* Filter Bar */}
      <div style={filterBar}>
        <button
          style={filter === "all" ? filterBtnActive : filterBtn}
          onClick={() => setFilter("all")}
        >
          ทั้งหมด ({requests.length})
        </button>
        <button
          style={filter === "รอดำเนินการ" ? filterBtnActive : filterBtn}
          onClick={() => setFilter("รอดำเนินการ")}
        >
          รอดำเนินการ (
          {requests.filter((r) => r.status === "รอดำเนินการ").length})
        </button>
        <button
          style={
            filter === "LP รับทราบ (รอผู้รับเหมา)" ? filterBtnActive : filterBtn
          }
          onClick={() => setFilter("LP รับทราบ (รอผู้รับเหมา)")}
        >
          LP รับทราบ (
          {
            requests.filter((r) => r.status === "LP รับทราบ (รอผู้รับเหมา)")
              .length
          }
          )
        </button>
        <button
          style={filter === "รอ LP ตรวจสอบ" ? filterBtnActive : filterBtn}
          onClick={() => setFilter("รอ LP ตรวจสอบ")}
        >
          รอ LP ตรวจสอบ (
          {requests.filter((r) => r.status === "รอ LP ตรวจสอบ").length})
        </button>
        <button
          style={filter === "อนุมัติเข้าทำงาน" ? filterBtnActive : filterBtn}
          onClick={() => setFilter("อนุมัติเข้าทำงาน")}
        >
          อนุมัติแล้ว (
          {requests.filter((r) => r.status === "อนุมัติเข้าทำงาน").length})
        </button>
        <button
          style={filter === "ไม่อนุมัติ" ? filterBtnActive : filterBtn}
          onClick={() => setFilter("ไม่อนุมัติ")}
        >
          ไม่อนุมัติ ({requests.filter((r) => r.status === "ไม่อนุมัติ").length})
        </button>
      </div>

      {/* Requests Grid */}
      {filteredRequests.length === 0 ? (
        <div style={empty}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            ไม่มีงานในหมวดนี้
          </div>
          <div style={{ fontSize: 14 }}>
            {filter === "all"
              ? "ยังไม่มีสมาชิกส่งงานเข้ามา"
              : `ไม่มีงานที่มีสถานะ "${filter}"`}
          </div>
        </div>
      ) : (
        <div style={cardsGrid}>
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              style={card}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={cardHeader}>
                <div style={{ flex: 1 }}>
                  <div style={cardTitle}>
                    {request.shopName} - {request.floor}
                  </div>
                  <div style={cardMeta}>
                    ส่งโดย: <strong>{request.submittedByName}</strong> ({request.requesterEmail})
                  </div>
                </div>
                <span style={getStatusBadgeStyle(request.status)}>
                  {request.status}
                </span>
              </div>

              <div style={cardBody}>
                <div
                  style={{
                    fontSize: 14,
                    color: "#374151",
                    marginBottom: 16,
                    lineHeight: 1.6,
                  }}
                >
                  {request.workDetails}
                </div>

                <div style={infoRow}>
                  <div style={infoItem}>
                    <span style={infoLabel}>ผู้รับเหมา</span>
                    <span style={infoValue}>{request.contractorName}</span>
                  </div>
                  <div style={infoItem}>
                    <span style={infoLabel}>เบอร์ติดต่อ</span>
                    <span style={infoValue}>{request.contractorContactPhone}</span>
                  </div>
                  <div style={infoItem}>
                    <span style={infoLabel}>เริ่มงาน</span>
                    <span style={infoValue}>
                      {new Date(request.workStartDateTime).toLocaleString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div style={infoItem}>
                    <span style={infoLabel}>สิ้นสุด</span>
                    <span style={infoValue}>
                      {new Date(request.workEndDateTime).toLocaleString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div style={infoItem}>
                    <span style={infoLabel}>วันที่ส่ง</span>
                    <span style={infoValue}>
                      {new Date(request.createdAt).toLocaleString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {request.linkedPermitRID && (
                    <div style={infoItem}>
                      <span style={infoLabel}>Permit RID</span>
                      <span style={infoValue}>{request.linkedPermitRID}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
