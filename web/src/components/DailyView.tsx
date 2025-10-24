// ======================================================================
// File: web/src/components/DailyView.tsx
// Purpose: แสดงงานประจำวันแบบ 3 คอลัมน์ พร้อม "Quick View" รายละเอียดจริง
// Updated: 2025-10-23
//
// เปลี่ยนสำคัญ:
// - เลิกใช้ QuickViewConnector (ลิ้นชักสรุปย่อ) -> เปลี่ยนเป็น JobQuickViewProvider
// - เวลา "คลิกการ์ด" จะเรียก openJob({ rid, ... }) เพื่อเปิดลิ้นชักตัวใหม่
//   ที่จะไปโหลดข้อมูลจริงจากปลายทางเดียวกับ PermitDetails และแสดง 3 กล่อง
// - ไม่แตะส่วนเช็คอิน/เอาต์เดิม (Modal เดิมทำงานเหมือนเดิม)
// ======================================================================

import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PersonIcon from "@mui/icons-material/Person";

// โมดัลเช็คอิน/เอาต์ (คงเดิม)
import CheckInModal from "./CheckInModal";
import CheckOutModal from "./CheckOutModal";

// Service เดิม (คงเดิม)
import {
  getDailyWorkByDate,
  checkInRequest,
  checkOutRequest,
  formatTimestamp,
} from "../services/dailyOperationsService";
import type { DailyViewProps } from "../types/dailywork.types";
import type { DailyWorkItem } from "../types/index";

// ★★ ใหม่: ใช้ Provider/Hook ของลิ้นชักตัวใหม่
import JobQuickViewProvider, { useJobQuickView, type JobLite } from "./JobQuickViewProvider";

// ---------- ตัวช่วยเล็ก ๆ ----------
function safeFormatTimestamp(v: any): string {
  try {
    return formatTimestamp(v as any);
  } catch {
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : d.toLocaleString();
    }
    if (v && typeof v._seconds === "number") {
      const d = new Date(v._seconds * 1000);
      return d.toLocaleString();
    }
    return "";
  }
}

// ---------- แปลง WorkItem → DailyWorkItem ให้เข้ารูป ----------
function normalize(item: any): DailyWorkItem {
  return {
    rid: item.rid ?? item.id ?? "",
    contractorName: item.contractorName ?? item.contractor?.name ?? "-",
    permitType: item.permitType ?? item.type ?? "-",
    area: item.area ?? item.location ?? "-",
    startTime: item.startTime ?? item.scheduledStartAt ?? "",
    endTime: item.endTime ?? item.scheduledEndAt ?? "",
    dailyStatus: item.dailyStatus ?? item.status ?? "scheduled",

    checkedInAt: item.checkedInAt ?? item.checkInAt ?? item.checked_in_at ?? undefined,
    checkedOutAt: item.checkedOutAt ?? item.checkOutAt ?? item.checked_out_at ?? undefined,
    checkInNotes: item.checkInNotes ?? item.notesIn ?? item.check_in_notes ?? undefined,
    checkOutNotes: item.checkOutNotes ?? item.notesOut ?? item.check_out_notes ?? undefined,

    workDate: item.workDate ?? item.date ?? undefined,
    status: item.status ?? undefined,
    createdAt: item.createdAt ?? undefined,
    updatedAt: item.updatedAt ?? undefined,
  } as DailyWorkItem;
}

// ฟอร์แมตวันที่ไทยแบบย่อ
function formatThaiDate(d: Date): string {
  try {
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear() + 543;
    return `${dd}/${mm}/${yyyy}`;
  }
}

function mapDailyStatusToQuickView(s: string): string {
  if (s === "checked-in") return "in";
  if (s === "checked-out") return "out";
  return s; // "scheduled"
}

// ---------- แปลง DailyWorkItem → JobLite สำหรับ openJob ----------
function toJobLite(item: DailyWorkItem, date: Date): JobLite {
  const status = mapDailyStatusToQuickView(item.dailyStatus);

  // รวมเวลาไว้ในรูป "HH:MM–HH:MM" เพื่อแสดงหัวลิ้นชัก (ข้อมูลละเอียดจะโหลดเพิ่มเอง)
  const timeRangeText =
    item.startTime && item.endTime
      ? `${item.startTime}–${item.endTime}`
      : item.startTime
      ? `${item.startTime}–`
      : item.endTime
      ? `–${item.endTime}`
      : undefined;

  return {
    rid: item.rid,                             // อย่างน้อยต้องมี rid
    title: item.contractorName || "รายละเอียดใบงาน",
    contractor: item.contractorName,
    area: item.area,
    timeRangeText,
    // สถานะปัจจุบัน (ช่วยให้ลิ้นชักสลับข้อความได้ถูก)
    isIn: status === "in",
  };
}

// ======================================================================
// คอมโพเนนต์หลัก
// ======================================================================
export default function DailyView({ date, onCheckIn, onCheckOut }: DailyViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [works, setWorks] = useState<DailyWorkItem[]>([]);

  // สถานะของโมดัลเช็คอิน/เอาต์ (คงเดิม)
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<DailyWorkItem | null>(null);

  // โหลดข้อมูลเมื่อวันที่เปลี่ยน
  useEffect(() => {
    loadWorks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function loadWorks() {
    setLoading(true);
    setError(null);

    try {
      const dateStr = date.toISOString().split("T")[0];
      const result = await getDailyWorkByDate(dateStr);

      const allWorks: DailyWorkItem[] = [
        ...result.scheduled.map(normalize),
        ...result.checkedIn.map(normalize),
        ...result.checkedOut.map(normalize),
      ];

      setWorks(allWorks);
      console.log(`📅 โหลดข้อมูลวันที่ ${dateStr} สำเร็จ:`, {
        scheduled: result.scheduled.length,
        checkedIn: result.checkedIn.length,
        checkedOut: result.checkedOut.length,
        total: allWorks.length,
      });
    } catch (e: any) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      console.error("❌ Error loading works:", e);
    } finally {
      setLoading(false);
    }
  }

  // เปิดโมดัลเช็คอิน/เอาต์ (คงเดิม)
  const handleCheckInClick = (rid: string) => {
    const work = works.find((w) => w.rid === rid);
    if (work) {
      setSelectedWork(work);
      setCheckInOpen(true);
    }
  };
  const handleCheckInConfirm = async (rid: string, notes: string) => {
    try {
      await checkInRequest(rid, notes);
      await loadWorks();
      setCheckInOpen(false);
      setSelectedWork(null);
      onCheckIn?.(rid);
    } catch (e: any) {
      console.error("❌ Check-in error:", e);
      throw e;
    }
  };

  const handleCheckOutClick = (rid: string) => {
    const work = works.find((w) => w.rid === rid);
    if (work) {
      setSelectedWork(work);
      setCheckOutOpen(true);
    }
  };
  const handleCheckOutConfirm = async (rid: string, notes: string) => {
    try {
      await checkOutRequest(rid, notes);
      await loadWorks();
      setCheckOutOpen(false);
      setSelectedWork(null);
      onCheckOut?.(rid);
    } catch (e: any) {
      console.error("❌ Check-out error:", e);
      throw e;
    }
  };

  const scheduled = works.filter((w) => w.dailyStatus === "scheduled");
  const checkedIn = works.filter((w) => w.dailyStatus === "checked-in");
  const checkedOut = works.filter((w) => w.dailyStatus === "checked-out");

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  // ---------- ส่วนแสดงผล พร้อม "ลิ้นชักใหม่" ----------
  // ใช้ Provider ครอบ แล้วใช้ hook เปิดลิ้นชักจากการ์ด
  return (
    <>
      <JobQuickViewProvider
        // ไม่ส่ง onCheckIn/onCheckOut ลงไป เพื่อให้ลิ้นชักเป็นโหมด "อ่านอย่างเดียว"
        // ปุ่มเช็คอิน/เอาต์ของหน้านี้ยังคงใช้โมดัลเดิมด้านล่าง
      >
        <JobsGridWithQuickView
          date={date}
          scheduled={scheduled}
          checkedIn={checkedIn}
          checkedOut={checkedOut}
          onActionCheckIn={handleCheckInClick}
          onActionCheckOut={handleCheckOutClick}
        />
      </JobQuickViewProvider>

      {/* ========== Modals (คงเดิม) ========== */}
      <CheckInModal
        open={checkInOpen}
        work={selectedWork}
        onClose={() => {
          setCheckInOpen(false);
          setSelectedWork(null);
        }}
        onConfirm={handleCheckInConfirm}
      />

      <CheckOutModal
        open={checkOutOpen}
        work={selectedWork}
        onClose={() => {
          setCheckOutOpen(false);
          setSelectedWork(null);
        }}
        onConfirm={handleCheckOutConfirm}
      />
    </>
  );
}

// ======================================================================
// ส่วนย่อย: เรนเดอร์ 3 คอลัมน์ และเรียก openJob เมื่อคลิกการ์ด
// ======================================================================
function JobsGridWithQuickView(props: {
  date: Date;
  scheduled: DailyWorkItem[];
  checkedIn: DailyWorkItem[];
  checkedOut: DailyWorkItem[];
  onActionCheckIn: (rid: string) => void;
  onActionCheckOut: (rid: string) => void;
}) {
  const { date, scheduled, checkedIn, checkedOut, onActionCheckIn, onActionCheckOut } = props;

  // ★ ได้ตัวช่วยจาก Provider เพื่อเปิดลิ้นชักใหม่
  const { openJob } = useJobQuickView();

  const handleOpen = (item: DailyWorkItem) => {
    // ส่งอย่างน้อย rid; ที่เหลือเป็นข้อมูลย่อช่วยหัวลิ้นชักอ่านง่าย
    const jl = toJobLite(item, date);
    openJob(jl);
  };

  return (
    <Grid container spacing={2}>
      {/* Column 1: จะเข้า */}
      <Grid size={{ xs: 12, md: 4 }}>
        <WorkColumn
          title="🟠 จะเข้า"
          count={scheduled.length}
          color="#ff9800"
          items={scheduled}
          actionLabel="เช็คอิน"
          onAction={onActionCheckIn}
          onOpen={handleOpen}
        />
      </Grid>

      {/* Column 2: เข้าแล้ว */}
      <Grid size={{ xs: 12, md: 4 }}>
        <WorkColumn
          title="🟢 เข้าแล้ว"
          count={checkedIn.length}
          color="#4caf50"
          items={checkedIn}
          actionLabel="เช็คเอาท์"
          onAction={onActionCheckOut}
          onOpen={handleOpen}
        />
      </Grid>

      {/* Column 3: ออกแล้ว */}
      <Grid size={{ xs: 12, md: 4 }}>
        <WorkColumn
          title="🔵 ออกแล้ว"
          count={checkedOut.length}
          color="#2196f3"
          items={checkedOut}
          actionLabel={null}
          onAction={undefined}
          onOpen={handleOpen}
        />
      </Grid>
    </Grid>
  );
}

// ---------- ส่วนประกอบย่อย (คงเดิมเป็นหลัก) ----------
interface WorkColumnProps {
  title: string;
  count: number;
  color: string;
  items: DailyWorkItem[];
  actionLabel: string | null;
  onAction?: (rid: string) => void;
  onOpen: (item: DailyWorkItem) => void; // คลิกการ์ด -> เปิดลิ้นชักใหม่
}

function WorkColumn({ title, count, color, items, actionLabel, onAction, onOpen }: WorkColumnProps) {
  return (
    <Paper sx={{ p: 2, minHeight: 400, bgcolor: "#fafafa" }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Chip label={count} size="small" sx={{ bgcolor: color, color: "#fff", fontWeight: 600 }} />
      </Box>

      {/* Items */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            ไม่มีงาน
          </Typography>
        ) : (
          items.map((item) => (
            <WorkCard
              key={item.rid}
              item={item}
              actionLabel={actionLabel}
              onAction={onAction}
              onOpen={onOpen}
            />
          ))
        )}
      </Box>
    </Paper>
  );
}

interface WorkCardProps {
  item: DailyWorkItem;
  actionLabel: string | null;
  onAction?: (rid: string) => void;
  onOpen: (item: DailyWorkItem) => void;
}

function WorkCard({ item, actionLabel, onAction, onOpen }: WorkCardProps) {
  const getBorderColor = () => {
    switch (item.dailyStatus) {
      case "scheduled":
        return "#ff9800";
      case "checked-in":
        return "#4caf50";
      case "checked-out":
        return "#2196f3";
      default:
        return "#9e9e9e";
    }
  };

  // คลิกการ์ด / กดคีย์ -> เปิดลิ้นชักรายละเอียดจริง
  const handleOpen = () => onOpen(item);
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <Paper
      elevation={2}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      sx={{
        p: 2,
        bgcolor: "#fff",
        borderLeft: 4,
        borderColor: getBorderColor(),
        transition: "transform 0.2s, box-shadow 0.2s",
        cursor: "pointer",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: 4,
        },
        "&:focus-visible": {
          outline: "2px solid #90caf9",
          outlineOffset: "2px",
        },
      }}
    >
      {/* RID */}
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", display: "block" }}>
        {item.rid}
      </Typography>

      {/* ชื่อผู้รับเหมา */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 0.5 }}>
        <PersonIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
        {item.contractorName}
      </Typography>

      {/* ประเภทงาน */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {item.permitType}
      </Typography>

      {/* พื้นที่ */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        <LocationOnIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />
        {item.area}
      </Typography>

      {/* เวลา */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        <AccessTimeIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />
        {item.startTime} - {item.endTime}
      </Typography>

      {/* แสดงเวลาเช็คอิน/เอาต์ถ้ามี */}
      {item.checkedInAt && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "#e8f5e9", borderRadius: 1 }}>
          <Typography variant="caption" color="success.dark" sx={{ display: "block" }}>
            ✅ เช็คอิน: {safeFormatTimestamp(item.checkedInAt)}
          </Typography>
          {item.checkInNotes && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              💬 {item.checkInNotes}
            </Typography>
          )}
        </Box>
      )}

      {item.checkedOutAt && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "#e3f2fd", borderRadius: 1 }}>
          <Typography variant="caption" color="primary.dark" sx={{ display: "block" }}>
            🔵 เช็คเอาท์: {safeFormatTimestamp(item.checkedOutAt)}
          </Typography>
          {item.checkOutNotes && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              💬 {item.checkOutNotes}
            </Typography>
          )}
        </Box>
      )}

      {/* ปุ่มเช็คอิน/เอาต์ ของหน้าหลัก (กันเปิดลิ้นชักซ้อน) */}
      {actionLabel && onAction && (
        <Button
          variant="contained"
          size="small"
          fullWidth
          sx={{ mt: 2 }}
          onClick={(e) => {
            e.stopPropagation(); // กดปุ่มแล้วไม่ให้เปิดลิ้นชัก
            onAction(item.rid);
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Paper>
  );
}
