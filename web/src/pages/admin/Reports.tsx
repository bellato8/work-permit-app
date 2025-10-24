// ======================================================================
// File: web/src/pages/admin/Reports.tsx
// เวอร์ชัน: 2025-10-24 (เพิ่มฟีเจอร์เลือกฟิลด์ CSV export)
// หน้าที่: หน้า Reports (MVP) — KPI + Trends + Export CSV แบบเลือกฟิลด์ได้
// เชื่อม auth ผ่านอะแดปเตอร์ ../../lib/reportsApi (แนบ token/x-api-key/x-requester-email ให้อัตโนมัติ)
// การเปลี่ยนแปลง:
// - เพิ่ม Dialog สำหรับเลือกฟิลด์ที่ต้องการ export
// - เพิ่มฟังก์ชัน exportCustomCSV ที่ export เฉพาะฟิลด์ที่เลือก
// ======================================================================

import * as React from "react";
import {
  Box, Stack, Typography, Button, Card, CardContent, Divider,
  Select, MenuItem, FormControl, InputLabel, Tabs, Tab, Tooltip, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox, FormGroup,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";

import dayjs from "dayjs";

import { fetchRequests, toMillis } from "../../lib/reportsApi";
import type { RequestRecord } from "../../lib/reportsApi";

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from "recharts";

type ReportsTab = "overview" | "departments" | "workTypes" | "efficiency" | "safety";
type KpiState = {
  totalPermits?: number | null;
  approvalRate?: number | null;
  avgLeadTimeHrs?: number | null;
  complianceScore?: number | null;
};
type RangePreset = "today" | "thisWeek" | "thisMonth" | "last30";

// ฟิลด์ที่สามารถ export ได้
type ExportField = {
  key: string;
  label: string;
  enabled: boolean;
};

// ---------- Utilities ----------
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function getRangeDates(preset: RangePreset): { from: Date; to: Date } {
  const now = dayjs();
  switch (preset) {
    case "today": return { from: now.startOf("day").toDate(), to: now.endOf("day").toDate() };
    case "thisWeek": return { from: now.startOf("week").toDate(), to: now.endOf("week").toDate() };
    case "thisMonth": return { from: now.startOf("month").toDate(), to: now.endOf("month").toDate() };
    case "last30":
    default: return { from: now.subtract(30, "day").startOf("day").toDate(), to: now.endOf("day").toDate() };
  }
}

// ---------- คำนวณ KPI ----------
function computeKpis(rowsInput: unknown): KpiState {
  const rows = asArray<RequestRecord>(rowsInput);

  const total = rows.length;
  const approved = rows.filter((r) => r?.status === "approved");
  const approvalRate = total ? (approved.length / total) * 100 : 0;

  const leadTimesHrs = approved
    .map((r) => (toMillis(r?.approvedAt) - toMillis(r?.createdAt)) / 36e5)
    .filter((h) => Number.isFinite(h) && h >= 0);
  const avgLeadTimeHrs = leadTimesHrs.length
    ? leadTimesHrs.reduce((a, b) => a + b, 0) / leadTimesHrs.length
    : 0;

  const compliant = rows.filter((r) => !!r?.images?.idCardStampedPath).length;
  const complianceScore = total ? (compliant / total) * 100 : 0;

  return { totalPermits: total, approvalRate, avgLeadTimeHrs, complianceScore };
}

// ---------- คำนวณ Trends ----------
type TrendPoint = { label: string; total: number; approved: number };

function computeTrends(rowsInput: unknown): TrendPoint[] {
  const rows = asArray<RequestRecord>(rowsInput);

  const map = new Map<string, TrendPoint>();
  const inc = (label: string, key: keyof TrendPoint) => {
    const cur = map.get(label) || { label, total: 0, approved: 0 };
    (cur as any)[key] = ((cur as any)[key] || 0) + 1;
    map.set(label, cur);
  };

  rows.forEach((r) => {
    const label = dayjs(toMillis(r?.createdAt)).format("YYYY-MM-DD");
    inc(label, "total");
    if (r?.status === "approved") {
      const ad = dayjs(toMillis(r?.approvedAt)).format("YYYY-MM-DD");
      inc(ad, "approved");
    }
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

// ---------- Export CSV Function ----------
function exportCustomCSV(rows: RequestRecord[], fields: ExportField[]) {
  const enabledFields = fields.filter(f => f.enabled);
  
  if (enabledFields.length === 0) {
    alert("กรุณาเลือกฟิลด์อย่างน้อย 1 ฟิลด์");
    return;
  }

  // สร้าง header
  const headers = enabledFields.map(f => f.label);
  
  // สร้างข้อมูล
  const lines = [headers.join(",")];
  
  const esc = (v: any) => {
    const str = String(v ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  };

  const formatDate = (v: any) => {
    const ms = toMillis(v);
    if (!ms) return "";
    return dayjs(ms).format("YYYY-MM-DD HH:mm:ss");
  };

  rows.forEach((r) => {
    const rowData: string[] = [];
    
    enabledFields.forEach((field) => {
      switch (field.key) {
        case "rid":
          rowData.push(esc(r?.requestId || r?.id || ""));
          break;
        case "requesterName":
          rowData.push(esc(r?.requester?.fullname || r?.requester?.name || ""));
          break;
        case "company":
          rowData.push(esc(r?.requester?.company || ""));
          break;
        case "workType":
          rowData.push(esc(r?.work?.type || ""));
          break;
        case "workCategory":
          rowData.push(esc(r?.work?.category || ""));
          break;
        case "floor":
          rowData.push(esc(r?.work?.floor || ""));
          break;
        case "area":
          rowData.push(esc(r?.work?.area || ""));
          break;
        case "status":
          rowData.push(esc(r?.status || ""));
          break;
        case "createdAt":
          rowData.push(esc(formatDate(r?.createdAt)));
          break;
        case "approvedAt":
          rowData.push(esc(formatDate(r?.approvedAt)));
          break;
        case "rejectedAt":
          rowData.push(esc(formatDate(r?.rejectedAt)));
          break;
        case "updatedAt":
          rowData.push(esc(formatDate(r?.updatedAt)));
          break;
        case "workFrom":
          rowData.push(esc(formatDate(r?.work?.from)));
          break;
        case "workTo":
          rowData.push(esc(formatDate(r?.work?.to)));
          break;
        case "dailyStatus":
          rowData.push(esc(r?.dailyStatus || ""));
          break;
        default:
          rowData.push("");
      }
    });
    
    lines.push(rowData.join(","));
  });

  // สร้าง CSV file
  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const timestamp = dayjs().format("YYYY-MM-DD_HHmmss");
  a.download = `daily-report_${timestamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- คอมโพเนนต์หลัก ----------
export default function Reports() {
  const [range, setRange] = React.useState<RangePreset>("last30");
  const [tab, setTab] = React.useState<ReportsTab>("overview");

  const [kpis, setKpis] = React.useState<KpiState>({
    totalPermits: null,
    approvalRate: null,
    avgLeadTimeHrs: null,
    complianceScore: null,
  });
  const [trends, setTrends] = React.useState<TrendPoint[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [allRows, setAllRows] = React.useState<RequestRecord[]>([]);

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportFields, setExportFields] = React.useState<ExportField[]>([
    { key: "rid", label: "RID", enabled: true },
    { key: "requesterName", label: "ผู้ยื่น", enabled: true },
    { key: "company", label: "บริษัท", enabled: true },
    { key: "workType", label: "ประเภทงาน", enabled: true },
    { key: "workCategory", label: "หมวดงาน", enabled: false },
    { key: "floor", label: "ชั้น", enabled: false },
    { key: "area", label: "พื้นที่", enabled: false },
    { key: "status", label: "สถานะ", enabled: true },
    { key: "createdAt", label: "วันที่ยื่น", enabled: true },
    { key: "approvedAt", label: "วันที่อนุมัติ", enabled: false },
    { key: "rejectedAt", label: "วันที่ปฏิเสธ", enabled: false },
    { key: "updatedAt", label: "วันที่อัปเดต", enabled: false },
    { key: "workFrom", label: "เวลาเริ่มงาน", enabled: false },
    { key: "workTo", label: "เวลาสิ้นสุดงาน", enabled: false },
    { key: "dailyStatus", label: "สถานะรายวัน", enabled: false },
  ]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { from, to } = getRangeDates(range);
        const rows = await fetchRequests({ from, to, status: "All" });
        if (!alive) return;

        const safeRows = asArray<RequestRecord>(rows);
        setAllRows(safeRows);
        setKpis(computeKpis(safeRows));
        setTrends(computeTrends(safeRows));
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "ดึงข้อมูลไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [range]);

  async function handleRefresh() {
    const { from, to } = getRangeDates(range);
    setLoading(true); setError(null);
    try {
      const rows = await fetchRequests({ from, to, status: "All" });
      const safeRows = asArray<RequestRecord>(rows);
      setAllRows(safeRows);
      setKpis(computeKpis(safeRows));
      setTrends(computeTrends(safeRows));
    } catch (e: any) {
      setError(e?.message || "ดึงข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenExportDialog() {
    setExportDialogOpen(true);
  }

  function handleCloseExportDialog() {
    setExportDialogOpen(false);
  }

  function handleToggleField(key: string) {
    setExportFields(prev =>
      prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f)
    );
  }

  function handleSelectAll() {
    setExportFields(prev => prev.map(f => ({ ...f, enabled: true })));
  }

  function handleDeselectAll() {
    setExportFields(prev => prev.map(f => ({ ...f, enabled: false })));
  }

  function handleExport() {
    exportCustomCSV(allRows, exportFields);
    setExportDialogOpen(false);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", md: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 800, flexGrow: 1 }}>
          รายงาน (Reports)
        </Typography>

        {/* Filters: Date Range Preset */}
        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel id="reports-range-label">ช่วงเวลา</InputLabel>
          <Select
            labelId="reports-range-label"
            label="ช่วงเวลา"
            value={range}
            onChange={(e) => setRange(e.target.value as RangePreset)}
          >
            <MenuItem value="today">วันนี้</MenuItem>
            <MenuItem value="thisWeek">สัปดาห์นี้</MenuItem>
            <MenuItem value="thisMonth">เดือนนี้</MenuItem>
            <MenuItem value="last30">30 วันที่ผ่านมา</MenuItem>
          </Select>
        </FormControl>

        <Tooltip title="รีเฟรชข้อมูล">
          <Button startIcon={<RefreshRoundedIcon />} variant="outlined" onClick={handleRefresh} disabled={loading}>
            {loading ? "กำลังโหลด..." : "รีเฟรช"}
          </Button>
        </Tooltip>

        <Tooltip title="Export CSV แบบเลือกฟิลด์ได้">
          <Button startIcon={<FileDownloadRoundedIcon />} variant="contained" onClick={handleOpenExportDialog}>
            Export CSV
          </Button>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      <Divider />

      {/* KPI Row */}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Total Permits" value={loading ? "Loading…" : fmt(kpis.totalPermits)} hint="จำนวนใบอนุญาตทั้งหมด" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Approval Rate" value={loading ? "Loading…" : fmtPct(kpis.approvalRate)} hint="% อนุมัติจากที่ยื่น" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Avg Lead Time" value={loading ? "Loading…" : fmtHours(kpis.avgLeadTimeHrs)} hint="ชั่วโมงเฉลี่ย ยื่น→ตัดสิน" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard title="Compliance" value={loading ? "Loading…" : fmtPct(kpis.complianceScore)} hint="% มีตราประทับรูปบัตร" />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ mt: 1 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Reports Tabs"
        >
          <Tab label="Overview" value="overview" />
          <Tab label="Departments" value="departments" />
          <Tab label="Work Types" value="workTypes" />
          <Tab label="Time & Efficiency" value="efficiency" />
          <Tab label="Safety & Compliance" value="safety" />
        </Tabs>

        {/* Overview Content: Trends */}
        {tab === "overview" && (
          <Card elevation={0} sx={{ mt: 1, borderRadius: 2, border: "1px solid #e5e7eb" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Trends (Daily)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  แสดงจำนวนต่อวัน (Total vs Approved) — ตามช่วงที่เลือก
                </Typography>
              </Stack>

              <Box sx={{ height: 300 }}>
                {loading ? (
                  <Box sx={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress size={22} />
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Total" stroke="#8884d8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="approved" name="Approved" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* แท็บอื่นๆ ยัง placeholder */}
        {tab !== "overview" && (
          <Box
            sx={{
              border: "1px dashed #e5e7eb",
              borderRadius: 2,
              p: 2,
              mt: 1,
              bgcolor: "#fafafa",
              minHeight: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              รายการสำหรับแท็บ "{tab}" จะเติมในเฟสถัดไป
            </Typography>
          </Box>
        )}
      </Box>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={handleCloseExportDialog} maxWidth="sm" fullWidth>
        <DialogTitle>เลือกฟิลด์ที่ต้องการ Export</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button size="small" variant="outlined" onClick={handleSelectAll}>
              เลือกทั้งหมด
            </Button>
            <Button size="small" variant="outlined" onClick={handleDeselectAll}>
              ยกเลิกทั้งหมด
            </Button>
          </Stack>
          
          <FormGroup>
            {exportFields.map((field) => (
              <FormControlLabel
                key={field.key}
                control={
                  <Checkbox
                    checked={field.enabled}
                    onChange={() => handleToggleField(field.key)}
                  />
                }
                label={field.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseExportDialog}>ยกเลิก</Button>
          <Button onClick={handleExport} variant="contained" startIcon={<FileDownloadRoundedIcon />}>
            Export ({exportFields.filter(f => f.enabled).length} ฟิลด์)
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------- ส่วนประกอบย่อย: KPI Card ----------
function KpiCard(props: { title: string; value: string; hint?: string }) {
  const { title, value, hint } = props;
  return (
    <Card elevation={0} sx={{ borderRadius: 2, border: "1px solid #e5e7eb", bgcolor: "background.paper" }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.3 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- ตัวช่วย format ----------
function fmt(n?: number | null) { if (n === null || n === undefined) return "—"; return Intl.NumberFormat().format(n); }
function fmtPct(n?: number | null) { if (n === null || n === undefined) return "—"; return `${(n ?? 0).toFixed(1)}%`; }
function fmtHours(n?: number | null) { if (n === null || n === undefined) return "—"; return `${(n ?? 0).toFixed(1)} hrs`; }

