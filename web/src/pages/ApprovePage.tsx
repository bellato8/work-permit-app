// ไฟล์: web/src/pages/ApprovePage.tsx
// เวลา: 2025-09-10 21:10
// แก้อะไร: ลบโค้ดซ้ำทั้งไฟล์ให้เหลือคอมโพเนนต์เดียว, ใช้ UPDATE_URL จาก .env, ส่ง POST JSON ถูกต้อง, UI เดิม
// Written by: Work Permit System Tutor

import React, { useMemo, useState } from "react";

type ApiResp = { ok: boolean; error?: string };

// ⚠️ ห้าม hardcode URL - ต้องตั้งค่า VITE_UPDATE_STATUS_URL ใน .env
const UPDATE_URL = import.meta.env.VITE_UPDATE_STATUS_URL as string | undefined;

if (!UPDATE_URL || UPDATE_URL.trim() === "") {
  throw new Error(
    "❌ VITE_UPDATE_STATUS_URL ไม่พบในไฟล์ .env\n" +
    "กรุณาเพิ่มในไฟล์ .env.local:\n" +
    "VITE_UPDATE_STATUS_URL=https://your-api.example.com/updateStatus"
  );
}

export default function ApprovePage() {
  const { initialRid, initialKey } = useMemo(() => {
    const u = new URL(location.href);
    return {
      initialRid: u.searchParams.get("rid") || "",
      initialKey: u.searchParams.get("key") || "",
    };
  }, []);

  const [rid, setRid] = useState(initialRid);
  const [key, setKey] = useState(initialKey);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ApiResp | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResp(null);

    if (!rid || !key) {
      alert("ขาด rid หรือ key");
      return;
    }
    if (action === "reject" && reason.trim() === "") {
      alert("กรุณากรอกเหตุผลเมื่อไม่อนุมัติ");
      return;
    }

    try {
      setLoading(true);
      const url = `${UPDATE_URL}?rid=${encodeURIComponent(rid)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, key, reason: reason.trim() }),
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
        <h1 className="text-2xl font-semibold mb-4">อนุมัติ/ไม่อนุมัติ คำขอ</h1>

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

          <div>
            <label className="label">Approver Key</label>
            <input
              className="input"
              value={key}
              onChange={(e) => setKey(e.target.value.trim())}
              placeholder="คีย์สำหรับผู้อนุมัติ"
            />
            <p className="text-xs text-slate-500 mt-1">
              ระบบจะเติมให้อัตโนมัติถ้าเข้าเพจจากลิงก์ในอีเมล
            </p>
          </div>

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
            <button className="btn btn-primary" type="submit" disabled={loading}>
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
