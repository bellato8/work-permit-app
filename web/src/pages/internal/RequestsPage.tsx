// ======================================================================
// File: web/src/pages/internal/RequestsPage.tsx
// เวอร์ชัน: 31/10/2025 02:00 (NEW FILE)
// หน้าที่: แสดงรายการ "คำขอของฉัน" (Internal Requests)
//          ดึงข้อมูลจาก artifacts/{appId}/users/{userId}/internal_requests
// ผู้สร้าง: เพื่อนคู่คิด
// ======================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';

// MUI Components
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Fab,
  AppBar,
  Toolbar,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Stack,
} from '@mui/material';

// MUI Icons
import {
  Add as AddIcon,
  Search as SearchIcon,
  ListAlt as ListAltIcon,
  ExitToApp as ExitIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material';

type InternalRequest = {
  id: string;
  locationName?: string;
  floor?: string;
  workDetails?: string;
  status?: string;
  createdAt?: Timestamp;
};

const formatDate = (ts: Timestamp | undefined) => {
  if (!ts) return '-';
  return ts.toDate().toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusChip = (status: string | undefined) => {
  const s = (status || 'รอดำเนินการ').toLowerCase();
  let color: 'warning' | 'info' | 'success' | 'error' = 'warning';
  if (s.includes('อนุมัติ')) color = 'success';
  else if (s.includes('ปฏิเสธ')) color = 'error';
  else if (s.includes('เสร็จสิ้น')) color = 'info';

  return <Chip label={status || 'รอดำเนินการ'} color={color} size="small" />;
};

export default function InternalRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<InternalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      navigate('/internal/login');
      return;
    }

    const APP_ID = import.meta.env.VITE_APP_ID || 'default';
    const path = `artifacts/${APP_ID}/users/${user.uid}/internal_requests`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<InternalRequest, 'id'>),
        }));
        setRequests(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching requests:', err);
        setError('ไม่สามารถโหลดข้อมูลคำขอได้: ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, navigate]);

  const filteredRequests = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return requests;
    return requests.filter((req) =>
      [req.locationName, req.floor, req.workDetails, req.id]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [requests, searchTerm]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/internal/login');
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <AppBar position="sticky" sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Toolbar>
          <ListAltIcon sx={{ mr: 2, fontSize: 32 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            คำขอของฉัน
          </Typography>
          <Button color="inherit" onClick={handleLogout} startIcon={<ExitIcon />}>
            ออกจากระบบ
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Card elevation={2} sx={{ mb: 3, p: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="ค้นหา: สถานที่, ชั้น, รายละเอียด, RID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Card>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 10 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : filteredRequests.length === 0 ? (
          <Card sx={{ textAlign: 'center', p: 5 }}>
             <InboxIcon sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              ยังไม่มีคำขอ
            </Typography>
            <Typography color="text.secondary">
              คลิกปุ่ม + ด้านล่างเพื่อสร้างคำขอใหม่
            </Typography>
          </Card>
        ) : (
          <Stack spacing={2}>
            {filteredRequests.map((req) => (
              <Card key={req.id} elevation={3} sx={{ '&:hover': { boxShadow: 6 } }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {req.locationName} (ชั้น: {req.floor})
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {req.workDetails}
                      </Typography>
                       <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        RID: {req.id}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 2 }}>
                      {statusChip(req.status)}
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        {formatDate(req.createdAt)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Container>

      <Fab
        color="primary"
        aria-label="add"
        onClick={() => navigate('/internal/requests/new')}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
