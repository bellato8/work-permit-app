// ======================================================================
// File: web/src/pages/internal/NewRequest.tsx
// เวอร์ชัน: 28/10/2025 01:00 (Asia/Bangkok)
// หน้าที่: ฟอร์มส่งคำขอใหม่ของพนักงานภายใน — เลือกสถานที่ → ระบบโชว์ "ชั้น" ให้เลือกอัตโนมัติ → กรอกข้อมูลสั้น ๆ → บันทึกคำขอ
// เชื่อม Firestore ตาม "สัญญา": artifacts/{appId}/users/{userId}/internal_requests
// เปลี่ยนแปลงรอบนี้:
//   • เปลี่ยนจาก inline styles → ใช้ MUI components ทั้งหมด
//   • เพิ่ม gradient AppBar และ Card layout
//   • ใช้ MUI TextField, Select, Button พร้อม icons
//   • เพิ่ม Stepper เพื่อแสดงขั้นตอนการกรอกฟอร์ม
//   • Modern design พร้อม responsive layout
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 28/10/2025 01:00
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, app } from '../../lib/firebase';
import { getAuth } from 'firebase/auth';

// MUI Components
import {
  AppBar,
  Toolbar,
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Box,
  Grid,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Fade,
  Paper,
  Divider,
  InputAdornment,
  LinearProgress,
} from '@mui/material';

// MUI Icons
import {
  Store as StoreIcon,
  Layers as LayersIcon,
  Schedule as ScheduleIcon,
  Engineering as EngineeringIcon,
  Description as DescriptionIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  ShoppingCart as ShopIcon,
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';

// ---------- ประเภทข้อมูลแบบเรียบง่าย ----------
type FloorOption = { id: string; name: string; isActive?: boolean };

type LocationRow = {
  id: string;
  locationName?: string;
  floor?: any;
  status?: string;
  name?: string;
  floors?: FloorOption[];
  isActive?: boolean;
};

// ---------- ค่าตั้งต้น ----------
const APP_ID = import.meta.env.VITE_APP_ID || 'default';
const COLLECTION_LOCATIONS_PRIMARY = `artifacts/${APP_ID}/public/data/locations`;
const COLLECTION_INTERNAL_REQUESTS_BASE = `artifacts/${APP_ID}/users`;
const COLLECTION_LOCATIONS_FALLBACK = `locations`;

// แปลง floors → อาเรย์ FloorOption แบบเดียวกัน
function normalizeFloors(row: LocationRow): FloorOption[] {
  if (row.floor && Array.isArray(row.floor)) {
    return (row.floor as any[])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0)
      .map((name) => ({ id: name, name, isActive: true }));
  }
  if (row.floor && typeof row.floor === 'string') {
    return String(row.floor)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((name) => ({ id: name, name, isActive: true }));
  }
  if (Array.isArray(row.floors)) {
    return row.floors.map((f) => ({
      id: f.id || f.name,
      name: f.name,
      isActive: f.isActive ?? true,
    }));
  }
  return [];
}

function extractLocationName(row: LocationRow): string {
  return row.locationName || row.name || '(ไม่มีชื่อ)';
}

function isRowActive(row: LocationRow): boolean {
  if (typeof row.isActive === 'boolean') return row.isActive;
  if (typeof row.status === 'string') return row.status.toLowerCase() === 'active';
  return true;
}

// ---------- คอมโพเนนต์หลัก ----------
export default function NewRequest() {
  const navigate = useNavigate();
  const authInst = auth || getAuth(app);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loadingLocs, setLoadingLocs] = useState(true);
  const [mounted, setMounted] = useState(false);

  // ค่าที่ผู้ใช้เลือก/กรอก
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [workDetails, setWorkDetails] = useState('');
  const [workStartAt, setWorkStartAt] = useState('');
  const [workEndAt, setWorkEndAt] = useState('');
  const [contractorCompany, setContractorCompany] = useState('');
  const [contractorContactName, setContractorContactName] = useState('');
  const [contractorContactPhone, setContractorContactPhone] = useState('');
  const [shopName, setShopName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Fade-in animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // โหลดสถานที่จากตำแหน่งหลัก
  useEffect(() => {
    let unsubPrimary: any;
    let triedFallback = false;

    const loadPrimary = () => {
      const q = query(collection(db, COLLECTION_LOCATIONS_PRIMARY), orderBy('name'));
      unsubPrimary = onSnapshot(
        q,
        (snap) => {
          const arr: LocationRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          if (arr.length > 0) {
            setLocations(arr.filter(isRowActive));
            setLoadingLocs(false);
          } else {
            if (!triedFallback) {
              triedFallback = true;
              loadFallback();
            } else {
              setLocations([]);
              setLoadingLocs(false);
            }
          }
        },
        (err) => {
          if (!triedFallback) {
            triedFallback = true;
            loadFallback();
          } else {
            setErrMsg(err?.message || 'โหลดสถานที่ไม่สำเร็จ');
            setLoadingLocs(false);
          }
        }
      );
    };

    const loadFallback = () => {
      const q2 = query(collection(db, COLLECTION_LOCATIONS_FALLBACK), orderBy('name'));
      const unsub = onSnapshot(
        q2,
        (snap) => {
          const arr: LocationRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          setLocations(arr.filter(isRowActive));
          setLoadingLocs(false);
        },
        (err) => {
          setErrMsg(err?.message || 'โหลดสถานที่ (สำรอง) ไม่สำเร็จ');
          setLoadingLocs(false);
        }
      );
    };

    loadPrimary();
    return () => {
      if (typeof unsubPrimary === 'function') unsubPrimary();
    };
  }, []);

  // ชั้นที่ใช้เลือก
  const floorOptions = useMemo<FloorOption[]>(() => {
    const row = locations.find((x) => x.id === selectedLocationId);
    if (!row) return [];
    return normalizeFloors(row).filter((f) => f.isActive !== false);
  }, [locations, selectedLocationId]);

  // Active step calculation (for stepper)
  const activeStep = useMemo(() => {
    if (!selectedLocationId || !selectedFloor) return 0;
    if (!workDetails || !workStartAt || !workEndAt) return 1;
    return 2;
  }, [selectedLocationId, selectedFloor, workDetails, workStartAt, workEndAt]);

  function validate(): string | null {
    if (!selectedLocationId) return 'กรุณาเลือกสถานที่';
    if (!selectedFloor) return 'กรุณาเลือกชั้น';
    if (!workStartAt || !workEndAt) return 'กรุณากรอกเวลาเริ่มและสิ้นสุด';
    const start = new Date(workStartAt).getTime();
    const end = new Date(workEndAt).getTime();
    if (isFinite(start) && isFinite(end) && start >= end) {
      return 'เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด';
    }
    if (!workDetails.trim()) return 'กรุณากรอกรายละเอียดงานโดยย่อ';
    return null;
  }

  async function handleSubmit() {
    setErrMsg(null);
    const err = validate();
    if (err) {
      setErrMsg(err);
      return;
    }

    const user = authInst.currentUser;
    if (!user) {
      setErrMsg('ยังไม่ได้เข้าสู่ระบบ');
      return;
    }

    const row = locations.find((x) => x.id === selectedLocationId);
    const locationName = row ? extractLocationName(row) : '';

    const payload = {
      requesterEmail: user.email || '',
      locationId: selectedLocationId,
      locationName,
      shopName: shopName.trim() || null,
      floor: selectedFloor,
      workDetails: workDetails.trim(),
      workStartAt: new Date(workStartAt).toISOString(),
      workEndAt: new Date(workEndAt).toISOString(),
      contractorCompany: contractorCompany.trim() || null,
      contractorContactName: contractorContactName.trim() || null,
      contractorContactPhone: contractorContactPhone.trim() || null,
      status: 'รอดำเนินการ',
      linkedPermitRID: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      setSubmitting(true);
      const col = collection(db, `${COLLECTION_INTERNAL_REQUESTS_BASE}/${user.uid}/internal_requests`);
      await addDoc(col, payload);
      navigate('/internal/requests');
    } catch (e: any) {
      setErrMsg(e?.message || 'บันทึกคำขอไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  const steps = ['สถานที่และชั้น', 'รายละเอียดงาน', 'ข้อมูลเพิ่มเติม'];

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f7fa', fontFamily: 'Sarabun, sans-serif' }}>
      {/* AppBar */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Toolbar>
          <LocationIcon sx={{ mr: 2, fontSize: 32 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              ส่งคำขอใหม่
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              กรอกข้อมูลเพื่อขออนุญาตเข้าทำงาน
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/internal/requests')}
            disabled={submitting}
            sx={{
              color: 'white',
              borderColor: 'white',
              '&:hover': {
                borderColor: 'white',
                background: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            ย้อนกลับ
          </Button>
        </Toolbar>
      </AppBar>

      {/* Loading indicator */}
      {loadingLocs && <LinearProgress />}

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Fade in={mounted} timeout={600}>
          <Box>
            {/* Stepper */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
              <Stepper activeStep={activeStep} alternativeLabel>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Paper>

            {/* Error Alert */}
            {errMsg && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrMsg(null)}>
                {errMsg}
              </Alert>
            )}

            {/* Section 1: Location & Floor */}
            <Card
              elevation={3}
              sx={{
                mb: 3,
                borderRadius: 2,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                '&:hover': { boxShadow: 6 },
              }}
            >
              <Box
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 3,
                  py: 2,
                  color: 'white',
                }}
              >
                <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center' }}>
                  <StoreIcon sx={{ mr: 1 }} />
                  สถานที่และชั้น
                </Typography>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      fullWidth
                      label="สถานที่"
                      value={selectedLocationId}
                      onChange={(e) => {
                        setSelectedLocationId(e.target.value);
                        setSelectedFloor('');
                      }}
                      disabled={loadingLocs}
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocationIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    >
                      {locations.length === 0 ? (
                        <MenuItem value="" disabled>
                          {loadingLocs ? 'กำลังโหลด...' : 'ไม่มีสถานที่'}
                        </MenuItem>
                      ) : (
                        locations.map((loc) => (
                          <MenuItem key={loc.id} value={loc.id}>
                            {extractLocationName(loc)}
                          </MenuItem>
                        ))
                      )}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      select
                      fullWidth
                      label="ชั้น"
                      value={selectedFloor}
                      onChange={(e) => setSelectedFloor(e.target.value)}
                      disabled={!selectedLocationId || floorOptions.length === 0}
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LayersIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    >
                      {!selectedLocationId ? (
                        <MenuItem value="" disabled>
                          กรุณาเลือกสถานที่ก่อน
                        </MenuItem>
                      ) : floorOptions.length === 0 ? (
                        <MenuItem value="" disabled>
                          ไม่มีชั้นให้เลือก
                        </MenuItem>
                      ) : (
                        floorOptions.map((f) => (
                          <MenuItem key={f.id} value={f.name}>
                            {f.name}
                          </MenuItem>
                        ))
                      )}
                    </TextField>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="ชื่อร้าน/พื้นที่ย่อย (ถ้ามี)"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="เช่น ร้าน A หรือ พื้นที่คลัง 2"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ShopIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Section 2: Work Details & Schedule */}
            <Card
              elevation={3}
              sx={{
                mb: 3,
                borderRadius: 2,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                '&:hover': { boxShadow: 6 },
              }}
            >
              <Box
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 3,
                  py: 2,
                  color: 'white',
                }}
              >
                <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center' }}>
                  <DescriptionIcon sx={{ mr: 1 }} />
                  รายละเอียดงานและช่วงเวลา
                </Typography>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      label="รายละเอียดงาน"
                      value={workDetails}
                      onChange={(e) => setWorkDetails(e.target.value)}
                      placeholder="เช่น เปลี่ยนโคมไฟ/เดินสายไฟ/ตรวจระบบ"
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                            <DescriptionIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="datetime-local"
                      label="วันเวลาเริ่ม"
                      value={workStartAt}
                      onChange={(e) => setWorkStartAt(e.target.value)}
                      required
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ScheduleIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="datetime-local"
                      label="วันเวลาสิ้นสุด"
                      value={workEndAt}
                      onChange={(e) => setWorkEndAt(e.target.value)}
                      required
                      InputLabelProps={{ shrink: true }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <ScheduleIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Section 3: Contractor Information */}
            <Card
              elevation={3}
              sx={{
                mb: 3,
                borderRadius: 2,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                '&:hover': { boxShadow: 6 },
              }}
            >
              <Box
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 3,
                  py: 2,
                  color: 'white',
                }}
              >
                <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center' }}>
                  <EngineeringIcon sx={{ mr: 1 }} />
                  ข้อมูลผู้รับเหมา (ถ้ามี)
                </Typography>
              </Box>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="บริษัทผู้รับเหมา"
                      value={contractorCompany}
                      onChange={(e) => setContractorCompany(e.target.value)}
                      placeholder="ชื่อบริษัท"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="ผู้ประสานงาน"
                      value={contractorContactName}
                      onChange={(e) => setContractorContactName(e.target.value)}
                      placeholder="ชื่อ-นามสกุล"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="เบอร์โทรศัพท์"
                      value={contractorContactPhone}
                      onChange={(e) => setContractorContactPhone(e.target.value)}
                      placeholder="เบอร์โทรผู้ประสานงาน"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Card elevation={4} sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      onClick={handleSubmit}
                      disabled={submitting}
                      startIcon={<SendIcon />}
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
                        '&:disabled': {
                          background: '#ccc',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {submitting ? 'กำลังบันทึก...' : 'ส่งคำขอ'}
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="large"
                      onClick={() => navigate('/internal/requests')}
                      disabled={submitting}
                      startIcon={<ArrowBackIcon />}
                      sx={{
                        py: 1.5,
                        fontWeight: 700,
                        fontSize: 16,
                        borderWidth: 2,
                        '&:hover': {
                          borderWidth: 2,
                          transform: 'translateY(-2px)',
                          boxShadow: 3,
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      ย้อนกลับ
                    </Button>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                  หลังจากส่งคำขอ ระบบจะนำคุณกลับไปยังหน้า Dashboard เพื่อติดตามสถานะ
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Fade>
      </Container>
    </Box>
  );
}
