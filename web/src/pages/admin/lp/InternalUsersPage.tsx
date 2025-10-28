// ======================================================================
// File: web/src/pages/admin/lp/InternalUsersPage.tsx
// เวอร์ชัน: 28/10/2025 02:30 (Asia/Bangkok)
// หน้าที่: จัดการผู้ใช้ภายใน (users_internal) — แสดง/ค้นหา/เพิ่ม/แก้ไข/ลบ
// เชื่อม Firestore: artifacts/{appId}/public/data/users_internal (ตาม schema)
// ฟีเจอร์: CRUD + ค้นหาด้วย email/fullName/department
// เปลี่ยนแปลงรอบนี้:
//   • แปลง inline CSS เป็น MUI components ทั้งหมด
//   • เปลี่ยน custom Modal → MUI Dialog
//   • ใช้ MUI Table, TextField, Button
//   • เพิ่ม Card layout และ responsive design
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 28/10/2025 02:30
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

import { db } from '../../../lib/firebase';

// MUI Components
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';

// ดึง APP_ID จาก environment variable
const APP_ID = import.meta.env.VITE_APP_ID || 'default';
const USERS_INTERNAL_PATH = `artifacts/${APP_ID}/public/data/users_internal`;

type InternalUser = {
  id: string;
  userId?: string;
  email: string;
  fullName: string;
  department: string;
  createdAt?: any;
  updatedAt?: any;
};

type FormState = {
  id?: string;
  userId?: string;
  email: string;
  fullName: string;
  department: string;
};

const emptyForm: FormState = { email: '', fullName: '', department: '' };

const InternalUsersPage: React.FC = () => {
  const [rows, setRows] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [qtext, setQtext] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, USERS_INTERNAL_PATH), orderBy('fullName', 'asc'));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: InternalUser[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            userId: data.userId,
            email: data.email || '',
            fullName: data.fullName || '',
            department: data.department || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error('[InternalUsersPage] onSnapshot error:', e);
        setErr('ไม่สามารถโหลดข้อมูลผู้ใช้ภายในได้');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.email, r.fullName, r.department].join(' ').toLowerCase().includes(s)
    );
  }, [rows, qtext]);

  const openAdd = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row: InternalUser) => {
    setForm({
      id: row.id,
      userId: row.userId,
      email: row.email,
      fullName: row.fullName,
      department: row.department,
    });
    setShowForm(true);
  };

  const validate = (f: FormState) => {
    const problems: string[] = [];
    if (!f.email.trim()) problems.push('กรุณากรอกอีเมล');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) problems.push('รูปแบบอีเมลไม่ถูกต้อง');
    if (!f.fullName.trim()) problems.push('กรุณากรอกชื่อ–สกุล');
    if (!f.department.trim()) problems.push('กรุณากรอกแผนก');
    return problems;
  };

  const save = async () => {
    if (saving) return;
    const problems = validate(form);
    if (problems.length) {
      alert(problems.join('\n'));
      return;
    }
    try {
      setSaving(true);
      const { id, ...rest } = form;
      if (!id) {
        await addDoc(collection(db, USERS_INTERNAL_PATH), {
          ...rest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, USERS_INTERNAL_PATH, id), {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
      setShowForm(false);
    } catch (e) {
      console.error('[InternalUsersPage] save error:', e);
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: InternalUser) => {
    const ok = confirm(`ยืนยันลบผู้ใช้ภายใน "${row.fullName}" ?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, USERS_INTERNAL_PATH, row.id));
    } catch (e) {
      console.error('[InternalUsersPage] delete error:', e);
      alert('ลบไม่สำเร็จ');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          ผู้ใช้ภายใน (Internal Users)
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          คอลเลกชัน: <code>{USERS_INTERNAL_PATH}</code>
        </Typography>
      </Box>

      {/* Toolbar */}
      <Card elevation={2} sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            fullWidth
            size="small"
            placeholder="ค้นหา: อีเมล/ชื่อ–สกุล/แผนก..."
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAdd}
            sx={{
              minWidth: { xs: '100%', md: 180 },
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            เพิ่มผู้ใช้
          </Button>
        </Stack>
      </Card>

      {/* Table */}
      <Paper elevation={3} sx={{ overflow: 'auto', borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f3f4f6' }}>
              <TableCell sx={{ fontWeight: 700 }}>อีเมล</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ชื่อ–สกุล</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>แผนก</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 200 }}>การจัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={40} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    กำลังโหลด...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : err ? (
              <TableRow>
                <TableCell colSpan={4} sx={{ py: 4 }}>
                  <Alert severity="error">{err}</Alert>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    ไม่พบข้อมูล
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <EmailIcon fontSize="small" color="action" />
                      <Typography variant="body2" fontWeight={600}>
                        {r.email}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon fontSize="small" color="action" />
                      <Typography variant="body2">{r.fullName}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <BusinessIcon fontSize="small" color="action" />
                      <Typography variant="body2">{r.department}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => openEdit(r)}
                        sx={{ bgcolor: '#374151' }}
                      >
                        แก้ไข
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => removeRow(r)}
                      >
                        ลบ
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Form Dialog */}
      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, bgcolor: '#f9fafb' }}>
          {form.id ? 'แก้ไขผู้ใช้ภายใน' : 'เพิ่มผู้ใช้ภายใน'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="อีเมล"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@example.com"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="ชื่อ–สกุล"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="เช่น สมชาย ใจดี"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="แผนก"
              required
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="เช่น วิศวกรรมซ่อมบำรุง"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="User ID (Auth UID)"
              value={form.userId || ''}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              placeholder="ใส่ UID เพื่อผูกกับบัญชี Auth (ถ้ามี)"
              helperText="ออปชัน - ใช้สำหรับผูกกับบัญชี Firebase Authentication"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: '#f9fafb' }}>
          <Button onClick={() => setShowForm(false)} variant="outlined">
            ยกเลิก
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InternalUsersPage;
