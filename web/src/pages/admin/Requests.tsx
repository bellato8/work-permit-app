// web/src/pages/admin/Requests.tsx
// ---------------------------------------------------------------------
// หน้าแอดมิน: แสดงรายการคำขอ โดยเรียกผ่าน API client (แนบ Bearer อัตโนมัติ)
// คำศัพท์:
// - Bearer (แบเรอร์) = วิธีส่งโทเคนในหัว Authorization
// - Authorization (ออเธอไรเซชัน) = ส่วนหัวบอกสิทธิ์เข้าถึง
// ---------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import { apiListRequests, type RequestItem } from "../../lib/apiClient";

type LoadState = "idle" | "loading" | "ok" | "error";

export default function Requests() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  async function load() {
    try {
      setState("loading");
      setErrMsg("");
      const res = await apiListRequests({ limit: 25 });
      setItems(res.data.items || []);
      setState("ok");
    } catch (e: any) {
      setState("error");
      setErrMsg(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      console.error("apiListRequests error:", e);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: "0 0 12px 0" }}>รายการคำขอ (Admin)</h1>

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <button onClick={load}>รีเฟรช</button>
        {state === "loading" && <span>กำลังโหลด…</span>}
        {state === "error" && (
          <span style={{ color: "crimson" }}>
            เกิดข้อผิดพลาด: {errMsg}
          </span>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 720,
          }}
        >
          <thead>
            <tr>
              <th style={th}>RID</th>
              <th style={th}>สถานะ</th>
              <th style={th}>ชื่อผู้รับเหมา</th>
              <th style={th}>สร้างเมื่อ</th>
              <th style={th}>อัปเดตล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, textAlign: "center" }}>
                  {state === "loading" ? "กำลังโหลด…" : "ไม่พบรายการ"}
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.rid}>
                  <td style={td}>{it.rid}</td>
                  <td style={td}>
                    <StatusPill value={it.status} />
                  </td>
                  <td style={td}>{it.contractorName || "-"}</td>
                  <td style={td}>{formatTs(it.createdAt)}</td>
                  <td style={td}>{formatTs(it.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ value }: { value?: string }) {
  const v = (value || "pending").toLowerCase();
  const bg =
    v === "approved" ? "#dcfce7" : v === "rejected" ? "#fee2e2" : "#eef2ff";
  const fg =
    v === "approved" ? "#166534" : v === "rejected" ? "#991b1b" : "#3730a3";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
      }}
    >
      {v}
    </span>
  );
}

function formatTs(ts: any) {
  if (!ts) return "-";
  // รองรับทั้งเลข ms และ Timestamp ของ Firestore
  if (typeof ts === "number") return new Date(ts).toLocaleString();
  if (typeof ts?._seconds === "number")
    return new Date(ts._seconds * 1000).toLocaleString();
  return "-";
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 8,
  borderBottom: "1px solid #e5e7eb",
  background: "#f8fafc",
  position: "sticky",
  top: 0,
};
const td: React.CSSProperties = {
  padding: 8,
  borderBottom: "1px solid #f1f5f9",
};
