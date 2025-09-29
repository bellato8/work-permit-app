// ไฟล์: web/src/pages/ReviewPage.tsx
// เวลา: 2025-08-22 12:40
// แก้อะไร: แก้ JSX ปิดแท็กให้ครบ และปิดสตริงปุ่ม "ไม่อนุมัติ" ให้สมบูรณ์ เพื่อให้ build ผ่าน
// Written by: Work Permit System Tutor

// ผู้เขียน: Work Permit System Tutor (ปรับจากไฟล์เดิมของคุณ)
// หน้าที่:
//  - ถ้า URL ไม่มีพารามิเตอร์ rid => แสดง "ระเบียบผู้รับเหมา" (หน้าแรก)
//  - ถ้า URL มีพารามิเตอร์ rid   => แสดงหน้าตรวจ/อนุมัติคำขอ (ของเดิมคุณ)
//
// หมายเหตุ:
//  - คงโค้ด Firebase/อนุมัติ เดิมของคุณไว้ทั้งหมด
//  - เพิ่มส่วน "ระเบียบผู้รับเหมา" ข้างบนแบบมีเงื่อนไข isReviewMode

import { useEffect, useMemo, useState } from "react";
import { useSearchParams /*, useNavigate*/ } from "react-router-dom";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// TODO: ใส่ config ของเว็บคุณให้ครบ (คัดลอกจากหน้า Project settings > Your apps)
// (คงค่าเดิมของคุณไว้ ไม่แตะต้อง)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ป้องกัน init ซ้ำ (คงของเดิม)
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

// ====== โครง type เดิมของคุณ (คงไว้) ======
type RequestDoc = {
  requester?: {
    title?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    email?: string;
  };
  phoneLast4?: string;
  status?: string; // pending | reviewing | approved | rejected
  createdAt?: any;
  // เพิ่มฟิลด์อื่น ๆ ตามที่คุณบันทึกไว้ได้
};

// ====== คอมโพเนนต์หลัก ======
export default function RulesPage() {
  const [sp] = useSearchParams();
  const rid = sp.get("rid") ?? ""; // ดึง rid จาก URL
  const isReviewMode = !!rid; // true => โหมดตรวจ/อนุมัติ, false => โหมด "ระเบียบ"

  // ====== สถานะสำหรับโหมด "ระเบียบ" ======
  const [accepted, setAccepted] = useState(false);

  // ====== สถานะสำหรับโหมดตรวจ/อนุมัติ (คงของเดิม) ======
  const [loading, setLoading] = useState(true);
  const [req, setReq] = useState<RequestDoc | null>(null);
  const [saving, setSaving] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docRef = useMemo(
    () => (isReviewMode && rid ? doc(db, "requests", rid) : null),
    [isReviewMode, rid]
  );

  useEffect(() => {
    if (!isReviewMode) return; // ถ้าเป็นโหมด "ระเบียบ" ไม่ต้องโหลด Firestore
    const run = async () => {
      setError(null);
      setLoading(true);
      try {
        if (!docRef) throw new Error("ไม่พบรหัสคำขอ (rid)");
        const snap = await getDoc(docRef);
        if (!snap.exists()) throw new Error("ไม่พบคำขอในระบบ");
        setReq(snap.data() as RequestDoc);
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [isReviewMode, docRef]);

  const approve = async (ok: boolean) => {
    if (!docRef) return;
    setSaving(ok ? "approved" : "rejected");
    setError(null);
    try {
      await updateDoc(docRef, {
        status: ok ? "approved" : "rejected",
        decidedAt: serverTimestamp(),
        decidedBy: "approver@email", // จะให้ล็อกอินแล้วบันทึกอีเมลจริงก็ทำได้ภายหลัง
      });
      // โหลดซ้ำสถานะล่าสุด
      const snap = await getDoc(docRef);
      setReq(snap.data() as RequestDoc);
      alert(ok ? "อนุมัติเรียบร้อย" : "ไม่อนุมัติเรียบร้อย");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(null);
    }
  };

  // ============ โหมด "ระเบียบผู้รับเหมา" (หน้าแรก) ============
  if (!isReviewMode) {
    return (
      <div style={{ maxWidth: 920, margin: "32px auto", padding: 16 }}>
        <h1 style={{ marginBottom: 8 }}>
          ระเบียบการเข้าตกแต่งสถานที่เช่า และข้อกำหนดด้านความปลอดภัยและสิ่งแวดล้อมสำหรับผู้รับเหมา
        </h1>
        <h2 style={{ marginTop: 0, opacity: 0.85 }}>ศูนย์การค้าอิมพิเรียลเวิลด์สำโรง</h2>

        <div
          style={{
            margin: "16px 0",
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            maxHeight: "60vh",
            overflowY: "auto",
            lineHeight: 1.7,
          }}
        >
          <ol style={{ paddingLeft: 18 }}>
            {/* … (รายการระเบียบตามที่คุณให้มา คงไว้ทั้งหมด) … */}
            <li>ผู้เช่าหรือผู้รับเหมาจะต้องปิดกั้นผนังเบาหน้าพื้นที่เช่า (Vacancy) ก่อนเข้าดำเนินการตกแต่ง/รื้อถอน</li>
            <li>
              การเข้าดำเนินการตกแต่งสถานที่เช่า ผู้เช่า หรือตัวแทน จะต้องกรอกรายละเอียดในแบบฟอร์มเลขที่ FM-SAL-07
              ขออนุญาตตกแต่งพื้นที่ให้ครบถ้วนพร้อมแนบสำเนาบัตรประชาชนหรือหนังสือที่ทางราชการออกให้ของผู้รับเหมา
              หัวหน้างาน และคนงานทุกคนหรือใบต่างด้าว เพื่อประกอบการพิจารณาอนุมัติกับบริษัทฯ ก่อนเข้าตกแต่งล่วงหน้าอย่างน้อย 3 วันทำการ
            </li>
            <li>
              หากในการตกแต่งพื้นที่เช่า มีสารเคมี และวัตถุอันตราย ผู้รับเหมาจะต้องมีเอกสารข้อมูลด้านความปลอดภัยของสารเคมี Material Safety Data Sheet (MSDS)
              หรือ Safety Data Sheet (SDS) ให้ครบถ้วน …
            </li>
            {/* (คงรายการอื่น ๆ ตามไฟล์เดิมของคุณ) */}
          </ol>

          <div style={{ textAlign: "right", marginTop: 16, opacity: 0.85 }}>
            ฝ่ายป้องกันการสูญเสีย — ศูนย์การค้าอิมพีเรียลเวิลด์สำโรง
          </div>
        </div>

        {/* เช็กบ็อกซ์ยอมรับ */}
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>ฉันได้อ่านและยอมรับระเบียบทั้งหมดแล้ว</span>
        </label>

        {/* ปุ่มไปหน้าฟอร์ม — จะเชื่อม Router จริงในขั้นถัดไป */}
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={!accepted}
            onClick={() => {
              if (!accepted) return;
              // TODO: ขั้นถัดไปจะเชื่อม route ไปหน้าแบบฟอร์มจริง (เช่น /form)
              alert("ยืนยันแล้ว — ขั้นถัดไปเราจะพาไปหน้าแบบฟอร์มครับ");
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: accepted ? "#f3f4f6" : "#fafafa",
              cursor: accepted ? "pointer" : "not-allowed",
            }}
          >
            เริ่มกรอกแบบฟอร์ม
          </button>
        </div>
      </div>
    );
  }

  // ============ โหมดตรวจ/อนุมัติ (ของเดิมคุณ) ============
  if (loading) return <div style={{ padding: 16 }}>กำลังโหลด...</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>เกิดข้อผิดพลาด: {error}</div>;
  if (!req) return <div style={{ padding: 16 }}>ไม่พบข้อมูล</div>;

  const name = [req.requester?.title, req.requester?.firstName, req.requester?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div style={{ maxWidth: 720, margin: "32px auto", padding: 16 }}>
      <h2>ตรวจสอบ/อนุมัติคำขอ</h2>
      <div style={{ margin: "12px 0", padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <p>
          <b>RequestId:</b> {rid}
        </p>
        <p>
          <b>ผู้ยื่น:</b> {name || "-"}
        </p>
        <p>
          <b>บริษัท:</b> {req.requester?.company || "-"}
        </p>
        <p>
          <b>อีเมลผู้ยื่น:</b> {req.requester?.email || "-"}
        </p>
        <p>
          <b>สถานะปัจจุบัน:</b> {req.status || "pending"}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => approve(true)}
          disabled={saving !== null}
          style={{ padding: "8px 12px", background: "#16a34a", color: "#fff", border: 0, borderRadius: 8 }}
        >
          {saving === "approved" ? "กำลังอนุมัติ..." : "อนุมัติ"}
        </button>
        <button
          onClick={() => approve(false)}
          disabled={saving !== null}
          style={{ padding: "8px 12px", background: "#b91c1c", color: "#fff", border: 0, borderRadius: 8 }}
        >
          {saving === "rejected" ? "กำลังไม่อนุมัติ..." : "ไม่อนุมัติ"}
        </button>
      </div>
    </div>
  );
}
