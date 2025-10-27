// ======================================================================
// File: web/src/pages/internal/Login.tsx
// เวอร์ชัน: 27/10/2025 03:30 (Asia/Bangkok)
// หน้าที่: หน้าเข้าสู่ระบบสำหรับ Internal Portal (อีเมล/รหัสผ่าน)
//          ออกแบบใหม่ด้วย Material-UI พร้อมสีสันสดใส เรียบหรู ดูแพง
// เปลี่ยนแปลงรอบนี้:
//   • เปลี่ยนจาก inline styles → ใช้ MUI components ทั้งหมด
//   • เพิ่ม gradient background สีสันสดใส (blue-purple)
//   • ใช้ MUI TextField, Button, Card, Alert พร้อม icons
//   • เพิ่ม animation fade-in และ elevation
//   • Modern design พร้อม responsive layout
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 27/10/2025 03:30
// ======================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';

// MUI Components
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  FormControlLabel,
  Checkbox,
  Alert,
  InputAdornment,
  IconButton,
  Fade,
  Container,
} from '@mui/material';

// MUI Icons
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  WorkOutline,
} from '@mui/icons-material';

function mapAuthError(code?: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'อีเมลไม่ถูกต้อง';
    case 'auth/user-disabled':
      return 'บัญชีนี้ถูกปิดการใช้งาน';
    case 'auth/user-not-found':
      return 'ไม่พบบัญชีผู้ใช้นี้';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    case 'auth/too-many-requests':
      return 'พยายามมากเกินไป กรุณาลองใหม่ภายหลัง';
    case 'auth/network-request-failed':
      return 'เครือข่ายมีปัญหา กรุณาตรวจสอบการเชื่อมต่อ';
    default:
      return 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่';
  }
}

export default function InternalLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  const nextPath = useMemo(() => {
    try {
      const q = new URLSearchParams(location.search);
      return q.get('to') || '/internal/requests';
    } catch {
      return '/internal/requests';
    }
  }, [location.search]);

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Fade-in animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-redirect if already logged in
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
        setErr('กรุณาระบุอีเมล');
        return;
      }

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
      if (!emailOk) {
        setErr('รูปแบบอีเมลไม่ถูกต้อง');
        return;
      }

      if (!passTrim) {
        setErr('กรุณาระบุรหัสผ่าน');
        return;
      }

      setBusy(true);
      try {
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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Sarabun, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%), radial-gradient(circle at 80% 80%, rgba(252, 165, 165, 0.3), transparent 50%)',
          animation: 'pulse 8s ease-in-out infinite',
        },
        '@keyframes pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      }}
    >
      <Container maxWidth="sm">
        <Fade in={mounted} timeout={800}>
          <Card
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: 'hidden',
              backdropFilter: 'blur(20px)',
              background: 'rgba(255, 255, 255, 0.95)',
            }}
          >
            <Box
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                py: 4,
                px: 3,
                textAlign: 'center',
                color: 'white',
              }}
            >
              <WorkOutline sx={{ fontSize: 56, mb: 1 }} />
              <Typography variant="h4" fontWeight={800} gutterBottom>
                Work Permit System
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                เข้าสู่ระบบเพื่อส่งคำขอและติดตามสถานะ
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              {err && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {err}
                </Alert>
              )}

              <form onSubmit={onSubmit}>
                <TextField
                  fullWidth
                  label="อีเมล"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={busy}
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

                <TextField
                  fullWidth
                  label="รหัสผ่าน"
                  type={showPassword ? 'text' : 'password'}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  disabled={busy}
                  required
                  autoComplete="current-password"
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="primary" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          disabled={busy}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        disabled={busy}
                        color="primary"
                      />
                    }
                    label="จำฉันไว้"
                  />
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={busy}
                  startIcon={<LoginIcon />}
                  sx={{
                    py: 1.5,
                    fontWeight: 700,
                    fontSize: 16,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5568d3 0%, #65408d 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: 6,
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </Button>
              </form>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  หลังจากเข้าสู่ระบบ ระบบจะนำคุณไปยังหน้า "คำขอของฉัน"
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    </Box>
  );
}
