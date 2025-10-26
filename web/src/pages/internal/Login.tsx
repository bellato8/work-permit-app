//======================================================================
// File: web/src/pages/internal/Login.tsx
// เวอร์ชัน: 27/10/2025 00:35 (Asia/Bangkok)
// หน้าที่: หน้าเข้าสู่ระบบสำหรับ Internal Portal (อีเมล/รหัสผ่าน)
// เชื่อม auth ผ่าน "อะแดปเตอร์": Firebase Auth (signInWithEmailAndPassword)
// เปลี่ยนแปลงรอบนี้:
// • [เพิ่มกลับ] onAuthStateChanged → auto-redirect ถ้ามี session อยู่แล้ว
// • [คงไว้] Remember me → สลับ Local/Session persistence
// • [คงไว้] รองรับ redirect ผ่าน query ?to=... (fallback /internal/requests)
// • [เพิ่ม] ตรวจรูปแบบอีเมลเบื้องต้นก่อนยิง sign-in
// หมายเหตุ: ใช้ฟอนต์ Sarabun ให้โทนเดียวกับทั้งระบบ
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 27/10/2025 00:35
// ======================================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";

const wrap: React.CSSProperties = {
  minHeight: "100dvh", // ใช้ dvh เพื่อรองรับมือถือ
  display: "grid",
  placeItems: "center",
  background: "#f3f4f6",
  fontFamily: "Sarabun, sans-serif",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 10px 20px rgba(0,0,0,0.04)",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 800,
};

const subtitle: React.CSSProperties = {
  marginTop: 6,
  marginBottom: 18,
  color: "#6b7280",
  fontSize: 14,
};

const labelCss: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  marginBottom: 6,
  color: "#374151",
};

const inputCss: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  outline: "none",
} as const;

const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const danger: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: "10px 12px",
  borderRadius: 8,
  fontSize: 13,
};

const small: React.CSSProperties = { fontSize: 12, color: "#6b7280" };

function mapAuthError(code?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "อีเมลไม่ถูกต้อง";
    case "auth/user-disabled":
      return "บัญชีนี้ถูกปิดการใช้งาน";
    case "auth/user-not-found":
      return "ไม่พบบัญชีผู้ใช้นี้";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "auth/too-many-requests":
      return "พยายามมากเกินไป กรุณาลองใหม่ภายหลัง";
    case "auth/network-request-failed":
      return "เครือข่ายมีปัญหา กรุณาตรวจสอบการเชื่อมต่อ";
    default:
      return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
  }
}

export default function InternalLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  const nextPath = useMemo(() => {
    // อนุญาต redirect ผ่าน query ?to=/internal/requests (fallback)
    try {
      const q = new URLSearchParams(location.search);
      return q.get("to") || "/internal/requests";
    } catch {
      return "/internal/requests";
    }
  }, [location.search]);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ถ้ามี session อยู่แล้ว → redirect อัตโนมัติ
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate(nextPath, { replace: true });
      }
    });
    return () => unsub();
  }, [auth, navigate, nextPath]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (busy) return;

      setErr(null);

      const emailTrim = email.trim().toLowerCase();
      const passTrim = pass;

      if (!emailTrim) {
        setErr("กรุณาระบุอีเมล");
        return;
      }
      // ตรวจรูปแบบอีเมลเบื้องต้น
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
      if (!emailOk) {
        setErr("รูปแบบอีเมลไม่ถูกต้อง");
        return;
      }
      if (!passTrim) {
        setErr("กรุณาระบุรหัสผ่าน");
        return;
      }

      setBusy(true);
      try {
        // ตั้งค่าการคงสถานะการล็อกอิน
        await setPersistence(
          auth,
          remember ? browserLocalPersistence : browserSessionPersistence
        );

        await signInWithEmailAndPassword(auth, emailTrim, passTrim);
        navigate(nextPath, { replace: true });
      } catch (e: any) {
        const msg = mapAuthError(e?.code);
        setErr(msg);
      } finally {
        setBusy(false);
      }
    },
    [auth, email, pass, remember, nextPath, navigate, busy]
  );

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={title}>เข้าสู่ระบบ (พนักงานภายใน)</h1>
        <p style={subtitle}>
          เข้าสู่ระบบเพื่อส่งคำขอเข้าทำงานและติดตามสถานะในระบบ Work Permit
        </p>

        {err ? <div style={{ ...danger, marginBottom: 12 }}>{err}</div> : null}

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelCss} htmlFor="email">
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="name@company.com"
              style={inputCss}
              autoComplete="username"
              disabled={busy}
              required
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelCss} htmlFor="password">
              รหัสผ่าน
            </label>
            <input
              id="password"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.currentTarget.value)}
              placeholder="••••••••"
              style={inputCss}
              autoComplete="current-password"
              disabled={busy}
              required
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              gap: 12,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.currentTarget.checked)}
                disabled={busy}
              />
              <span style={{ fontSize: 14 }}>จำฉันไว้</span>
            </label>

            {/* (อนาคต) ลิงก์ลืมรหัสผ่าน */}
            {/* <a href="/internal/forgot" style={{ fontSize: 14 }}>ลืมรหัสผ่าน?</a> */}
          </div>

          <button type="submit" style={btn} disabled={busy}>
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          <span style={small}>
            หลังจากเข้าสู่ระบบ ระบบจะนำคุณไปยังหน้า “คำขอของฉัน”
          </span>
        </div>
      </div>
    </div>
  );
}
