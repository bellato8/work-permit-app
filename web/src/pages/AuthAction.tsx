// ======================================================================
// File: web/src/pages/AuthAction.tsx
// เวอร์ชัน: 2025-09-25 05:00 (Asia/Bangkok)
// หน้าที่: หน้าเว็บ "จัดการลิงก์อีเมลของ Firebase" แบบสวยงาม (Reset Password เป็นหลัก)
// รองรับ: mode=resetPassword (+ แสดงผล verifyEmail/recoverEmail แบบข้อความได้)
// การทำงานหลัก:
//  - อ่าน query: mode, oobCode, apiKey, lang
//  - resetPassword: verifyPasswordResetCode -> ให้ผู้ใช้ตั้งรหัส -> confirmPasswordReset
// ดีไซน์: Luxury & Efficiency (พื้นหลังไล่สี + การ์ดฟรอสต์), ใช้ MUI + Tailwind ร่วมกัน
// หมายเหตุ:
//  - หน้านี้จะทำงานเมื่อเราตั้งค่า "ลิงก์ในอีเมล" ให้ชี้มาที่โดเมนของเรา (สเต็ป 2)
//  - ใช้ getAuth() สมมติแอปถูก initialize แล้ว (เช่น ใน src/main.tsx หรือ lib/firebase.ts)
// ======================================================================

import * as React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import ErrorOutline from "@mui/icons-material/ErrorOutline";
import { getAuth, verifyPasswordResetCode, confirmPasswordReset, applyActionCode, checkActionCode } from "firebase/auth";

type Mode = "resetPassword" | "verifyEmail" | "recoverEmail" | string | null;

export default function AuthAction() {
  const auth = getAuth();
  const [loading, setLoading] = React.useState(true);
  const [mode, setMode] = React.useState<Mode>(null);
  const [oobCode, setOobCode] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);

  // reset password form
  const [pwd, setPwd] = React.useState("");
  const [pwd2, setPwd2] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);

  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get("mode") as Mode;
    const code = sp.get("oobCode");
    setMode(m);
    setOobCode(code);

    const init = async () => {
      try {
        if (m === "resetPassword") {
          if (!code) throw new Error("ลิงก์ไม่ถูกต้อง (ไม่มีรหัสยืนยัน)");
          // ตรวจสอบโค้ดรีเซ็ต และดึงอีเมลของบัญชี
          const mail = await verifyPasswordResetCode(auth, code);
          setEmail(mail);
          setInfo(`กำลังตั้งรหัสผ่านใหม่ให้กับบัญชี: ${mail}`);
        } else if (m === "verifyEmail") {
          // แค่แสดงข้อความ (จริง ๆ สามารถ applyActionCode ได้ที่นี่ ถ้าต้องการ)
          if (!code) throw new Error("ลิงก์ไม่ถูกต้อง (ไม่มีรหัสยืนยัน)");
          await applyActionCode(auth, code);
          setSuccess("ยืนยันอีเมลเรียบร้อยแล้ว");
        } else if (m === "recoverEmail") {
          if (!code) throw new Error("ลิงก์ไม่ถูกต้อง (ไม่มีรหัสยืนยัน)");
          // ตรวจสอบโค้ด (สาธิตข้อความ)
          await checkActionCode(auth, code);
          setInfo("ยืนยันการกู้คืนอีเมลแล้ว (คุณสามารถล็อกอินด้วยอีเมลเดิมได้)");
        } else {
          setError("ไม่รู้จักโหมดของลิงก์ กรุณาตรวจสอบลิงก์อีกครั้ง");
        }
      } catch (e: any) {
        setError(parseFirebaseError(e));
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit =
    mode === "resetPassword" &&
    !!oobCode &&
    pwd.length >= 8 &&
    pwd === pwd2 &&
    !working;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      await confirmPasswordReset(auth, oobCode, pwd);
      setSuccess("บันทึกรหัสผ่านใหม่เรียบร้อย! คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่นี้ได้ทันที");
    } catch (e: any) {
      setError(parseFirebaseError(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Box
      sx={{ minHeight: "100vh" }}
      className="bg-gradient-to-br from-slate-900 via-indigo-900 to-indigo-800 flex items-center justify-center p-4"
    >
      <Card
        className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl w-full max-w-md"
        elevation={0}
      >
        <CardContent className="p-6">
          <Typography variant="h4" className="text-white font-semibold">
            {titleByMode(mode)}
          </Typography>
          <Typography variant="body2" className="text-white/70 mt-1">
            Work Permit System · Imperial World
          </Typography>

          <Box className="mt-4">
            {loading && (
              <Box className="flex items-center gap-2 text-white/80">
                <CircularProgress size={20} />
                <span>กำลังตรวจสอบลิงก์...</span>
              </Box>
            )}

            {!loading && error && (
              <Alert icon={<ErrorOutline />} severity="error" className="mt-2">
                {error}
              </Alert>
            )}

            {!loading && success && (
              <Alert icon={<CheckCircleOutline />} severity="success" className="mt-2">
                {success}
              </Alert>
            )}

            {!loading && info && (
              <Alert severity="info" className="mt-2">
                {info}
              </Alert>
            )}

            {/* แบบฟอร์มรีเซ็ตรหัสผ่าน */}
            {!loading && mode === "resetPassword" && !success && (
              <Box component="form" onSubmit={onSubmit} className="mt-4 space-y-3">
                <TextField
                  label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"
                  type={showPwd ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  fullWidth
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPwd((s) => !s)} edge="end">
                          {showPwd ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="ยืนยันรหัสผ่านใหม่"
                  type={showPwd ? "text" : "password"}
                  value={pwd2}
                  onChange={(e) => setPwd2(e.target.value)}
                  fullWidth
                  variant="outlined"
                />
                <PasswordHints password={pwd} />

                <Button
                  type="submit"
                  fullWidth
                  size="large"
                  disabled={!canSubmit}
                  className="mt-2"
                  variant="contained"
                >
                  {working ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
                </Button>
              </Box>
            )}

            {/* ปุ่มกลับหน้าเข้าสู่ระบบ */}
            {!loading && (
              <Box className="mt-4">
                <Button
                  href="/login"
                  fullWidth
                  variant="outlined"
                  className="border-white/40 text-white/90"
                >
                  ไปหน้าเข้าสู่ระบบ
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// ----------------------- Helpers -----------------------

function titleByMode(mode: Mode) {
  switch (mode) {
    case "resetPassword":
      return "ตั้งรหัสผ่านใหม่";
    case "verifyEmail":
      return "ยืนยันอีเมล";
    case "recoverEmail":
      return "กู้คืนอีเมล";
    default:
      return "การยืนยันผ่านอีเมล";
  }
}

function parseFirebaseError(e: any): string {
  const msg = String(e?.message || e);
  if (msg.includes("expired") || msg.includes("expired-action-code")) {
    return "ลิงก์หมดอายุ กรุณาขอลิงก์ใหม่อีกครั้ง";
  }
  if (msg.includes("invalid-action-code")) {
    return "รหัสยืนยันไม่ถูกต้อง หรือถูกใช้ไปแล้ว";
  }
  if (msg.includes("weak-password")) {
    return "รหัสผ่านอ่อนเกินไป กรุณาตั้งอย่างน้อย 8 ตัวอักษร";
  }
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

function PasswordHints({ password }: { password: string }) {
  const okLen = password.length >= 8;
  const hasNum = /\d/.test(password);
  const hasLetter = /[A-Za-zก-ฮ]/.test(password);

  return (
    <Box className="text-white/80 text-sm leading-6">
      <div>คำแนะนำความปลอดภัย:</div>
      <ul className="list-disc pl-6">
        <li className={okLen ? "text-emerald-300" : ""}>ความยาว ≥ 8 ตัวอักษร</li>
        <li className={hasLetter ? "text-emerald-300" : ""}>มีตัวอักษรอย่างน้อย 1 ตัว</li>
        <li className={hasNum ? "text-emerald-300" : ""}>มีตัวเลขอย่างน้อย 1 ตัว</li>
      </ul>
    </Box>
  );
}
