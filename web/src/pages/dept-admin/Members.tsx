//======================================================================
// File: web/src/pages/dept-admin/Members.tsx
// หน้าที่: จัดการสมาชิกในแผนก (เพิ่ม/ลบ/แก้ไข)
// สร้างเมื่อ: 30/10/2025
// คุณสมบัติ:
//   - แสดงรายชื่อสมาชิกในแผนก
//   - เพิ่มสมาชิกใหม่
//   - แก้ไขข้อมูลสมาชิก
//   - ปิด/เปิดการใช้งานสมาชิก
//======================================================================
import React, { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getFirestore,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { DepartmentAdmin, DepartmentMember } from "../../types";

const pageTitle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 8,
};

const pageHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 32,
};

const addBtn: React.CSSProperties = {
  padding: "12px 20px",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const tableContainer: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  overflow: "hidden",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  background: "#f9fafb",
  padding: "16px 20px",
  textAlign: "left",
  fontSize: 14,
  fontWeight: 700,
  color: "#374151",
  borderBottom: "2px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid #f3f4f6",
  fontSize: 14,
  color: "#111827",
};

const badge: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  display: "inline-block",
};

const actionBtn: React.CSSProperties = {
  padding: "6px 12px",
  background: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  marginRight: 8,
};

const modal: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContent: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 32,
  width: "100%",
  maxWidth: 500,
  maxHeight: "90vh",
  overflowY: "auto",
};

const modalTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  marginBottom: 20,
  color: "#111827",
};

const formGroup: React.CSSProperties = {
  marginBottom: 16,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 6,
  color: "#374151",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
};

const modalActions: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 24,
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: "12px 20px",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  padding: "12px 20px",
  background: "#f3f4f6",
  color: "#374151",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 600,
};

const loading: React.CSSProperties = {
  textAlign: "center",
  padding: 40,
  color: "#6b7280",
};

const error: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: "12px 16px",
  borderRadius: 8,
  marginBottom: 16,
};

export default function DeptAdminMembers() {
  const { admin } = useOutletContext<{ admin: DepartmentAdmin }>();
  const db = getFirestore();
  const auth = getAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<DepartmentMember | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    position: "",
    phone: "",
  });

  useEffect(() => {
    loadMembers();

    // Check if should open add modal
    if (searchParams.get("action") === "add") {
      setShowModal(true);
      setSearchParams({});
    }
  }, [admin.department]);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const membersRef = collection(db, "dept_members");
      const q = query(membersRef, where("department", "==", admin.department));
      const snapshot = await getDocs(q);

      const membersList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DepartmentMember[];

      // Sort by name
      membersList.sort((a, b) => a.fullName.localeCompare(b.fullName, "th"));

      setMembers(membersList);
    } catch (error) {
      console.error("Error loading members:", error);
      setErrorMsg("ไม่สามารถโหลดข้อมูลสมาชิกได้");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (member?: DepartmentMember) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        email: member.email,
        fullName: member.fullName,
        position: member.position || "",
        phone: member.phone || "",
      });
    } else {
      setEditingMember(null);
      setFormData({
        email: "",
        fullName: "",
        position: "",
        phone: "",
      });
    }
    setShowModal(true);
    setErrorMsg(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMember(null);
    setFormData({
      email: "",
      fullName: "",
      position: "",
      phone: "",
    });
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.email || !formData.fullName) {
      setErrorMsg("กรุณากรอกอีเมลและชื่อ-นามสกุล");
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (editingMember) {
        // Update existing member
        const memberRef = doc(db, "dept_members", editingMember.id);
        await updateDoc(memberRef, {
          email: formData.email.toLowerCase(),
          fullName: formData.fullName,
          position: formData.position,
          phone: formData.phone,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Add new member
        const membersRef = collection(db, "dept_members");
        await addDoc(membersRef, {
          email: formData.email.toLowerCase(),
          fullName: formData.fullName,
          department: admin.department,
          position: formData.position,
          phone: formData.phone,
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          addedBy: currentUser.uid,
        });
      }

      await loadMembers();
      handleCloseModal();
    } catch (error: any) {
      console.error("Error saving member:", error);
      setErrorMsg("ไม่สามารถบันทึกข้อมูลได้: " + error.message);
    }
  };

  const handleToggleEnabled = async (member: DepartmentMember) => {
    try {
      const memberRef = doc(db, "dept_members", member.id);
      await updateDoc(memberRef, {
        enabled: !member.enabled,
        updatedAt: new Date().toISOString(),
      });
      await loadMembers();
    } catch (error) {
      console.error("Error toggling member status:", error);
      alert("ไม่สามารถเปลี่ยนสถานะได้");
    }
  };

  if (isLoading) {
    return <div style={loading}>กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div>
      <div style={pageHeader}>
        <div>
          <h1 style={pageTitle}>สมาชิกในแผนก</h1>
          <p style={{ color: "#6b7280", marginTop: 8 }}>
            จัดการสมาชิกของแผนก {admin.department}
          </p>
        </div>
        <button style={addBtn} onClick={() => handleOpenModal()}>
          <span>➕</span>
          <span>เพิ่มสมาชิกใหม่</span>
        </button>
      </div>

      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>ชื่อ-นามสกุล</th>
              <th style={th}>อีเมล</th>
              <th style={th}>ตำแหน่ง</th>
              <th style={th}>เบอร์โทร</th>
              <th style={th}>สถานะ</th>
              <th style={th}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: "center", padding: 40, color: "#6b7280" }}>
                  ยังไม่มีสมาชิกในแผนก
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id}>
                  <td style={td}>{member.fullName}</td>
                  <td style={td}>{member.email}</td>
                  <td style={td}>{member.position || "-"}</td>
                  <td style={td}>{member.phone || "-"}</td>
                  <td style={td}>
                    <span
                      style={{
                        ...badge,
                        background: member.enabled ? "#d1fae5" : "#fee2e2",
                        color: member.enabled ? "#065f46" : "#991b1b",
                      }}
                    >
                      {member.enabled ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td style={td}>
                    <button style={actionBtn} onClick={() => handleOpenModal(member)}>
                      แก้ไข
                    </button>
                    <button
                      style={{
                        ...actionBtn,
                        marginRight: 0,
                        background: member.enabled ? "#fee2e2" : "#d1fae5",
                        borderColor: member.enabled ? "#fecaca" : "#6ee7b7",
                        color: member.enabled ? "#991b1b" : "#065f46",
                      }}
                      onClick={() => handleToggleEnabled(member)}
                    >
                      {member.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={modal} onClick={handleCloseModal}>
          <div style={modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>
              {editingMember ? "แก้ไขข้อมูลสมาชิก" : "เพิ่มสมาชิกใหม่"}
            </h2>

            {errorMsg && <div style={error}>{errorMsg}</div>}

            <form onSubmit={handleSubmit}>
              <div style={formGroup}>
                <label style={label} htmlFor="email">
                  อีเมล *
                </label>
                <input
                  id="email"
                  type="email"
                  style={input}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingMember}
                />
              </div>

              <div style={formGroup}>
                <label style={label} htmlFor="fullName">
                  ชื่อ-นามสกุล *
                </label>
                <input
                  id="fullName"
                  type="text"
                  style={input}
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div style={formGroup}>
                <label style={label} htmlFor="position">
                  ตำแหน่ง
                </label>
                <input
                  id="position"
                  type="text"
                  style={input}
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>

              <div style={formGroup}>
                <label style={label} htmlFor="phone">
                  เบอร์โทร
                </label>
                <input
                  id="phone"
                  type="tel"
                  style={input}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div style={modalActions}>
                <button type="button" style={secondaryBtn} onClick={handleCloseModal}>
                  ยกเลิก
                </button>
                <button type="submit" style={primaryBtn}>
                  {editingMember ? "บันทึก" : "เพิ่มสมาชิก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
