// ======================================================================
// File: web/src/pages/admin/lp/PermitApprovals.tsx
// เวอร์ชัน: 28/10/2025 02:15 (Asia/Bangkok)
// หน้าที่: หน้าอนุมัติ/ไม่อนุมัติใบอนุญาตขั้นสุดท้าย สำหรับ LP Admin
//          - แสดงเฉพาะคำขอที่มีสถานะ "รอ LP ตรวจสอบ"
//          - แสดงข้อมูลผู้รับเหมาที่กรอกมา + ข้อมูลจาก internal request
//          - ให้ LP อนุมัติหรือไม่อนุมัติ → อัปเดตสถานะขั้นสุดท้าย
// เปลี่ยนแปลงรอบนี้:
//   • แปลง inline CSS เป็น MUI components ทั้งหมด
//   • ใช้ MUI Table, TextField, Button, Chip
//   • เพิ่ม Card layout และ responsive design
//   • เพิ่ม loading และ empty state
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 28/10/2025 02:15
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  getFirestore,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

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
  Alert,
  CircularProgress,
  Stack,
  Paper,
  InputAdornment,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  Schedule as ScheduleIcon,
  Badge as BadgeIcon,
} from '@mui/icons-material';

type InternalStatus =
  | 'รอดำเนินการ'
  | 'LP รับทราบ (รอผู้รับเหมา)'
  | 'รอ LP ตรวจสอบ'
  | 'อนุมัติเข้าทำงาน'
  | 'ไม่อนุมัติ';

interface PermitRow {
  id: string;
  docPath: string;
  requesterEmail: string;
  locationName: string;
  shopName: string;
  floor: string;
  workDetails: string;
  workStartAt: string | Timestamp;
  workEndAt: string | Timestamp;
  linkedPermitRID: string;

  contractorCompanyName?: string;
  contractorContactPerson?: string;
  contractorPhone?: string;
  contractorSubmittedAt?: Timestamp;

  status: InternalStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const db = getFirestore();

function StatusChip({ status }: { status: InternalStatus }) {
  let color: 'warning' | 'success' | 'error' = 'warning';
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

const PermitApprovalsPage: React.FC = () => {
  const [rows, setRows] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [qtext, setQtext] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // โหลดเฉพาะคำขอที่สถานะ "รอ LP ตรวจสอบ"
  useEffect(() => {
    setLoading(true);
    const cg = collectionGroup(db, 'internal_requests');
    const qy = query(
      cg,
      where('status', '==', 'รอ LP ตรวจสอบ'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: PermitRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            docPath: d.ref.path,
            requesterEmail: data.requesterEmail || '',
            locationName: data.locationName || '',
            shopName: data.shopName || '',
            floor: data.floor || '',
            workDetails: data.workDetails || '',
            workStartAt: data.workStartAt,
            workEndAt: data.workEndAt,
            linkedPermitRID: data.linkedPermitRID || '',
            contractorCompanyName: data.contractorCompanyName,
            contractorContactPerson: data.contractorContactPerson,
            contractorPhone: data.contractorPhone,
            contractorSubmittedAt: data.contractorSubmittedAt,
            status: data.status || 'รอ LP ตรวจสอบ',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error('[PermitApprovals] onSnapshot error:', e);
        setErr('ไม่สามารถโหลดรายการใบอนุญาตได้');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    return rows.filter((r) => {
      if (!s) return true;
      const hay = [
        r.requesterEmail,
        r.locationName,
        r.shopName,
        r.floor,
        r.workDetails,
        r.linkedPermitRID,
        r.contractorCompanyName || '',
        r.contractorContactPerson || '',
        r.contractorPhone || '',
      ].join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [rows, qtext]);

  const onApprove = async (row: PermitRow) => {
    if (updatingId) return;
    const ok = confirm(`ยืนยันการอนุมัติใบอนุญาต RID: ${row.linkedPermitRID}?`);
    if (!ok) return;

    setUpdatingId(row.id);
    try {
      await updateDoc(doc(db, row.docPath), {
        status: 'อนุมัติเข้าทำงาน',
        updatedAt: serverTimestamp(),
      });
      alert('✅ อนุมัติเรียบร้อย!');
    } catch (e: any) {
      console.error('[PermitApprovals] approve error:', e);
      alert('❌ อนุมัติไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUpdatingId(null);
    }
  };

  const onReject = async (row: PermitRow) => {
    if (updatingId) return;
    const ok = confirm(`ยืนยันการไม่อนุมัติใบอนุญาต RID: ${row.linkedPermitRID}?`);
    if (!ok) return;

    setUpdatingId(row.id);
    try {
      await updateDoc(doc(db, row.docPath), {
        status: 'ไม่อนุมัติ',
        updatedAt: serverTimestamp(),
      });
      alert('ไม่อนุมัติเรียบร้อย');
    } catch (e: any) {
      console.error('[PermitApprovals] reject error:', e);
      alert('❌ ปฏิเสธไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          อนุมัติใบอนุญาต (Permit Approvals)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ตรวจสอบข้อมูลผู้รับเหมาและอนุมัติ/ไม่อนุมัติคำขอที่รอการตรวจสอบ
        </Typography>
      </Box>

      {/* Search */}
      <Card elevation={2} sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="ค้นหา: RID / ผู้ขอ / สถานที่ / ผู้รับเหมา..."
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
      </Card>

      {/* Table */}
      <Paper elevation={3} sx={{ overflow: 'auto', borderRadius: 2 }}>
        <Table sx={{ minWidth: 1400 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f3f4f6' }}>
              <TableCell sx={{ fontWeight: 700 }}>RID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ผู้ขอ</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>สถานที่/ชั้น</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ช่วงเวลา</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ผู้รับเหมา</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>สถานะ</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 200 }}>การจัดการ</TableCell>
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
                    {qtext ? 'ไม่พบข้อมูลที่ค้นหา' : 'ไม่มีคำขอที่รอการตรวจสอบ'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const updating = updatingId === r.id;
                return (
                  <TableRow key={r.docPath} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BadgeIcon fontSize="small" color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight={700} color="primary">
                            {r.linkedPermitRID}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ส่ง: {fmt(r.createdAt)}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={600}>
                          {r.requesterEmail}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <StoreIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {r.locationName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ชั้น: {r.floor}
                          </Typography>
                          {r.shopName && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              ({r.shopName})
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <ScheduleIcon fontSize="small" color="action" />
                          <Typography variant="caption">
                            {fmt(r.workStartAt)}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          → {fmt(r.workEndAt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.workDetails}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <BusinessIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {r.contractorCompanyName || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            ติดต่อ: {r.contractorContactPerson || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            โทร: {r.contractorPhone || '-'}
                          </Typography>
                          {r.contractorSubmittedAt && (
                            <Chip
                              label={`ส่งเมื่อ: ${fmt(r.contractorSubmittedAt)}`}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ mt: 0.5, fontSize: 10 }}
                            />
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="column" spacing={1}>
                        <Button
                          variant="contained"
                          size="small"
                          color="success"
                          startIcon={updating ? <CircularProgress size={16} color="inherit" /> : <ApproveIcon />}
                          disabled={updating}
                          onClick={() => onApprove(r)}
                          fullWidth
                        >
                          {updating ? 'อัปเดต...' : 'อนุมัติ'}
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          color="error"
                          startIcon={<RejectIcon />}
                          disabled={updating}
                          onClick={() => onReject(r)}
                          fullWidth
                        >
                          ไม่อนุมัติ
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

      {/* Summary */}
      {!loading && !err && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            แสดง {filtered.length} จาก {rows.length} รายการ
            {qtext && ` (กรองด้วย: "${qtext}")`}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PermitApprovalsPage;
