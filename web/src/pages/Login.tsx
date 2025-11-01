// ======================================================================
// File: web/src/pages/Login.tsx
// เวอร์ชัน: 01/11/2025 (Asia/Bangkok)
// หน้าที่: หน้าเข้าสู่ระบบสำหรับผู้ดูแล (Admin Portal)
//          ออกแบบใหม่สุดอลังการ - สวยงาม เรียบหรู ดูแพง สีสันสดใส
// เปลี่ยนแปลงรอบนี้:
//   • ใช้ Vibrant Gradient (Purple, Pink, Blue, Orange)
//   • เพิ่ม Floating Elements Animation
//   • Glass Morphism Card พร้อม Backdrop Blur
//   • Premium Typography & Smooth Transitions
//   • 3D Hover Effects & Glowing Buttons
//   • Animated Background Gradient
//   • Modern Icons & Visual Elements
// ผู้แก้ไข: เพื่อนรัก
// อัปเดตล่าสุด: 01/11/2025
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
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
        fontFamily: "Sarabun, sans-serif",
        position: "relative",
        overflow: "hidden",
        // Animated gradient background
        animation: "gradientShift 15s ease infinite",
        "@keyframes gradientShift": {
          "0%": {
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
          },
          "25%": {
            background: "linear-gradient(135deg, #f093fb 0%, #4facfe 50%, #00f2fe 100%)",
          },
          "50%": {
            background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 50%, #667eea 100%)",
          },
          "75%": {
            background: "linear-gradient(135deg, #fa709a 0%, #fee140 50%, #f093fb 100%)",
          },
          "100%": {
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
          },
        },
        // Floating elements
        "&::before": {
          content: '""',
          position: "absolute",
          top: "-10%",
          left: "-10%",
          width: "40%",
          height: "40%",
          background: "radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)",
          borderRadius: "50%",
          animation: "float1 20s ease-in-out infinite",
          filter: "blur(60px)",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          bottom: "-10%",
          right: "-10%",
          width: "50%",
          height: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)",
          borderRadius: "50%",
          animation: "float2 25s ease-in-out infinite",
          filter: "blur(80px)",
        },
        "@keyframes float1": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(30%, 20%) scale(1.1)" },
          "66%": { transform: "translate(-20%, 30%) scale(0.9)" },
        },
        "@keyframes float2": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(-30%, -20%) scale(1.2)" },
          "66%": { transform: "translate(20%, -30%) scale(0.8)" },
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
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* Animated Icon */}
              <Box
                sx={{
                  position: "relative",
                  mb: 4,
                  animation: "bounce 3s ease-in-out infinite",
                  "@keyframes bounce": {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-20px)" },
                  },
                }}
              >
                <AdminIcon
                  sx={{
                    fontSize: 140,
                    filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.3))",
                    animation: "rotate 20s linear infinite",
                    "@keyframes rotate": {
                      "0%": { transform: "rotate(0deg)" },
                      "100%": { transform: "rotate(360deg)" },
                    },
                  }}
                />
                {/* Glow effect */}
                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "200px",
                    height: "200px",
                    background: "radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%)",
                    borderRadius: "50%",
                    filter: "blur(40px)",
                    animation: "pulse 3s ease-in-out infinite",
                    "@keyframes pulse": {
                      "0%, 100%": { opacity: 0.5, scale: 1 },
                      "50%": { opacity: 1, scale: 1.2 },
                    },
                  }}
                />
              </Box>

              {/* Title with gradient text */}
              <Typography
                variant="h2"
                fontWeight={900}
                gutterBottom
                sx={{
                  background: "linear-gradient(135deg, #fff 0%, #f0f0f0 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  textShadow: "0 4px 12px rgba(0,0,0,0.3)",
                  letterSpacing: "1px",
                  mb: 3,
                }}
              >
                Work Permit
              </Typography>

              {/* Subtitle with better spacing */}
              <Typography
                variant="h5"
                sx={{
                  opacity: 0.95,
                  textShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  maxWidth: "450px",
                  lineHeight: 2,
                  fontWeight: 300,
                  letterSpacing: "0.5px",
                }}
              >
                ระบบขออนุญาตทำงานที่ทันสมัย
                <br />
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    mt: 2,
                    px: 3,
                    py: 1,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: "50px",
                    backdropFilter: "blur(10px)",
                    fontSize: "0.9em",
                  }}
                >
                  จัดการ • อนุมัติ • ติดตาม
                </Box>
              </Typography>

              {/* Decorative dots */}
              <Stack direction="row" spacing={1.5} sx={{ mt: 4 }}>
                {[...Array(3)].map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      bgcolor: "rgba(255,255,255,0.6)",
                      animation: `dotPulse 2s ease-in-out infinite ${i * 0.3}s`,
                      "@keyframes dotPulse": {
                        "0%, 100%": { opacity: 0.3, scale: 0.8 },
                        "50%": { opacity: 1, scale: 1.2 },
                      },
                    }}
                  />
                ))}
              </Stack>
            </Box>

            {/* ซีกขวา: Login Form */}
            <Box sx={{ flex: 1, width: "100%", maxWidth: { xs: "100%", md: 500 }, position: "relative", zIndex: 1 }}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 5,
                  overflow: "visible",
                  backdropFilter: "blur(40px)",
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.3), 0 0 100px rgba(255,255,255,0.1)",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "200px",
                    background: "linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(240,147,251,0.1) 100%)",
                    borderRadius: "20px 20px 0 0",
                    zIndex: -1,
                  },
                  "&:hover": {
                    transform: "translateY(-8px) scale(1.02)",
                    boxShadow: "0 30px 80px rgba(0,0,0,0.4), 0 0 120px rgba(255,255,255,0.2)",
                  },
                }}
              >
                {/* Header with vibrant gradient */}
                <Box
                  sx={{
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
                    py: 5,
                    px: 4,
                    textAlign: "center",
                    color: "white",
                    position: "relative",
                    overflow: "hidden",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                      animation: "shimmer 3s ease-in-out infinite",
                      "@keyframes shimmer": {
                        "0%": { transform: "translateX(-100%)" },
                        "100%": { transform: "translateX(100%)" },
                      },
                    },
                  }}
                >
                  {/* Icon with glow */}
                  <Box
                    sx={{
                      position: "relative",
                      display: "inline-block",
                      mb: 2,
                    }}
                  >
                    <AdminIcon
                      sx={{
                        fontSize: 72,
                        filter: "drop-shadow(0 8px 24px rgba(255,255,255,0.4))",
                        animation: "iconFloat 4s ease-in-out infinite",
                        "@keyframes iconFloat": {
                          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
                          "50%": { transform: "translateY(-10px) rotate(5deg)" },
                        },
                      }}
                    />
                  </Box>

                  <Typography
                    variant="h4"
                    fontWeight={900}
                    gutterBottom
                    sx={{
                      textShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      letterSpacing: "1px",
                    }}
                  >
                    เข้าสู่ระบบผู้ดูแล
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      opacity: 0.95,
                      fontWeight: 300,
                      letterSpacing: "0.5px",
                    }}
                  >
                    ยินดีต้อนรับสู่ระบบจัดการ
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
                      sx={{
                        mb: 3,
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 3,
                          backgroundColor: "rgba(102, 126, 234, 0.02)",
                          transition: "all 0.3s ease",
                          "& fieldset": {
                            borderColor: "rgba(102, 126, 234, 0.2)",
                            borderWidth: 2,
                          },
                          "&:hover fieldset": {
                            borderColor: "rgba(102, 126, 234, 0.4)",
                          },
                          "&.Mui-focused": {
                            backgroundColor: "rgba(102, 126, 234, 0.05)",
                            boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)",
                            "& fieldset": {
                              borderColor: "#667eea",
                            },
                          },
                        },
                        "& .MuiInputLabel-root": {
                          fontWeight: 600,
                          "&.Mui-focused": {
                            color: "#667eea",
                          },
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon sx={{ color: "#667eea" }} />
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
                      sx={{
                        mb: 3,
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 3,
                          backgroundColor: "rgba(102, 126, 234, 0.02)",
                          transition: "all 0.3s ease",
                          "& fieldset": {
                            borderColor: "rgba(102, 126, 234, 0.2)",
                            borderWidth: 2,
                          },
                          "&:hover fieldset": {
                            borderColor: "rgba(102, 126, 234, 0.4)",
                          },
                          "&.Mui-focused": {
                            backgroundColor: "rgba(102, 126, 234, 0.05)",
                            boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)",
                            "& fieldset": {
                              borderColor: "#667eea",
                            },
                          },
                        },
                        "& .MuiInputLabel-root": {
                          fontWeight: 600,
                          "&.Mui-focused": {
                            color: "#667eea",
                          },
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon sx={{ color: "#667eea" }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPw(!showPw)}
                              edge="end"
                              disabled={loading}
                              sx={{
                                color: "#667eea",
                                "&:hover": {
                                  background: "rgba(102, 126, 234, 0.1)",
                                },
                              }}
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
                        py: 2,
                        fontWeight: 800,
                        fontSize: 17,
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
                        borderRadius: 3,
                        boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)",
                        position: "relative",
                        overflow: "hidden",
                        textTransform: "none",
                        letterSpacing: "0.5px",
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          top: 0,
                          left: "-100%",
                          width: "100%",
                          height: "100%",
                          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                          transition: "left 0.5s",
                        },
                        "&:hover": {
                          background: "linear-gradient(135deg, #5568d3 0%, #6339a2 50%, #e07df0 100%)",
                          transform: "translateY(-3px) scale(1.02)",
                          boxShadow: "0 12px 32px rgba(102, 126, 234, 0.6), 0 0 40px rgba(240, 147, 251, 0.4)",
                          "&::before": {
                            left: "100%",
                          },
                        },
                        "&:active": {
                          transform: "translateY(-1px) scale(0.98)",
                        },
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                    </Button>

                    <Divider sx={{ my: 3 }}>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
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
                        py: 1.8,
                        fontWeight: 700,
                        fontSize: 16,
                        borderRadius: 3,
                        borderWidth: 2,
                        borderColor: "#667eea",
                        color: "#667eea",
                        textTransform: "none",
                        letterSpacing: "0.5px",
                        background: "linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(240,147,251,0.05) 100%)",
                        "&:hover": {
                          borderWidth: 2,
                          borderColor: "#764ba2",
                          background: "linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(240,147,251,0.1) 100%)",
                          transform: "translateY(-2px)",
                          boxShadow: "0 8px 20px rgba(102, 126, 234, 0.3)",
                        },
                        transition: "all 0.3s ease",
                      }}
                    >
                      เข้าสู่ระบบด้วย Google
                    </Button>

                    {/* Help Text */}
                    <Box
                      sx={{
                        mt: 3,
                        p: 2.5,
                        background: "linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(240,147,251,0.05) 100%)",
                        borderRadius: 3,
                        border: "1px solid rgba(102,126,234,0.1)",
                        textAlign: "center",
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" fontWeight={500}>
                        ต้องการสิทธิ์ผู้ดูแล?{" "}
                        <Link
                          href={requestAccessHref}
                          sx={{
                            fontWeight: 700,
                            color: "#667eea",
                            textDecoration: "none",
                            borderBottom: "2px solid #667eea",
                            transition: "all 0.3s ease",
                            "&:hover": {
                              color: "#764ba2",
                              borderBottomColor: "#764ba2",
                            },
                          }}
                        >
                          ขอสิทธิ์เข้าใช้งาน
                        </Link>
                      </Typography>
                    </Box>
                  </form>

                  {/* Footer Links */}
                  <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="center"
                    sx={{ mt: 4, pt: 3, borderTop: "2px solid rgba(102,126,234,0.1)" }}
                  >
                    <Button
                      size="small"
                      startIcon={<HomeIcon />}
                      onClick={() => navigate("/")}
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        borderRadius: 2,
                        px: 2,
                        "&:hover": {
                          color: "#667eea",
                          background: "rgba(102,126,234,0.1)",
                        },
                      }}
                    >
                      หน้าแรก
                    </Button>
                    <Button
                      size="small"
                      startIcon={<StatusIcon />}
                      onClick={() => navigate("/status")}
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        borderRadius: 2,
                        px: 2,
                        "&:hover": {
                          color: "#667eea",
                          background: "rgba(102,126,234,0.1)",
                        },
                      }}
                    >
                      ตรวจสอบสถานะ
                    </Button>
                    <Button
                      size="small"
                      startIcon={<KeyIcon />}
                      onClick={handleForgotPassword}
                      disabled={loading}
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        borderRadius: 2,
                        px: 2,
                        "&:hover": {
                          color: "#667eea",
                          background: "rgba(102,126,234,0.1)",
                        },
                      }}
                    >
                      ลืมรหัสผ่าน?
                    </Button>
                  </Stack>

                  {/* Version Badge */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      mt: 3,
                    }}
                  >
                    <Box
                      sx={{
                        px: 2.5,
                        py: 0.8,
                        background: "linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(240,147,251,0.1) 100%)",
                        borderRadius: 50,
                        border: "1px solid rgba(102,126,234,0.2)",
                      }}
                    >
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        v1.0.0
                      </Typography>
                    </Box>
                  </Box>
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
        PaperProps={{
          sx: {
            borderRadius: 4,
            backdropFilter: "blur(20px)",
            background: "rgba(255, 255, 255, 0.98)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            fontSize: 22,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
            color: "white",
            textAlign: "center",
            py: 3,
          }}
        >
          ยืนยันการส่งอีเมล
        </DialogTitle>
        <DialogContent sx={{ pt: 4, pb: 2, px: 4 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
            ระบบจะส่งอีเมลสำหรับตั้งรหัสผ่านใหม่ไปที่:
          </Typography>
          <Box
            sx={{
              p: 2,
              background: "linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(240,147,251,0.1) 100%)",
              borderRadius: 2,
              border: "2px solid rgba(102,126,234,0.2)",
            }}
          >
            <Typography variant="h6" fontWeight={700} color="primary" sx={{ textAlign: "center" }}>
              {email}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setShowConfirmModal(false)}
            variant="outlined"
            size="large"
            sx={{
              borderWidth: 2,
              borderColor: "grey.300",
              color: "grey.700",
              fontWeight: 600,
              "&:hover": {
                borderWidth: 2,
                borderColor: "grey.400",
                background: "grey.50",
              },
            }}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={confirmSendResetEmail}
            variant="contained"
            size="large"
            sx={{
              fontWeight: 700,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
              "&:hover": {
                background: "linear-gradient(135deg, #5568d3 0%, #6339a2 50%, #e07df0 100%)",
                boxShadow: "0 6px 16px rgba(102, 126, 234, 0.6)",
                transform: "translateY(-2px)",
              },
              transition: "all 0.3s ease",
            }}
          >
            ยืนยันและส่งอีเมล
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
