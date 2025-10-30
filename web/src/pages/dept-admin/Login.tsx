//======================================================================
// File: web/src/pages/dept-admin/Login.tsx
// หน้าที่: หน้าเข้าสู่ระบบสำหรับผู้บริหารแผนก (Department Admin)
// เชื่อม auth ผ่าน Firebase Auth (signInWithEmailAndPassword)
// สร้างเมื่อ: 30/10/2025
// หมายเหตุ:
//   - ตรวจสอบว่าผู้ใช้มีสิทธิ์เป็น deptAdmin หลังจาก login
//   - Redirect ไปยัง /dept-admin/dashboard
//======================================================================
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
import { doc, getDoc, getFirestore } from "firebase/firestore";

const wrap: React.CSSProperties = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  fontFamily: "Sarabun, sans-serif",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 32,
  boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
};

const header: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 24,
};

const icon: React.CSSProperties = {
  fontSize: 48,
  marginBottom: 12,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 800,
  color: "#111827",
};

const subtitle: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  color: "#6b7280",
  fontSize: 14,
};

const labelCss: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  marginBottom: 6,
  color: "#374151",
  fontWeight: 600,
};

const inputCss: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  outline: "none",
  fontSize: 14,
  transition: "border-color 0.2s",
} as const;

const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  padding: "12px 16px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 16,
  cursor: "pointer",
  transition: "transform 0.2s, box-shadow 0.2s",
};

const danger: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: "12px 14px",
  borderRadius: 8,
  fontSize: 14,
};

const info: React.CSSProperties = {
  background: "#dbeafe",
  color: "#1e40af",
  border: "1px solid #bfdbfe",
  padding: "12px 14px",
  borderRadius: 8,
  fontSize: 13,
  marginTop: 16,
};

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

export default function DeptAdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const db = getFirestore();

  const nextPath = useMemo(() => {
    try {
      const q = new URLSearchParams(location.search);
      return q.get("to") || "/dept-admin/dashboard";
    } catch {
      return "/dept-admin/dashboard";
    }
  }, [location.search]);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ถ้ามี session อยู่แล้ว → ตรวจสอบสิทธิ์ก่อน redirect
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // ตรวจสอบว่าเป็น deptAdmin หรือไม่
        try {
          const deptAdminRef = doc(db, "dept_admins", user.email || user.uid);
          const deptAdminSnap = await getDoc(deptAdminRef);

          if (deptAdminSnap.exists() && deptAdminSnap.data()?.enabled) {
            navigate(nextPath, { replace: true });
          } else {
            // ไม่ใช่ dept admin
            await auth.signOut();
            setErr("คุณไม่มีสิทธิ์เข้าถึงระบบผู้บริหารแผนก");
          }
        } catch (e) {
          console.error("Error checking dept admin:", e);
        }
      }
    });
    return () => unsub();
  }, [auth, db, navigate, nextPath]);

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

        const userCred = await signInWithEmailAndPassword(auth, emailTrim, passTrim);

        // ตรวจสอบว่าเป็น dept admin หรือไม่
        const deptAdminRef = doc(db, "dept_admins", emailTrim);
        const deptAdminSnap = await getDoc(deptAdminRef);

        if (!deptAdminSnap.exists()) {
          await auth.signOut();
          setErr("ไม่พบข้อมูลผู้บริหารแผนก กรุณาติดต่อผู้ดูแลระบบ");
          setBusy(false);
          return;
        }

        const deptAdminData = deptAdminSnap.data();
        if (!deptAdminData?.enabled) {
          await auth.signOut();
          setErr("บัญชีของคุณถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
          setBusy(false);
          return;
        }

        // Success - redirect
        navigate(nextPath, { replace: true });
      } catch (e: any) {
        const msg = mapAuthError(e?.code);
        setErr(msg);
        setBusy(false);
      }
    },
    [auth, db, email, pass, remember, nextPath, navigate, busy]
  );

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={header}>
          <div style={icon}>👨‍💼</div>
          <h1 style={title}>ผู้บริหารแผนก</h1>
          <p style={subtitle}>
            เข้าสู่ระบบเพื่อจัดการสมาชิกและดูงานของแผนก
          </p>
        </div>

        {err ? <div style={{ ...danger, marginBottom: 16 }}>{err}</div> : null}

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelCss} htmlFor="email">
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="manager@company.com"
              style={inputCss}
              autoComplete="username"
              disabled={busy}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
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
              marginBottom: 20,
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
          </div>

          <button
            type="submit"
            style={btn}
            disabled={busy}
            onMouseEnter={(e) => {
              if (!busy) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 10px 20px rgba(102, 126, 234, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <div style={info}>
          <strong>💡 หมายเหตุ:</strong> ระบบนี้สำหรับผู้บริหารแผนกเท่านั้น
          <br />
          คุณสามารถ: เพิ่มสมาชิกในแผนก และดูงานที่แผนกส่งไป
        </div>
      </div>
    </div>
  );
}
