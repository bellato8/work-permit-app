// ======================================================================
// File: web/src/pages/admin/lp/LocationsPage.tsx
// เวอร์ชัน: 27/10/2025 (Asia/Bangkok)
// หน้าที่: หน้าจัดการ Master Data "สถานที่/ชั้น" สำหรับ LP Admin
// เชื่อม Firestore: artifacts/{appId}/public/data/locations (ตาม schema)
// ฟีเจอร์: CRUD + toggle Active/Inactive
// หมายเหตุ:
// - แก้ path จาก 'locations' → 'artifacts/{appId}/public/data/locations'
// - เหตุผล: ให้สอดคล้องกับ schema ที่ตกลง และหน้าอื่นใช้ path นี้แล้ว
// - ข้อดี: ข้อมูลรวมอยู่ที่เดียวกัน, ไม่ขัดแย้งระหว่างหน้า
// - ทางเลือก: ไม่มี (ต้องตาม schema)
// วันที่อัปเดต: 27/10/2025
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../../../lib/firebase';

// ดึง APP_ID จาก environment variable (ต้องตั้งค่าใน .env)
const APP_ID = import.meta.env.VITE_APP_ID || 'default';
// Path ตาม schema ที่ตกลง: artifacts/{appId}/public/data/locations
const LOCATIONS_PATH = `artifacts/${APP_ID}/public/data/locations`;

// MUI
import {
  Alert,
  Box,
  Button,
  Container,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';

type FloorItem = {
  id: string;
  name: string;
  isActive: boolean;
};

type LocationDoc = {
  id?: string;
  name: string;
  floors: FloorItem[];
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
};

function parseFloorsInput(raw: string): FloorItem[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({
      id: uuid(),
      name,
      isActive: true,
    }));
}

function floorsToInputValue(floors: FloorItem[]): string {
  return floors.map((f) => f.name).join(', ');
}

export default function LocationsPage() {
  const [items, setItems] = useState<LocationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ฟอร์มเพิ่ม
  const [newName, setNewName] = useState('');
  const [newFloorsInput, setNewFloorsInput] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);

  // โหมดแก้ไข
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editFloorsInput, setEditFloorsInput] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    const q = query(collection(db, LOCATIONS_PATH), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: LocationDoc[] = snap.docs.map((d) => {
          const data = d.data() as LocationDoc;
          return {
            id: d.id,
            name: data.name || '',
            floors: Array.isArray(data.floors) ? data.floors : [],
            isActive: data.isActive ?? true,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setErrorMsg(err?.message || 'โหลดข้อมูลไม่สำเร็จ');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const activeCount = useMemo(() => items.filter((x) => x.isActive).length, [items]);

  async function handleAdd() {
    setErrorMsg(null);
    const name = newName.trim();
    if (!name) {
      setErrorMsg('กรุณากรอกชื่อสถานที่');
      return;
    }
    const floors = parseFloorsInput(newFloorsInput);

    try {
      await addDoc(collection(db, LOCATIONS_PATH), {
        name,
        floors,
        isActive: newIsActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewName('');
      setNewFloorsInput('');
      setNewIsActive(true);
    } catch (e: any) {
      setErrorMsg(e?.message || 'บันทึกไม่สำเร็จ (อาจติดสิทธิ์ เข้าขั้นตอนถัดไป)');
    }
  }

  function startEdit(row: LocationDoc) {
    setEditingId(row.id || null);
    setEditName(row.name);
    setEditFloorsInput(floorsToInputValue(row.floors || []));
    setEditIsActive(!!row.isActive);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditFloorsInput('');
    setEditIsActive(true);
  }

  async function saveEdit(row: LocationDoc) {
    if (!row.id) return;
    const name = editName.trim();
    if (!name) {
      setErrorMsg('กรุณากรอกชื่อสถานที่');
      return;
    }
    const floors = parseFloorsInput(editFloorsInput);

    try {
      await updateDoc(doc(db, LOCATIONS_PATH, row.id), {
        name,
        floors,
        isActive: editIsActive,
        updatedAt: serverTimestamp(),
      });
      cancelEdit();
    } catch (e: any) {
      setErrorMsg(e?.message || 'บันทึกไม่สำเร็จ (อาจติดสิทธิ์ เข้าขั้นตอนถัดไป)');
    }
  }

  async function toggleActive(row: LocationDoc) {
    if (!row.id) return;
    try {
      await updateDoc(doc(db, LOCATIONS_PATH, row.id), {
        isActive: !row.isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      setErrorMsg(e?.message || 'อัปเดตสถานะไม่สำเร็จ (อาจติดสิทธิ์)');
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Work Permit / Admin
          </Typography>
        </Box>

        {/* กล่องสรุป */}
        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            สถานที่ (Locations)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            จัดการ “ชื่อสถานที่” และ “ชั้น” สำหรับให้พนักงานเลือกตอนสร้างคำขอ (ไม่ลบทิ้ง ใช้ปิดใช้งานแทน)
          </Typography>

          <Stack
            direction="row"
            spacing={2}
            sx={{
              mt: 1.5,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 1,
              p: 1.2,
            }}
          >
            <Typography variant="body2">ทั้งหมด: {items.length} รายการ</Typography>
            <Typography variant="body2">เปิดใช้งาน: {activeCount}</Typography>
          </Stack>
        </Paper>

        {/* กล่องเพิ่มรายการ */}
        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            เพิ่มสถานที่ใหม่
          </Typography>

          {/* ใช้ Box ทำกริดแทน Grid ของ MUI */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto auto' },
              gap: 2,
              alignItems: 'center',
            }}
          >
            <TextField
              label="ชื่อสถานที่"
              fullWidth
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="เช่น อาคาร A"
            />
            <TextField
              label="รายชื่อชั้น (คั่นด้วย , )"
              fullWidth
              value={newFloorsInput}
              onChange={(e) => setNewFloorsInput(e.target.value)}
              placeholder="เช่น G, 1, 2, M"
            />
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={newIsActive}
                    onChange={(e) => setNewIsActive(e.target.checked)}
                    color="primary"
                  />
                }
                label="เปิดใช้งาน"
              />
            </Box>
            <Box>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
                บันทึก
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* ตารางรายการ */}
        <Paper elevation={1} sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 700 }}>ชื่อสถานที่</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ชั้น (คั่นด้วย , )</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>สถานะ</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>การกระทำ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading &&
                items.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ minWidth: 200 }}>
                        {isEditing ? (
                          <TextField
                            size="small"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        ) : (
                          row.name
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <TextField
                            size="small"
                            placeholder="เช่น G, 1, 2, M"
                            value={editFloorsInput}
                            onChange={(e) => setEditFloorsInput(e.target.value)}
                            fullWidth
                          />
                        ) : (
                          floorsToInputValue(row.floors || []) || '-'
                        )}
                      </TableCell>
                      <TableCell width={160}>
                        {isEditing ? (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={editIsActive}
                                onChange={(e) => setEditIsActive(e.target.checked)}
                                color="primary"
                              />
                            }
                            label={editIsActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          />
                        ) : row.isActive ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <ToggleOnIcon color="success" />
                            <Typography color="success.main">เปิดใช้งาน</Typography>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <ToggleOffIcon color="disabled" />
                            <Typography color="text.secondary">ปิดใช้งาน</Typography>
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell width={220}>
                        {!isEditing ? (
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              startIcon={<EditIcon />}
                              onClick={() => startEdit(row)}
                            >
                              แก้ไข
                            </Button>
                            <Button
                              variant="contained"
                              color={row.isActive ? 'warning' : 'success'}
                              startIcon={row.isActive ? <ToggleOffIcon /> : <ToggleOnIcon />}
                              onClick={() => toggleActive(row)}
                            >
                              {row.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            </Button>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="contained"
                              color="success"
                              startIcon={<SaveIcon />}
                              onClick={() => saveEdit(row)}
                            >
                              บันทึก
                            </Button>
                            <Button
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={cancelEdit}
                            >
                              ยกเลิก
                            </Button>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}

              {items.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4}>ยังไม่มีข้อมูล ลองเพิ่มด้านบนเลย</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
      </Stack>
    </Container>
  );
}
