// ======================================================================
// File: web/src/pages/Login.tsx
// เวอร์ชัน: 29/10/2025 15:30 (Asia/Bangkok)
// หน้าที่: หน้าเข้าสู่ระบบสำหรับผู้ดูแล (Admin Portal)
//          ออกแบบใหม่ด้วย Material-UI พร้อมสีสันสดใส เรียบหรู ดูแพง
// เปลี่ยนแปลงรอบนี้:
//   • เปลี่ยนจาก custom CSS → ใช้ MUI components ทั้งหมด
//   • เพิ่ม gradient background สีสันสดใส (indigo-teal)
//   • ใช้ MUI TextField, Button, Card, Alert, Dialog พร้อม icons
//   • เพิ่ม animation fade-in, pulse, และ hover effects
//   • Modern design พร้อม glass morphism และ responsive layout
//   • คงฟังก์ชัน: ensureAdminGate, smart redirect, forgot password
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 29/10/2025 15:30
// ======================================================================

import React, { useState, useEffect } from "react";
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

// MUI Components
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Fade,
  Container,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  Divider,
} from "@mui/material";

// MUI Icons
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  AdminPanelSettings as AdminIcon,
  Google as GoogleIcon,
  Home as HomeIcon,
  Assessment as StatusIcon,
  VpnKey as KeyIcon,
} from "@mui/icons-material";

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
    throw new Error(
      'ล็อกอินสำเร็จแล้ว แต่บัญชีของคุณยังไม่ได้รับสิทธิ์ผู้ดูแล โปรดกด "ขอสิทธิ์เข้าใช้งาน" หรือติดต่อผู้ดูแลระบบ'
    );
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
  if (code === "auth/user-disabled")
    return "บัญชีนี้ถูกปิดใช้งาน โปรดติดต่อผู้ดูแลระบบ";
  if (code === "auth/user-not-found") return "ไม่พบบัญชีนี้ในระบบ";
  if (code === "auth/network-request-failed")
    return "เครือข่ายขัดข้อง กรุณาลองใหม่";
  return err?.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
}

export default function Login() {
  const loc = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fade-in animation
  useEffect(() => {
    setMounted(true);
  }, []);

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
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        pw
      );
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
      try {
        await signOut(auth);
      } catch {}
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
      try {
        await signOut(auth);
      } catch {}
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
      setMsg(
        `ส่งอีเมลสำหรับรีเซ็ตรหัสผ่านไปที่ ${email.trim()} แล้ว โปรดตรวจสอบกล่องจดหมาย`
      );
    } catch (err: any) {
      setMsg(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  // mailto "ขอสิทธิ์เข้าใช้งาน"
  const requestAccessHref = (() => {
    const subject = encodeURIComponent("ขอเปิดสิทธิ์ผู้ดูแลระบบ (Work Permit)");
    const body = encodeURIComponent(
      `เรียนผู้ดูแลระบบ\n\nขอเปิดสิทธิ์ผู้ดูแลระบบให้บัญชี:\nอีเมล: ${
        email || "(กรอกอีเมลในแบบฟอร์ม)"
      }\nเหตุผล: \n\nขอบคุณครับ/ค่ะ`
    );
    return `mailto:asm.sutthirak@gmail.com?subject=${subject}&body=${body}`;
  })();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #14b8a6 100%)",
        fontFamily: "Sarabun, sans-serif",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(circle at 30% 40%, rgba(99, 102, 241, 0.4), transparent 50%), radial-gradient(circle at 70% 60%, rgba(20, 184, 166, 0.4), transparent 50%)",
          animation: "pulse 10s ease-in-out infinite",
        },
        "@keyframes pulse": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.6 },
        },
      }}
    >
      <Container maxWidth="lg">
        <Fade in={mounted} timeout={1000}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 4,
              alignItems: "center",
            }}
          >
            {/* ซีกซ้าย: Hero Section */}
            <Box
              sx={{
                flex: 1,
                display: { xs: "none", md: "flex" },
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                textAlign: "center",
                p: 4,
              }}
            >
              <AdminIcon sx={{ fontSize: 120, mb: 3, opacity: 0.95 }} />
              <Typography
                variant="h3"
                fontWeight={900}
                gutterBottom
                sx={{
                  textShadow: "2px 2px 8px rgba(0,0,0,0.2)",
                  letterSpacing: "0.5px",
                }}
              >
                Work Permit System
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  opacity: 0.95,
                  textShadow: "1px 1px 4px rgba(0,0,0,0.2)",
                  maxWidth: "400px",
                  lineHeight: 1.8,
                }}
              >
                ระบบขออนุญาตทำงาน
                <br />
                จัดการคำขอ, อนุมัติ, ติดตามสถานะ
                <br />
                ทั้งหมดในที่เดียว
              </Typography>
            </Box>

            {/* ซีกขวา: Login Form */}
            <Box sx={{ flex: 1, width: "100%", maxWidth: { xs: "100%", md: 480 } }}>
              <Card
                elevation={24}
                sx={{
                  borderRadius: 4,
                  overflow: "hidden",
                  backdropFilter: "blur(20px)",
                  background: "rgba(255, 255, 255, 0.98)",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
                  },
                }}
              >
                {/* Header with gradient */}
                <Box
                  sx={{
                    background: "linear-gradient(135deg, #667eea 0%, #14b8a6 100%)",
                    py: 4,
                    px: 3,
                    textAlign: "center",
                    color: "white",
                  }}
                >
                  <AdminIcon sx={{ fontSize: 64, mb: 1 }} />
                  <Typography variant="h4" fontWeight={800} gutterBottom>
                    เข้าสู่ระบบผู้ดูแล
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    ใช้บัญชีจาก Firebase Authentication
                  </Typography>
                </Box>

                <CardContent sx={{ p: 4 }}>
                  {/* Error Alert */}
                  {msg && (
                    <Alert
                      severity={
                        msg.includes("ส่งอีเมล") ? "success" : "error"
                      }
                      sx={{ mb: 3 }}
                    >
                      {msg}
                    </Alert>
                  )}

                  <form onSubmit={handleEmailPassword}>
                    {/* Email Field */}
                    <TextField
                      fullWidth
                      label="อีเมล"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={loading}
                      required
                      autoComplete="username"
                      sx={{ mb: 2.5 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    {/* Password Field */}
                    <TextField
                      fullWidth
                      label="รหัสผ่าน"
                      type={showPw ? "text" : "password"}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      placeholder="••••••••"
                      disabled={loading}
                      required
                      autoComplete="current-password"
                      sx={{ mb: 2.5 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon color="primary" />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPw(!showPw)}
                              edge="end"
                              disabled={loading}
                            >
                              {showPw ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    {/* Login Button */}
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      size="large"
                      disabled={loading}
                      startIcon={<LoginIcon />}
                      sx={{
                        py: 1.5,
                        fontWeight: 700,
                        fontSize: 16,
                        background:
                          "linear-gradient(135deg, #667eea 0%, #14b8a6 100%)",
                        "&:hover": {
                          background:
                            "linear-gradient(135deg, #5568d3 0%, #0f9d8a 100%)",
                          transform: "translateY(-2px)",
                          boxShadow: 6,
                        },
                        transition: "all 0.3s ease",
                      }}
                    >
                      {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                    </Button>

                    <Divider sx={{ my: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        หรือ
                      </Typography>
                    </Divider>

                    {/* Google Login Button */}
                    <Button
                      fullWidth
                      variant="outlined"
                      size="large"
                      onClick={handleGoogle}
                      disabled={loading}
                      startIcon={<GoogleIcon />}
                      sx={{
                        py: 1.5,
                        fontWeight: 600,
                        fontSize: 16,
                        borderColor: "#667eea",
                        color: "#667eea",
                        "&:hover": {
                          borderColor: "#5568d3",
                          bgcolor: "rgba(102, 126, 234, 0.05)",
                          transform: "translateY(-2px)",
                          boxShadow: 2,
                        },
                        transition: "all 0.3s ease",
                      }}
                    >
                      เข้าสู่ระบบด้วย Google
                    </Button>

                    {/* Help Text */}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 3, textAlign: "center" }}
                    >
                      ต้องการสิทธิ์ผู้ดูแล?{" "}
                      <Link href={requestAccessHref} sx={{ fontWeight: 600 }}>
                        ขอสิทธิ์เข้าใช้งาน
                      </Link>{" "}
                      หรือติดต่อผู้ดูแลระบบ
                    </Typography>
                  </form>

                  {/* Footer Links */}
                  <Stack
                    direction="row"
                    spacing={2}
                    justifyContent="center"
                    sx={{ mt: 4, pt: 3, borderTop: "1px solid #e5e7eb" }}
                  >
                    <Button
                      size="small"
                      startIcon={<HomeIcon />}
                      onClick={() => navigate("/")}
                      sx={{ color: "text.secondary" }}
                    >
                      หน้าแรก
                    </Button>
                    <Button
                      size="small"
                      startIcon={<StatusIcon />}
                      onClick={() => navigate("/status")}
                      sx={{ color: "text.secondary" }}
                    >
                      ตรวจสอบสถานะ
                    </Button>
                    <Button
                      size="small"
                      startIcon={<KeyIcon />}
                      onClick={handleForgotPassword}
                      disabled={loading}
                      sx={{ color: "text.secondary" }}
                    >
                      ลืมรหัสผ่าน?
                    </Button>
                  </Stack>

                  {/* Version */}
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{
                      display: "block",
                      textAlign: "center",
                      mt: 2,
                    }}
                  >
                    v1.0.0
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Fade>
      </Container>

      {/* Forgot Password Confirmation Dialog */}
      <Dialog
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: "grey.50" }}>
          ยืนยันการส่งอีเมล
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            ระบบจะส่งอีเมลสำหรับตั้งรหัสผ่านใหม่ไปที่:
          </Typography>
          <Typography variant="body1" fontWeight={700} sx={{ mt: 1 }}>
            {email}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => setShowConfirmModal(false)}
            variant="outlined"
            color="inherit"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={confirmSendResetEmail}
            variant="contained"
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #14b8a6 100%)",
              "&:hover": {
                background:
                  "linear-gradient(135deg, #5568d3 0%, #0f9d8a 100%)",
              },
            }}
          >
            ยืนยันและส่งอีเมล
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
