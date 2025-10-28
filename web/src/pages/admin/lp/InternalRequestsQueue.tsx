// ======================================================================
// File: web/src/pages/admin/lp/InternalRequestsQueue.tsx
// เวอร์ชัน: 28/10/2025 02:00 (Asia/Bangkok)
// หน้าที่: คิวคำขอทั้งหมด (Internal Requests) สำหรับ LP Admin — แสดง/ค้นหา/กรอง/อนุมัติเบื้องต้น/ปฏิเสธ
// เชื่อมบริการ: Firestore (collectionGroup onSnapshot), Cloud Functions (httpsCallable)
// เปลี่ยนแปลงรอบนี้:
//   • แปลง inline CSS เป็น MUI components ทั้งหมด
//   • ใช้ MUI Table, TextField, Select, Button, Chip
//   • เพิ่ม Card layout และ responsive design
//   • เพิ่ม loading skeleton และ empty state
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 28/10/2025 02:00
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  getFirestore,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  AccessTime as TimeIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';

type InternalStatus =
  | 'รอดำเนินการ'
  | 'LP รับทราบ (รอผู้รับเหมา)'
  | 'รอ LP ตรวจสอบ'
  | 'อนุมัติเข้าทำงาน'
  | 'ไม่อนุมัติ';

interface InternalRequestRow {
  id: string;
  docPath: string;
  requesterEmail: string;
  locationId: string;
  shopName: string;
  floor: string;
  workDetails: string;
  workStartDateTime: string | Timestamp;
  workEndDateTime: string | Timestamp;
  contractorName: string;
  contractorContactPhone: string;
  status: InternalStatus;
  linkedPermitRID?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const db = getFirestore();

// === เลือก region ของ Cloud Functions จาก ENV ===
const region = (import.meta as any).env?.VITE_FUNCTIONS_REGION || 'us-central1';
const functionsClient = getFunctions(undefined, region);

function StatusChip({ status }: { status: InternalStatus }) {
  let color: 'default' | 'warning' | 'info' | 'secondary' | 'success' | 'error' = 'default';
  if (status === 'รอดำเนินการ') color = 'warning';
  if (status === 'LP รับทราบ (รอผู้รับเหมา)') color = 'info';
  if (status === 'รอ LP ตรวจสอบ') color = 'secondary';
  if (status === 'อนุมัติเข้าทำงาน') color = 'success';
  if (status === 'ไม่อนุมัติ') color = 'error';

  return (
    <Chip
      label={status}
      color={color}
      size="small"
      sx={{ fontWeight: 600, fontSize: 11 }}
    />
  );
}

function fmt(input?: string | Timestamp) {
  if (!input) return '-';
  try {
    let d: Date;
    if (typeof input === 'string') d = new Date(input);
    else d = input.toDate();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return '-';
  }
}

const InternalRequestsQueue: React.FC = () => {
  const [rows, setRows] = useState<InternalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [qtext, setQtext] = useState('');
  const [statusFilter, setStatusFilter] = useState<InternalStatus | 'ทั้งหมด'>('ทั้งหมด');
  const [callingId, setCallingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const cg = collectionGroup(db, 'internal_requests');
    const qy = query(cg, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: InternalRequestRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            docPath: d.ref.path,
            requesterEmail: data.requesterEmail || '',
            locationId: data.locationId || '',
            shopName: data.shopName || '',
            floor: data.floor || '',
            workDetails: data.workDetails || '',
            workStartDateTime: data.workStartDateTime,
            workEndDateTime: data.workEndDateTime,
            contractorName: data.contractorName || '',
            contractorContactPhone: data.contractorContactPhone || '',
            status: data.status || 'รอดำเนินการ',
            linkedPermitRID: data.linkedPermitRID ?? null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error('[InternalRequestsQueue] onSnapshot error:', e);
        setErr('ไม่สามารถโหลดคิวคำขอได้');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    return rows.filter((r) => {
      const okStatus = statusFilter === 'ทั้งหมด' ? true : r.status === statusFilter;
      if (!okStatus) return false;
      if (!s) return true;
      const hay = [
        r.requesterEmail,
        r.shopName,
        r.floor,
        r.workDetails,
        r.contractorName,
        r.contractorContactPhone,
        r.linkedPermitRID || '',
      ].join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [rows, qtext, statusFilter]);

  const onReject = async (row: InternalRequestRow) => {
    if (!row.docPath) return;
    const ok = confirm('ยืนยันการปฏิเสธคำขอนี้?');
    if (!ok) return;
    try {
      await updateDoc(doc(db, row.docPath), {
        status: 'ไม่อนุมัติ',
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[InternalRequestsQueue] reject error:', e);
      alert('ปฏิเสธไม่สำเร็จ กรุณาลองใหม่');
    }
  };

  const onApprovePreliminary = async (row: InternalRequestRow) => {
    if (callingId) return;
    setCallingId(row.id);
    try {
      const createLink = httpsCallable(functionsClient, 'createContractorLink');
      const resp: any = await createLink({
        requestId: row.id,
        internalRequestPath: row.docPath,
      });
      const rid = resp?.data?.rid || resp?.data?.RID || '-';
      const url = resp?.data?.url || resp?.data?.link || '-';
      alert(`สร้างลิงก์เรียบร้อย\nRID: ${rid}\nURL: ${url}\n\nคัดลอก URL เพื่อส่งให้ผู้รับเหมาได้เลย`);
    } catch (e: any) {
      console.error('[InternalRequestsQueue] createContractorLink error:', e);
      const msg = e?.message || 'เรียก Cloud Function ไม่สำเร็จ กรุณาตรวจสอบการ deploy/region';
      alert(msg);
    } finally {
      setCallingId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          คิวคำขอ (Internal Requests)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          แสดงคำขอทั้งหมดที่ส่งมาจากพนักงานภายใน · Functions region: <strong>{region}</strong>
        </Typography>
      </Box>

      {/* Filters */}
      <Card elevation={2} sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="ค้นหา: ผู้ขอ/ร้าน/ชั้น/รายละเอียด/ผู้รับเหมา/เบอร์/RID..."
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
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>สถานะ</InputLabel>
            <Select
              value={statusFilter}
              label="สถานะ"
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <MenuItem value="ทั้งหมด">ทั้งหมด</MenuItem>
              <MenuItem value="รอดำเนินการ">รอดำเนินการ</MenuItem>
              <MenuItem value="LP รับทราบ (รอผู้รับเหมา)">LP รับทราบ (รอผู้รับเหมา)</MenuItem>
              <MenuItem value="รอ LP ตรวจสอบ">รอ LP ตรวจสอบ</MenuItem>
              <MenuItem value="อนุมัติเข้าทำงาน">อนุมัติเข้าทำงาน</MenuItem>
              <MenuItem value="ไม่อนุมัติ">ไม่อนุมัติ</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Card>

      {/* Table */}
      <Paper elevation={3} sx={{ overflow: 'auto', borderRadius: 2 }}>
        <Table sx={{ minWidth: 1200 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f3f4f6' }}>
              <TableCell sx={{ fontWeight: 700 }}>ผู้ขอ</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>พื้นที่/ชั้น</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ช่วงเวลา</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ผู้รับเหมา</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>สถานะ</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>RID</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 240 }}>การจัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={40} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    กำลังโหลด...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : err ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 4 }}>
                  <Alert severity="error">{err}</Alert>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    ไม่พบข้อมูล
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const approving = callingId === r.id;
                return (
                  <TableRow key={r.docPath} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PersonIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {r.requesterEmail || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {fmt(r.createdAt)}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {r.shopName || '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ชั้น: {r.floor || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                        <TimeIcon fontSize="small" color="action" />
                        <Typography variant="caption">
                          {fmt(r.workStartDateTime)} → {fmt(r.workEndDateTime)}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {r.workDetails || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BusinessIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2">{r.contractorName || '-'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {r.contractorContactPhone || '-'}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {r.linkedPermitRID || <span style={{ color: '#9ca3af' }}>-</span>}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="column" spacing={1}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={approving ? <CircularProgress size={16} color="inherit" /> : <ApproveIcon />}
                          disabled={approving || r.status !== 'รอดำเนินการ'}
                          onClick={() => onApprovePreliminary(r)}
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            '&:disabled': { background: '#e5e7eb', color: '#9ca3af' },
                          }}
                        >
                          {approving ? 'กำลังสร้าง...' : 'อนุมัติเบื้องต้น'}
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          color="error"
                          startIcon={<RejectIcon />}
                          disabled={r.status === 'อนุมัติเข้าทำงาน' || r.status === 'ไม่อนุมัติ'}
                          onClick={() => onReject(r)}
                        >
                          ปฏิเสธ
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default InternalRequestsQueue;
