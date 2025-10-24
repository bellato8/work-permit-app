// ======================================================================
// File: web/src/pages/Login.tsx
// เวอร์ชัน: 2025-09-18 02:20 (+07)
// หน้าที่: ฟอร์มเข้าสู่ระบบผู้ดูแล (Email/Password + Google) พร้อม Gate สิทธิ์ด้วย Firestore
// สิ่งที่เปลี่ยนรอบนี้:
//   • ลบข้อความเงื่อนไขภายใน (admins/<emailLower>) ออกจาก UI
//   • ปรับข้อความ error ภาษาไทยให้อ่านง่าย
//   • เพิ่ม smart redirect: กลับไปหน้าที่ถูกกันไว้ (รองรับ state.from และ ?next=)
//   • เพิ่มลิงก์ "ขอสิทธิ์เข้าใช้งาน" (mailto) แทนการเปิดเผยโครงสร้างภายใน
//   • คงการบันทึกล็อก logAuth(kind:"login") และฟังก์ชัน ensureAdminGate
//
// คำอ่าน/ความหมาย:
//   • Redirect (รีไดเรกต์) = ส่งผู้ใช้ไปหน้าอื่นอัตโนมัติหลังทำงานเสร็จ
//   • Provider (โพรไวเดอร์) = ตัวให้บริการล็อกอิน (เช่น Google)
//   • Payload (เพย์โหลด) = ข้อมูลที่ส่งไปยัง API (รูปแบบ JSON)
//
// หมายเหตุความปลอดภัย:
//   • ห้ามฮาร์ดโค้ดคีย์/URL ใช้ค่าจาก .env ผ่าน helper (เช่น logAuth)
//   • Gate สิทธิ์ยังคงเดิม: ต้องผ่าน ensureAdminGate ก่อนเข้า /admin
// ======================================================================

import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { logAuth } from "../lib/logAuth";

// ตรวจสิทธิ์จาก Firestore: มีเอกสารใน admins/<emailLower> หรือ users/<uid> ที่ role=admin/manager
async function ensureAdminGate(email?: string, uid?: string) {
  const mail = (email || "").trim().toLowerCase();
  if (!mail) throw new Error("บัญชีนี้ไม่มีอีเมล");

  const ref = doc(db, "admins", mail);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    if (uid) {
      const us = await getDoc(doc(db, "users", uid));
      const role = (us.data()?.role || "").toString().toLowerCase();
      if (role === "admin" || role === "manager") return true;
    }
    // ข้อความใหม่: สุภาพและให้ทางออก โดยไม่เปิดเผยโครงสร้างภายใน
    throw new Error("ล็อกอินสำเร็จแล้ว แต่บัญชีของคุณยังไม่ได้รับสิทธิ์ผู้ดูแล โปรดกด “ขอสิทธิ์เข้าใช้งาน” หรือติดต่อผู้ดูแลระบบ");
  }
  return true;
}

// แปลงรหัส error จาก Firebase → ข้อความไทย
function mapAuthError(err: any): string {
  const code = (err?.code || "").toString();
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
  }
  if (code === "auth/invalid-email") return "รูปแบบอีเมลไม่ถูกต้อง";
  if (code === "auth/user-disabled") return "บัญชีนี้ถูกปิดใช้งาน โปรดติดต่อผู้ดูแลระบบ";
  if (code === "auth/user-not-found") return "ไม่พบบัญชีนี้ในระบบ";
  if (code === "auth/network-request-failed") return "เครือข่ายขัดข้อง กรุณาลองใหม่";
  return err?.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
}

export default function Login() {
  const loc = useLocation();
  const navigate = useNavigate();

  const [email, setEmail]     = useState("");
  const [pw, setPw]           = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // คำนวณปลายทางหลังล็อกอิน: state.from (ถ้ามี) > ?next= > /admin
  function getNextPath(): string {
    const stateFrom = (loc.state as any)?.from;
    if (stateFrom?.pathname) {
      const search = stateFrom.search ?? "";
      const hash = stateFrom.hash ?? "";
      return `${stateFrom.pathname}${search}${hash}`;
    }
    const params = new URLSearchParams(loc.search);
    const next = params.get("next");
    if (next && next.startsWith("/")) return next;
    return "/admin";
  }

  async function finishAndGo() {
    const dest = getNextPath();
    navigate(dest, { replace: true });
  }

  async function handleEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pw);
      await ensureAdminGate(cred.user.email || undefined, cred.user.uid);

      // บันทึกล็อก (ไม่บล็อกการเข้า หากล้มเหลวจะเพียง warn)
      try {
        await logAuth({
          kind: "login",
          email: cred.user.email ?? undefined,
          uid: cred.user.uid,
          name: cred.user.displayName ?? undefined,
        });
      } catch (e) {
        console.warn("[Login] logAuth(login) failed:", e);
      }

      await finishAndGo();
    } catch (err: any) {
      try { await signOut(auth); } catch {}
      setMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setMsg("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await ensureAdminGate(cred.user.email || undefined, cred.user.uid);

      try {
        await logAuth({
          kind: "login",
          email: cred.user.email ?? undefined,
          uid: cred.user.uid,
          name: cred.user.displayName ?? undefined,
        });
      } catch (e) {
        console.warn("[Login] logAuth(login) failed:", e);
      }

      await finishAndGo();
    } catch (err: any) {
      try { await signOut(auth); } catch {}
      setMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword() {
    if (!email.trim()) {
      setMsg("กรุณากรอกอีเมลก่อนกดลืมรหัสผ่าน");
      return;
    }
    setShowConfirmModal(true);
  }

  async function confirmSendResetEmail() {
    setShowConfirmModal(false);
    setMsg("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setMsg(`ส่งอีเมลสำหรับรีเซ็ตรหัสผ่านไปที่ ${email.trim()} แล้ว โปรดตรวจสอบกล่องจดหมาย`);
    } catch (err: any) {
      setMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  // mailto “ขอสิทธิ์เข้าใช้งาน” (ไม่เปิดเผยโครงสร้างภายใน)
  const requestAccessHref = (() => {
    const subject = encodeURIComponent("ขอเปิดสิทธิ์ผู้ดูแลระบบ (Work Permit)");
    const body = encodeURIComponent(
      `เรียนผู้ดูแลระบบ\n\nขอเปิดสิทธิ์ผู้ดูแลระบบให้บัญชี:\nอีเมล: ${email || "(กรอกอีเมลในแบบฟอร์ม)"}\nเหตุผล: \n\nขอบคุณครับ/ค่ะ`
    );
    // ถ้าต้องการเปลี่ยนปลายทาง ให้แก้เป็นอีเมลแอดมินของคุณเอง
    return `mailto:asm.sutthirak@gmail.com?subject=${subject}&body=${body}`;
  })();

  return (
    <div className="login-shell">
      {/* ซีกซ้าย: branding / ภาพ */}
      <aside className="login-hero">
        <div className="login-hero-inner">
          <div className="brand-chip">Work Permit</div>
          <h2>ระบบขออนุญาตทำงาน</h2>
          <p>จัดการคำขอ, อนุมัติ, ติดตามสถานะ — ทั้งหมดในที่เดียว</p>
        </div>
        <div className="hero-gradient" />
      </aside>

      {/* ซีกขวา: ฟอร์มล็อกอิน */}
      <main className="login-panel">
        <div className="login-card glass">
          <header className="login-header">
            <h1>เข้าสู่ระบบผู้ดูแล</h1>
            <p className="muted">ใช้บัญชีจาก Firebase Authentication</p>
          </header>

          <form onSubmit={handleEmailPassword} className="login-form">
            <label className="lbl">อีเมล</label>
            <input
              className="inp"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />

            <label className="lbl">รหัสผ่าน</label>
            <div className="pw-row">
              <input
                className="inp pw"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPw ? "ซ่อน" : "แสดง"}
              </button>
            </div>

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>

            <div className="or-line" style={{ margin: "1rem 0" }}>
              <span>หรือ</span>
            </div>

            <button
              type="button"
              className="btn-google w-full"
              onClick={handleGoogle}
              disabled={loading}
            >
              เข้าสู่ระบบด้วย Google
            </button>

            {/* ข้อความแจ้งสถานะ/ข้อผิดพลาด (อ่านออกเสียงโดยโปรแกรมอ่านหน้าจอ) */}
            {msg && (
              <p className="error mt-3" aria-live="polite">
                {msg}
              </p>
            )}

            {/* ข้อความช่วยเหลือ (แทนที่ย่อหน้าเงื่อนไขภายในเดิม) */}
            <p className="hint" style={{ marginTop: "12px" }}>
              ต้องการสิทธิ์ผู้ดูแล?{" "}
              <a className="link" href={requestAccessHref}>
                ขอสิทธิ์เข้าใช้งาน
              </a>{" "}
              หรือ ติดต่อผู้ดูแลระบบ
            </p>
          </form>

          <footer className="login-footer">
            <a href="/" className="link">กลับหน้าแรก</a>
            <span>•</span>
            <a href="/status" className="link">ตรวจสอบสถานะ</a>
            <span>•</span>
            <button
              onClick={handleForgotPassword}
              className="link"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit" }}
            >
              ลืมรหัสผ่าน?
            </button>
          </footer>

          {/* Version number */}
          <div style={{ position: "absolute", bottom: "16px", right: "16px", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
            v1.0.0
          </div>
        </div>
      </main>

      {/* ป๊อปอัปยืนยันส่งอีเมลรีเซ็ตรหัสผ่าน */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 50,
          }}
        >
          <div className="login-card glass" style={{ maxWidth: "420px" }}>
            <h2 style={{ fontSize: "1.25rem", marginTop: 0 }}>ยืนยันการส่งอีเมล</h2>
            <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.5rem" }}>
              ระบบจะส่งอีเมลสำหรับตั้งรหัสผ่านใหม่ไปที่: <br />
              <strong style={{ color: "#e6eaf2" }}>{email}</strong>
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirmModal(false)} className="btn-ghost" style={{ padding: "0.6rem 1rem" }}>
                ยกเลิก
              </button>
              <button onClick={confirmSendResetEmail} className="btn-primary" style={{ padding: "0.6rem 1rem" }}>
                ยืนยันและส่งอีเมล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
