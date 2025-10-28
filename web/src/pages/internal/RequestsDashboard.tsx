// ======================================================================
// File: web/src/pages/internal/RequestsDashboard.tsx
// เวอร์ชัน: 27/10/2025 03:45 (Asia/Bangkok)
// หน้าที่: แดชบอร์ด "คำขอของฉัน" แสดง internal_requests เฉพาะของผู้ใช้ที่ล็อกอิน
//          ออกแบบใหม่ด้วย Material-UI พร้อมสีสันสดใส เรียบหรู modern
// เปลี่ยนแปลงรอบนี้:
//   • เปลี่ยนจากตาราง → MUI Card Grid layout
//   • เพิ่ม AppBar/Toolbar พร้อม gradient สีสันสดใส
//   • ใช้ MUI Chip สำหรับ status badges พร้อม icons
//   • เพิ่ม icons สำหรับแต่ละข้อมูล (Location, Time, Contractor, etc.)
//   • Empty state ที่สวยงาม
//   • Loading skeleton animation
//   • Responsive grid (xs=12, sm=6, md=4)
//   • Color-coded cards ตามสถานะ
//   • Floating Action Button สำหรับสร้างคำขอใหม่
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 27/10/2025 03:45
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

// MUI Components
import {
  AppBar,
  Toolbar,
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Fab,
  IconButton,
  Skeleton,
  Alert,
  InputAdornment,
  Divider,
} from '@mui/material';

// MUI Icons
import {
  Add as AddIcon,
  Store as StoreIcon,
  Schedule as ScheduleIcon,
  Engineering as EngineeringIcon,
  CalendarMonth as CalendarIcon,
  ContentCopy as CopyIcon,
  Search as SearchIcon,
  LogoutOutlined as LogoutIcon,
  CheckCircle,
  Cancel,
  HourglassBottom,
  PendingActions,
  Assignment,
} from '@mui/icons-material';

// -----------------------------
// Types
// -----------------------------
type InternalStatus =
  | 'รอดำเนินการ'
  | 'LP รับทราบ (รอผู้รับเหมา)'
  | 'รอ LP ตรวจสอบ'
  | 'อนุมัติเข้าทำงาน'
  | 'ไม่อนุมัติ';

interface InternalRequestDoc {
  id?: string;
  requesterEmail: string;
  locationId: string;
  locationName?: string;
  shopName: string;
  floor: string;
  workDetails: string;
  workStartAt: string | Timestamp;
  workEndAt: string | Timestamp;
  contractorCompany: string;
  contractorContactName: string;
  contractorContactPhone: string;
  status: InternalStatus;
  linkedPermitRID?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// -----------------------------
// Utils
// -----------------------------
const auth = getAuth();
const db = getFirestore();

const APP_ID =
  (import.meta as any).env?.VITE_APP_ID ||
  (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ||
  'demo-app';

function getStatusConfig(status: InternalStatus) {
  switch (status) {
    case 'รอดำเนินการ':
      return { color: 'warning' as const, icon: <PendingActions />, bg: '#fff7ed' };
    case 'LP รับทราบ (รอผู้รับเหมา)':
      return { color: 'info' as const, icon: <HourglassBottom />, bg: '#dbeafe' };
    case 'รอ LP ตรวจสอบ':
      return { color: 'secondary' as const, icon: <Assignment />, bg: '#fef3c7' };
    case 'อนุมัติเข้าทำงาน':
      return { color: 'success' as const, icon: <CheckCircle />, bg: '#dcfce7' };
    case 'ไม่อนุมัติ':
      return { color: 'error' as const, icon: <Cancel />, bg: '#fee2e2' };
    default:
      return { color: 'default' as const, icon: null, bg: '#f3f4f6' };
  }
}

function formatDateTime(input?: string | Timestamp) {
  if (!input) return '-';
  try {
    let d: Date;
    if (typeof input === 'string') {
      d = new Date(input);
    } else if (input instanceof Timestamp) {
      d = input.toDate();
    } else {
      return '-';
    }
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = d.getHours().toString().padStart(2, '0');
    const mi = d.getMinutes().toString().padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return '-';
  }
}

// -----------------------------
// Main Component
// -----------------------------
const RequestsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<InternalRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [qtext, setQtext] = useState('');
  const [statusFilter, setStatusFilter] = useState<InternalStatus | 'ทั้งหมด'>('ทั้งหมด');

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        navigate('/internal/login', { replace: true });
        return;
      }
      setUser(u);
    });
    return () => unsub();
  }, [navigate]);

  // Load data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const colPath = `artifacts/${APP_ID}/users/${user.uid}/internal_requests`;
    const colRef = collection(db, colPath);
    const qy = query(colRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: InternalRequestDoc[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<InternalRequestDoc, 'id'>;
          rows.push({ id: d.id, ...data });
        });
        setItems(rows);
        setLoading(false);
      },
      (e: any) => {
        console.error('[RequestsDashboard] onSnapshot error:', e);
        setErr('ไม่สามารถโหลดรายการคำขอได้');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Filter
  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    return items.filter((it) => {
      const okStatus = statusFilter === 'ทั้งหมด' ? true : it.status === statusFilter;
      if (!okStatus) return false;
      if (!s) return true;
      const hay = [
        it.shopName,
        it.floor,
        it.workDetails,
        it.contractorCompany,
        it.contractorContactPhone,
        it.linkedPermitRID || '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(s);
    });
  }, [items, qtext, statusFilter]);

  // Copy RID
  const copyRID = async (rid: string) => {
    try {
      await navigator.clipboard.writeText(rid);
      alert('คัดลอก RID แล้ว');
    } catch {
      alert('คัดลอกไม่สำเร็จ');
    }
  };

  // Logout
  const handleLogout = async () => {
    await auth.signOut();
    navigate('/internal/login');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', pb: 10 }}>
      {/* AppBar */}
      <AppBar
        position="static"
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: 4,
        }}
      >
        <Toolbar>
          <Assignment sx={{ mr: 1.5, fontSize: 28 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
            คำขอของฉัน
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
            {user?.email}
          </Typography>
          <IconButton color="inherit" onClick={handleLogout} title="ออกจากระบบ">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {/* Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="ค้นหา: ร้าน, ชั้น, รายละเอียด, ผู้รับเหมา, RID..."
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            sx={{ flex: '1 1 300px' }}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>กรองตามสถานะ</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              label="กรองตามสถานะ"
            >
              <MenuItem value="ทั้งหมด">ทั้งหมด</MenuItem>
              <MenuItem value="รอดำเนินการ">รอดำเนินการ</MenuItem>
              <MenuItem value="LP รับทราบ (รอผู้รับเหมา)">LP รับทราบ (รอผู้รับเหมา)</MenuItem>
              <MenuItem value="รอ LP ตรวจสอบ">รอ LP ตรวจสอบ</MenuItem>
              <MenuItem value="อนุมัติเข้าทำงาน">อนุมัติเข้าทำงาน</MenuItem>
              <MenuItem value="ไม่อนุมัติ">ไม่อนุมัติ</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Error */}
        {err && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {err}
          </Alert>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <Grid container spacing={3}>
            {[1, 2, 3].map((i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card>
                  <CardContent>
                    <Skeleton variant="text" width="60%" height={30} />
                    <Skeleton variant="text" width="40%" />
                    <Skeleton variant="rectangular" height={80} sx={{ my: 2 }} />
                    <Skeleton variant="text" width="50%" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <Card
            sx={{
              textAlign: 'center',
              py: 8,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            }}
          >
            <Assignment sx={{ fontSize: 80, color: '#9e9e9e', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {qtext || statusFilter !== 'ทั้งหมด'
                ? 'ไม่พบคำขอที่ตรงกับเงื่อนไข'
                : 'ยังไม่มีคำขอ'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {qtext || statusFilter !== 'ทั้งหมด'
                ? 'ลองเปลี่ยนเงื่อนไขการค้นหา'
                : 'คลิกปุ่ม + ด้านล่างเพื่อสร้างคำขอใหม่'}
            </Typography>
          </Card>
        )}

        {/* Cards Grid */}
        {!loading && filtered.length > 0 && (
          <Grid container spacing={3}>
            {filtered.map((item) => {
              const statusConfig = getStatusConfig(item.status);
              return (
                <Grid item xs={12} sm={6} md={4} key={item.id}>
                  <Card
                    elevation={3}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.3s ease',
                      borderLeft: '4px solid',
                      borderLeftColor: `${statusConfig.color}.main`,
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 8,
                      },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      {/* Status Badge */}
                      <Box sx={{ mb: 2 }}>
                        <Chip
                          icon={statusConfig.icon}
                          label={item.status}
                          color={statusConfig.color}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>

                      {/* Location */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
                        <StoreIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {item.shopName || item.locationName || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ชั้น: {item.floor}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Time */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
                        <ScheduleIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="caption" display="block">
                            {formatDateTime(item.workStartAt)}
                          </Typography>
                          <Typography variant="caption" display="block">
                            → {formatDateTime(item.workEndAt)}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Work Details */}
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {item.workDetails}
                        </Typography>
                      </Box>

                      {/* Contractor */}
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
                        <EngineeringIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="caption" display="block">
                            {item.contractorCompany || '-'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.contractorContactPhone || '-'}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 1.5 }} />

                      {/* Created At */}
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                        <CalendarIcon sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          สร้างเมื่อ: {formatDateTime(item.createdAt)}
                        </Typography>
                      </Box>

                      {/* RID */}
                      {item.linkedPermitRID && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            bgcolor: '#f5f5f5',
                            p: 1,
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} color="primary">
                            RID: {item.linkedPermitRID}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => copyRID(item.linkedPermitRID!)}
                            title="คัดลอก RID"
                          >
                            <CopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        {/* Summary */}
        {!loading && filtered.length > 0 && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              แสดง {filtered.length} จาก {items.length} รายการ
              {(qtext || statusFilter !== 'ทั้งหมด') && ' (กรองแล้ว)'}
            </Typography>
          </Box>
        )}
      </Container>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #5568d3 0%, #65408d 100%)',
          },
        }}
        onClick={() => navigate('/internal/requests/new')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default RequestsDashboard;
