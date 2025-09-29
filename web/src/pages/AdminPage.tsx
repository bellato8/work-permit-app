// ======================================================================
// File: web/src/pages/ApprovePage.tsx
// เวอร์ชัน: 19/09/2025 13:10 (RBAC-only: ตัดการพึ่ง key, เพิ่ม Authorization + x-requester-email)
// หน้าที่: หน้าอนุมัติ/ไม่อนุมัติจากลิงก์อีเมล (public) โดย "บังคับ RBAC เสมอ"
// เชื่อม auth ผ่าน: firebase/auth (getIdToken เพื่อแนบ Authorization: Bearer <token>)
// หมายเหตุ:
//   • ไม่ใช้ Approver Key อีกต่อไป (เลิกพึ่ง key)
//   • ต้องมี "ตัวตน" อย่างน้อยหนึ่ง: (1) ล็อกอิน Firebase หรือ (2) ส่ง ?email=<approver@...> ในลิงก์
//   • ส่ง decision/status = "approved" | "rejected" (และแนบ to=... เผื่อรองรับโค้ดหลังบ้านรุ่นเก่า)
// วันที่/เวลา: 19/09/2025 13:10
// ======================================================================

import React, { useMemo, useState } from "react";
import { getAuth } from "firebase/auth";

type ApiResp = { ok: boolean; error?: string; message?: string };

const UPDATE_URL =
  ((import.meta.env.VITE_UPDATE_STATUS_URL as string | undefined)?.trim()) ||
  "https://updatestatus-aa5gfxjdmq-as.a.run.app"; // ปรับให้ตรงโปรเจกต์จริงหากต่าง

function useInitials() {
  return useMemo(() => {
    const u = new URL(location.href);
    const rid = u.searchParams.get("rid") || "";
    // email ผู้ทำรายการ (สำหรับ fallback หากยังไม่ล็อกอิน)
    const requesterFromUrl = (u.searchParams.get("email") || "").trim().toLowerCase();
    return { rid, requesterFromUrl };
  }, []);
}

export default function ApprovePage() {
  const init = useInitials();

  const [rid, setRid] = useState(init.rid);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ApiResp | null>(null);

  // ตัวช่วยบอก “เรากำลังทำรายการในชื่อใคร”
  const auth = getAuth();
  const authedEmail = auth.currentUser?.email?.toLowerCase() || "";
  const displayEmail = authedEmail || init.requesterFromUrl || "";

  const canSubmit = !!rid && !!displayEmail && (action === "approve" || (action === "reject" && reason.trim() !== ""));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResp(null);

    if (!rid) {
      alert("ขาด Request ID (rid)");
      return;
    }
    if (!displayEmail) {
      alert("ต้องระบุตัวตนก่อนทำรายการ (ล็อกอิน หรือแนบ ?email= ในลิงก์)");
      return;
    }
    if (action === "reject" && reason.trim() === "") {
      alert("กรุณากรอกเหตุผลเมื่อไม่อนุมัติ");
      return;
    }

    try {
      setLoading(true);

      // เตรียม header
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      // แนบ Authorization: Bearer <ID_TOKEN> ถ้าล็อกอินอยู่
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch {
        // เงียบ—ไม่มีโทเค็นก็ใช้ x-requester-email แทน
      }

      // แนบ x-requester-email เสมอ (ตัดสินใจ RBAC ตามอีเมลนี้)
      headers["x-requester-email"] = displayEmail;

      // ตีความ action → decision/status ที่ backend ใหม่รองรับ
      const decided = action === "approve" ? "approved" : "rejected";

      // body: RBAC only (ไม่มี key แล้ว)
      const body = {
        rid,
        decision: decided,
        status: decided,
        to: decided, // เผื่อหลังบ้านรุ่นเก่าที่อ่าน field นี้
        reason: reason.trim() || undefined,
        requester: displayEmail, // ใส่ซ้ำใน body เผื่อหลังบ้านอ่านจาก body
      };

      // เรียก API (ซ้ำ rid ใน query ให้รองรับโค้ดฝั่ง server ที่อ่านจาก query)
      const url = `${UPDATE_URL}?rid=${encodeURIComponent(rid)}`;
      const r = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const j = (await r.json()) as ApiResp;
      setResp(j);
    } catch (e: any) {
      setResp({ ok: false, error: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-start justify-center p-4">
      <div className="w-full max-w-2xl bg-white/90 border border-slate-200 rounded-2xl p-5 shadow-lg">
        <h1 className="text-2xl font-semibold mb-2">อนุมัติ/ไม่อนุมัติ คำขอ</h1>
        <p className="text-sm text-slate-600 mb-4">
          โหมดความปลอดภัย: <b>RBAC เท่านั้น</b> • ผู้ทำรายการ:{" "}
          {displayEmail ? <b className="text-slate-900">{displayEmail}</b> : <span className="text-rose-600">ยังไม่ระบุตัวตน</span>}
        </p>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div>
            <label className="label">RequestId</label>
            <input
              className="input"
              value={rid}
              onChange={(e) => setRid(e.target.value.trim())}
              placeholder="WP-YYYYMMDD-XXXX"
            />
          </div>

          {/* ตัดช่อง Approver Key ออก (เลิกพึ่ง key) */}

          <div>
            <label className="label">ผลการพิจารณา</label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="approve"
                  checked={action === "approve"}
                  onChange={() => setAction("approve")}
                />{" "}
                อนุมัติ
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="reject"
                  checked={action === "reject"}
                  onChange={() => setAction("reject")}
                />{" "}
                ไม่อนุมัติ
              </label>
            </div>
          </div>

          <div>
            <label className="label">
              เหตุผล <span className="text-slate-400">(จำเป็นเมื่อ “ไม่อนุมัติ”)</span>
            </label>
            <textarea
              className="textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ระบุเหตุผล/เงื่อนไขเพิ่มเติม (สูงสุด ~500 ตัวอักษร)"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn btn-primary" type="submit" disabled={loading || !canSubmit}>
              {loading ? "กำลังส่ง..." : action === "approve" ? "ยืนยันอนุมัติ" : "ยืนยันไม่อนุมัติ"}
            </button>
          </div>
        </form>

        {/* ผลลัพธ์ */}
        {resp && (
          <div
            className={
              "mt-4 rounded-xl p-3 text-sm " +
              (resp.ok
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-rose-200 bg-rose-50 text-rose-800")
            }
          >
            {resp.ok ? (
              <>
                บันทึกสำเร็จ •{" "}
                <a
                  className="underline"
                  href={`/status?rid=${encodeURIComponent(rid)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  เปิดหน้าตรวจสอบสถานะ
                </a>
              </>
            ) : (
              <>ทำรายการไม่สำเร็จ: {resp.error || "unknown error"}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
