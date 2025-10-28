// ============================================================
// ไฟล์: src/pages/admin/Settings.tsx
// หน้าที่: Master Data — Departments / Locations / Work Types / Safety Checklists
// คุณสมบัติ:
//  - CRUD ทั้ง 4 หมวด (persist ใน localStorage)
//  - Checklist ผูกกับ Work Types (many-to-many)
//  - เขียน System Logs ผ่าน mockStore.addLog
//  - ใช้ Material-UI components ทั้งหมด
// เปลี่ยนแปลงรอบนี้:
//   • แปลง Tailwind CSS และ custom classes เป็น MUI components
//   • ใช้ Tabs สำหรับแบ่งส่วน 4 หมวด
//   • เพิ่ม gradient AppBar และ Card layout
//   • Icons สำหรับแต่ละหมวด
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { mockStore, useMockVersion } from "../../data/store";

// MUI Components
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Chip,
  Checkbox,
  FormControlLabel,
  Paper,
  Divider,
  Alert,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';

// MUI Icons
import {
  Business as DepartmentIcon,
  LocationOn as LocationIcon,
  Engineering as WorkTypeIcon,
  ChecklistRtl as ChecklistIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

type Id = string;
type Department = { id: Id; name: string };
type Location = { id: Id; name: string };
type WorkType = { id: Id; name: string };
type Checklist = {
  id: Id;
  name: string;
  items: string[];
  workTypeIds: Id[];
};

const LS_DEPT = "wp_master_departments";
const LS_LOC  = "wp_master_locations";
const LS_WT   = "wp_master_worktypes";
const LS_CHK  = "wp_master_checklists";

// --------- Utils ---------
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}
function save<T>(key: string, v: T) {
  localStorage.setItem(key, JSON.stringify(v));
}

export default function Settings() {
  useMockVersion();

  // --- Seeds เบื้องต้น ---
  const seedDept: Department[] = [
    { id: uid(), name: "ซ่อมบำรุง" },
    { id: uid(), name: "ผลิต" },
    { id: uid(), name: "ความปลอดภัย" },
  ];
  const seedLoc: Location[] = [
    { id: uid(), name: "โซน A" },
    { id: uid(), name: "โซน B" },
    { id: uid(), name: "คลังวัตถุดิบ" },
  ];
  const seedWt: WorkType[] = [
    { id: uid(), name: "งานไฟฟ้า" },
    { id: uid(), name: "งานที่สูง" },
    { id: uid(), name: "งานในที่อับอากาศ" },
    { id: uid(), name: "งานเชื่อม" },
  ];
  const seedChk: Checklist[] = [
    { id: uid(), name: "พื้นฐานก่อนเริ่มงาน", items: [
      "ผู้ปฏิบัติงานสวม PPE ครบถ้วน",
      "ตรวจสภาพอุปกรณ์ก่อนใช้งาน",
      "มีผู้ควบคุมงานประจำจุด",
    ], workTypeIds: [] },
  ];

  // --- States ---
  const [departments, setDepartments] = useState<Department[]>(() => load(LS_DEPT, seedDept));
  const [locations,   setLocations]   = useState<Location[]>(() => load(LS_LOC, seedLoc));
  const [workTypes,   setWorkTypes]   = useState<WorkType[]>(() => load(LS_WT, seedWt));
  const [checklists,  setChecklists]  = useState<Checklist[]>(() => load(LS_CHK, seedChk));

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // ฟอร์มเพิ่มใหม่ (inline)
  const [deptName, setDeptName] = useState("");
  const [locName,  setLocName]  = useState("");
  const [wtName,   setWtName]   = useState("");
  const [newChkName, setNewChkName] = useState("");
  const [newChkItems, setNewChkItems] = useState("ใส่ PPE, ตรวจอุปกรณ์");
  const [newChkWts, setNewChkWts] = useState<Id[]>([]);

  // บันทึกเมื่อ state เปลี่ยน
  useEffect(() => save(LS_DEPT, departments), [departments]);
  useEffect(() => save(LS_LOC,  locations),   [locations]);
  useEffect(() => save(LS_WT,   workTypes),   [workTypes]);
  useEffect(() => save(LS_CHK,  checklists),  [checklists]);

  // --------- Departments ---------
  const addDept = () => {
    const name = clean(deptName);
    if (!name) return;
    const d: Department = { id: uid(), name };
    setDepartments((prev) => [...prev, d]);
    setDeptName("");
    mockStore.addLog("MASTER_DEPT_ADD", d.id, d.name);
  };
  const renameDept = (id: Id, name: string) => {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, name: clean(name) } : d));
    mockStore.addLog("MASTER_DEPT_RENAME", id, clean(name));
  };
  const removeDept = (id: Id) => {
    if (!confirm("ยืนยันลบแผนกนี้?")) return;
    setDepartments(prev => prev.filter(d => d.id !== id));
    mockStore.addLog("MASTER_DEPT_REMOVE", id);
  };

  // --------- Locations ---------
  const addLoc = () => {
    const name = clean(locName);
    if (!name) return;
    const l: Location = { id: uid(), name };
    setLocations((prev) => [...prev, l]);
    setLocName("");
    mockStore.addLog("MASTER_LOC_ADD", l.id, l.name);
  };
  const renameLoc = (id: Id, name: string) => {
    setLocations(prev => prev.map(x => x.id === id ? { ...x, name: clean(name) } : x));
    mockStore.addLog("MASTER_LOC_RENAME", id, clean(name));
  };
  const removeLoc = (id: Id) => {
    if (!confirm("ยืนยันลบสถานที่นี้?")) return;
    setLocations(prev => prev.filter(x => x.id !== id));
    mockStore.addLog("MASTER_LOC_REMOVE", id);
  };

  // --------- Work Types ---------
  const addWt = () => {
    const name = clean(wtName);
    if (!name) return;
    const w: WorkType = { id: uid(), name };
    setWorkTypes(prev => [...prev, w]);
    setWtName("");
    mockStore.addLog("MASTER_WT_ADD", w.id, w.name);
  };
  const renameWt = (id: Id, name: string) => {
    setWorkTypes(prev => prev.map(x => x.id === id ? { ...x, name: clean(name) } : x));
    mockStore.addLog("MASTER_WT_RENAME", id, clean(name));
  };
  const removeWt = (id: Id) => {
    if (!confirm("ยืนยันลบประเภทงานนี้? รายการนี้จะถูกนำออกจาก Checklist ที่เกี่ยวข้องด้วย")) return;
    setWorkTypes(prev => prev.filter(x => x.id !== id));
    setChecklists(prev => prev.map(c => ({ ...c, workTypeIds: c.workTypeIds.filter(wid => wid !== id) })));
    mockStore.addLog("MASTER_WT_REMOVE", id);
  };

  // --------- Checklists ---------
  const addChecklist = () => {
    const name = clean(newChkName);
    if (!name) return;
    const items = newChkItems.split(",").map(s => clean(s)).filter(Boolean);
    const uniqWts = Array.from(new Set(newChkWts));
    const c: Checklist = { id: uid(), name, items, workTypeIds: uniqWts };
    setChecklists(prev => [...prev, c]);
    setNewChkName(""); setNewChkItems(""); setNewChkWts([]);
    mockStore.addLog("MASTER_CHK_ADD", c.id, `${c.name} (${c.items.length} ข้อ)`);
  };

  const renameChecklist = (id: Id, name: string) => {
    setChecklists(prev => prev.map(c => c.id === id ? ({ ...c, name: clean(name) }) : c));
    mockStore.addLog("MASTER_CHK_RENAME", id, clean(name));
  };

  const setChecklistItems = (id: Id, itemsStr: string) => {
    const items = itemsStr.split("\n").map(s => clean(s)).filter(Boolean);
    setChecklists(prev => prev.map(c => c.id === id ? ({ ...c, items }) : c));
    mockStore.addLog("MASTER_CHK_EDIT_ITEMS", id, `${items.length} ข้อ`);
  };

  const toggleChecklistWorkType = (id: Id, wtId: Id) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== id) return c;
      const has = c.workTypeIds.includes(wtId);
      const workTypeIds = has ? c.workTypeIds.filter(x => x !== wtId) : [...c.workTypeIds, wtId];
      return { ...c, workTypeIds };
    }));
    mockStore.addLog("MASTER_CHK_TOGGLE_WT", id, wtId);
  };

  const removeChecklist = (id: Id) => {
    if (!confirm("ยืนยันลบ Checklist นี้?")) return;
    setChecklists(prev => prev.filter(c => c.id !== id));
    mockStore.addLog("MASTER_CHK_REMOVE", id);
  };

  // การนับเพื่อโชว์สรุป
  const counts = useMemo(() => ({
    dept: departments.length,
    loc: locations.length,
    wt: workTypes.length,
    chk: checklists.length,
  }), [departments, locations, workTypes, checklists]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Typography variant="h4" fontWeight={700} gutterBottom sx={{ mb: 3 }}>
        System Settings / Master Data
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard label="แผนก" value={counts.dept} icon={<DepartmentIcon />} color="#667eea" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard label="สถานที่" value={counts.loc} icon={<LocationIcon />} color="#764ba2" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard label="ประเภทงาน" value={counts.wt} icon={<WorkTypeIcon />} color="#f093fb" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <SummaryCard label="Checklists" value={counts.chk} icon={<ChecklistIcon />} color="#4facfe" />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)', fontWeight: 600 },
            '& .Mui-selected': { color: 'white !important' },
            '& .MuiTabs-indicator': { backgroundColor: 'white', height: 3 },
          }}
        >
          <Tab icon={<DepartmentIcon />} iconPosition="start" label="แผนก" />
          <Tab icon={<LocationIcon />} iconPosition="start" label="สถานที่" />
          <Tab icon={<WorkTypeIcon />} iconPosition="start" label="ประเภทงาน" />
          <Tab icon={<ChecklistIcon />} iconPosition="start" label="Safety Checklists" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Tab 0: Departments */}
          {activeTab === 0 && (
            <TabPanel>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                จัดการแผนก (Departments)
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="ชื่อแผนก เช่น ซ่อมบำรุง"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addDept()}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addDept}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    minWidth: 120,
                  }}
                >
                  Add
                </Button>
              </Stack>
              <SimpleList
                rows={departments}
                onRename={renameDept}
                onRemove={removeDept}
                emptyText="ยังไม่มีแผนก"
              />
            </TabPanel>
          )}

          {/* Tab 1: Locations */}
          {activeTab === 1 && (
            <TabPanel>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                จัดการสถานที่ปฏิบัติงาน (Locations)
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="ชื่อโซน/พื้นที่ เช่น โซน A"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addLoc()}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addLoc}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    minWidth: 120,
                  }}
                >
                  Add
                </Button>
              </Stack>
              <SimpleList
                rows={locations}
                onRename={renameLoc}
                onRemove={removeLoc}
                emptyText="ยังไม่มีสถานที่"
              />
            </TabPanel>
          )}

          {/* Tab 2: Work Types */}
          {activeTab === 2 && (
            <TabPanel>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                จัดการประเภทงาน (Work Permit Types)
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="ชื่อประเภทงาน เช่น งานไฟฟ้า"
                  value={wtName}
                  onChange={(e) => setWtName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addWt()}
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addWt}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    minWidth: 120,
                  }}
                >
                  Add
                </Button>
              </Stack>
              <SimpleList
                rows={workTypes}
                onRename={renameWt}
                onRemove={removeWt}
                emptyText="ยังไม่มีประเภทงาน"
              />
            </TabPanel>
          )}

          {/* Tab 3: Checklists */}
          {activeTab === 3 && (
            <TabPanel>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                จัดการ Safety Checklists
              </Typography>

              {/* Add new checklist form */}
              <Card elevation={2} sx={{ mb: 3, p: 2, bgcolor: '#f9fafb' }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  เพิ่ม Checklist ใหม่
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="ชื่อ Checklist"
                      placeholder="เช่น Checklist งานไฟฟ้า (ก่อนเริ่มงาน)"
                      value={newChkName}
                      onChange={(e) => setNewChkName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="ข้อคำถาม (คั่นด้วย ,)"
                      placeholder="ใส่ PPE, ตรวจอุปกรณ์, ..."
                      value={newChkItems}
                      onChange={(e) => setNewChkItems(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" display="block" gutterBottom fontWeight={600}>
                      ผูกกับประเภทงาน (เลือกได้หลายอัน)
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {workTypes.map((w) => {
                        const checked = newChkWts.includes(w.id);
                        return (
                          <Chip
                            key={w.id}
                            label={w.name}
                            onClick={() => {
                              setNewChkWts((prev) =>
                                prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id]
                              );
                            }}
                            color={checked ? 'primary' : 'default'}
                            variant={checked ? 'filled' : 'outlined'}
                            sx={{ cursor: 'pointer' }}
                          />
                        );
                      })}
                    </Stack>
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={addChecklist}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      }}
                    >
                      Add Checklist
                    </Button>
                  </Grid>
                </Grid>
              </Card>

              {/* Checklists Table */}
              {checklists.length === 0 ? (
                <Alert severity="info">ยังไม่มี Checklist</Alert>
              ) : (
                <Paper elevation={2} sx={{ overflow: 'auto' }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f3f4f6' }}>
                        <TableCell sx={{ fontWeight: 700 }}>ชื่อ</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>ข้อคำถาม</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>ผูกกับประเภทงาน</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 100 }}>จัดการ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {checklists.map((c) => (
                        <TableRow key={c.id} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
                          <TableCell sx={{ verticalAlign: 'top', minWidth: 200 }}>
                            <TextField
                              fullWidth
                              size="small"
                              value={c.name}
                              onChange={(e) => renameChecklist(c.id, e.target.value)}
                            />
                          </TableCell>
                          <TableCell sx={{ verticalAlign: 'top', minWidth: 300 }}>
                            <TextField
                              fullWidth
                              multiline
                              rows={4}
                              size="small"
                              placeholder="พิมพ์ 1 ข้อต่อ 1 บรรทัด"
                              value={c.items.join('\n')}
                              onChange={(e) => setChecklistItems(c.id, e.target.value)}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                              {c.items.length} ข้อ
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ verticalAlign: 'top', minWidth: 250 }}>
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                              {workTypes.map((w) => {
                                const checked = c.workTypeIds.includes(w.id);
                                return (
                                  <Chip
                                    key={w.id}
                                    label={w.name}
                                    size="small"
                                    onClick={() => toggleChecklistWorkType(c.id, w.id)}
                                    color={checked ? 'primary' : 'default'}
                                    variant={checked ? 'filled' : 'outlined'}
                                    sx={{ cursor: 'pointer' }}
                                  />
                                );
                              })}
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ verticalAlign: 'top' }}>
                            <IconButton color="error" onClick={() => removeChecklist(c.id)} size="small">
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </TabPanel>
          )}
        </Box>
      </Paper>

      {/* Footer note */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="caption">
          หมายเหตุ: การเปลี่ยนแปลงทั้งหมดบันทึกในเครื่อง (localStorage) และเขียนลง System Logs (MASTER_*)
        </Typography>
      </Alert>
    </Box>
  );
}

// ----------------- Sub Components -----------------

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card
      elevation={3}
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
              color: 'white',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={700}>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return <Box>{children}</Box>;
}

function SimpleList({
  rows,
  onRename,
  onRemove,
  emptyText,
}: {
  rows: { id: Id; name: string }[];
  onRename: (id: Id, name: string) => void;
  onRemove: (id: Id) => void;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <Alert severity="info">{emptyText}</Alert>;
  }

  return (
    <Paper elevation={2} sx={{ overflow: 'auto' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: '#f3f4f6' }}>
            <TableCell sx={{ fontWeight: 700 }}>ชื่อ</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120 }}>จัดการ</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} sx={{ '&:hover': { bgcolor: '#f9fafb' } }}>
              <TableCell>
                <TextField
                  fullWidth
                  size="small"
                  value={r.name}
                  onChange={(e) => onRename(r.id, e.target.value)}
                />
              </TableCell>
              <TableCell>
                <IconButton color="error" onClick={() => onRemove(r.id)} size="small">
                  <DeleteIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
