// ======================================================================
// File: web/src/pages/internal/Login.tsx
// เวอร์ชัน: 30/10/2025 19:30 (Asia/Bangkok) - FINAL FIX
// หน้าที่: หน้าเข้าสู่ระบบสำหรับ Internal Portal (อีเมล/รหัสผ่าน)
// เปลี่ยนแปลงรอบนี้ (โดยเพื่อนคู่คิด):
//   - ✨ [สำคัญมาก] แก้ไข `ensureInternalUserGate` ให้ค้นหาด้วย `query` + `where`
//     เพื่อให้สามารถหาผู้ใช้เจอ แม้ ID เอกสารจะไม่ใช่อีเมลก็ตาม
// ======================================================================

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
// ✨ [ใหม่] import เครื่องมือสำหรับ Query จาก 'firebase/firestore'
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
  Checkbox,
  FormControlLabel,
} from '@mui/material';

// MUI Icons
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  WorkOutline,
  VpnKey as KeyIcon,
} from '@mui/icons-material';

// ดึง APP_ID จาก environment variable
const APP_ID = import.meta.env.VITE_APP_ID || 'default';
const USERS_INTERNAL_PATH = `artifacts/${APP_ID}/public/data/users_internal`;

// ✨ [ประตูตรวจสอบสิทธิ์ฉบับแก้ไขสมบูรณ์]
// ตรวจสอบว่าอีเมลที่ล็อกอินเข้ามา มีข้อมูลอยู่ในคอลเลกชัน users_internal หรือไม่
async function ensureInternalUserGate(email?: string) {
  const mail = (email || '').trim().toLowerCase();
  if (!mail) throw new Error('บัญชีนี้ไม่มีอีเมล');

  // 1. สร้าง Reference ไปยัง Collection ที่ถูกต้อง
  const usersRef = collection(db, USERS_INTERNAL_PATH);
  
  // 2. สร้าง Query เพื่อค้นหาเอกสารที่มีฟิลด์ 'email' ตรงกับที่ล็อกอินเข้ามา
  const q = query(usersRef, where("email", "==", mail), limit(1));

  // 3. ดึงข้อมูลตาม Query
  const querySnapshot = await getDocs(q);

  // 4. ตรวจสอบว่ามีผลลัพธ์จากการค้นหาหรือไม่
  if (querySnapshot.empty) {
    // ถ้าไม่เจอเอกสารเลย แสดงว่าไม่มีสิทธิ์
    throw new Error(
      'ล็อกอินสำเร็จ แต่บัญชีของคุณยังไม่ถูกเพิ่มในระบบผู้ใช้ภายใน โปรดติดต่อผู้ดูแล'
    );
  }

  // ถ้าเจออย่างน้อย 1 รายการ ถือว่าผ่าน
  console.log('Gate Passed: Internal user found!', querySnapshot.docs[0].data());
  return true;
}


// แปลงรหัส error จาก Firebase → ข้อความไทย (ฉบับปรับปรุง)
function mapAuthError(err: any): string {
  const code = (err?.code || '').toString();
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
  }
  if (code === 'auth/invalid-email') return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (code === 'auth/user-disabled') return 'บัญชีนี้ถูกปิดใช้งาน โปรดติดต่อผู้ดูแลระบบ';
  if (code === 'auth/user-not-found') return 'ไม่พบบัญชีนี้ในระบบ';
  if (code === 'auth/network-request-failed') return 'เครือข่ายขัดข้อง กรุณาลองใหม่';
  // เพิ่มการดัก Error จาก ensureInternalUserGate
  if (err?.message?.includes('ผู้ใช้ภายใน')) return err.message;
  return 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
}

export default function InternalLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const nextPath = '/internal/requests';

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
      // ตรวจสอบสิทธิ์หลังล็อกอินด้วยฟังก์ชันที่แก้ไขแล้ว
      await ensureInternalUserGate(cred.user.email || undefined);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      try { await signOut(auth); } catch {}
      setMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleForgotPassword() {
    if (!email.trim()) {
      setMsg('กรุณากรอกอีเมลของคุณก่อน');
      return;
    }
    setShowConfirmModal(true);
  }

  async function confirmSendResetEmail() {
    setShowConfirmModal(false);
    setMsg('');
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setMsg(`ส่งอีเมลสำหรับตั้งรหัสผ่านใหม่ไปที่ ${email.trim()} แล้ว โปรดตรวจสอบกล่องจดหมายของคุณ`);
    } catch (err: any) {
      setMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Sarabun, sans-serif',
      }}
    >
      <Container maxWidth="sm">
        <Fade in={mounted} timeout={800}>
          <Card
            elevation={24}
            sx={{
              borderRadius: 4,
              background: 'rgba(255, 255, 255, 0.98)',
            }}
          >
            <Box
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                py: 4, px: 3, textAlign: 'center', color: 'white',
              }}
            >
              <WorkOutline sx={{ fontSize: 56, mb: 1 }} />
              <Typography variant="h4" fontWeight={800} gutterBottom>
                Internal Portal
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                สำหรับพนักงานและเจ้าหน้าที่ภายใน
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              {msg && (
                <Alert
                  severity={msg.includes('ส่งอีเมล') || msg.includes('สำเร็จ') ? 'success' : 'error'}
                  sx={{ mb: 3 }}
                >
                  {msg}
                </Alert>
              )}

              <form onSubmit={handleLogin}>
                <TextField
                  fullWidth label="อีเมล" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com" disabled={busy} required
                  autoComplete="username" sx={{ mb: 2.5 }}
                  InputProps={{
                    startAdornment: (<InputAdornment position="start"><EmailIcon color="primary" /></InputAdornment>),
                  }}
                />

                <TextField
                  fullWidth label="รหัสผ่าน" type={showPassword ? 'text' : 'password'}
                  value={pass} onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••" disabled={busy} required
                  autoComplete="current-password" sx={{ mb: 1 }}
                  InputProps={{
                    startAdornment: (<InputAdornment position="start"><LockIcon color="primary" /></InputAdornment>),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={busy}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                   <FormControlLabel
                    control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} color="primary" />}
                    label={<Typography variant="body2">จำฉันไว้</Typography>}
                  />
                   <Link component="button" variant="body2" onClick={handleForgotPassword} disabled={busy} sx={{ textAlign: 'right' }}>
                    ลืมรหัสผ่าน?
                  </Link>
                </Stack>

                <Button
                  type="submit" fullWidth variant="contained" size="large"
                  disabled={busy} startIcon={<LoginIcon />}
                  sx={{
                    py: 1.5, fontWeight: 700, fontSize: 16,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #5568d3 0%, #65408d 100%)' },
                  }}
                >
                  {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                </Button>
              </form>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 3, textAlign: 'center', display: 'block' }}>
                หากพบปัญหา โปรด <Link href="mailto:asm.sutthirak@gmail.com">ติดต่อผู้ดูแลระบบ</Link>
              </Typography>
            </CardContent>
          </Card>
        </Fade>
      </Container>

      <Dialog open={showConfirmModal} onClose={() => setShowConfirmModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>ยืนยันการส่งอีเมล</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            ระบบจะส่งอีเมลสำหรับตั้งรหัสผ่านใหม่ไปที่:
          </Typography>
          <Typography variant="body1" fontWeight={700} sx={{ mt: 1 }}>
            {email}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowConfirmModal(false)} variant="outlined" color="inherit">ยกเลิก</Button>
          <Button onClick={confirmSendResetEmail} variant="contained">ยืนยันและส่ง</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
