// ======================================================================
// File: web/src/pages/admin/DailyOperations.tsx
// หน้าที่: หน้า "งานประจำวัน" ระดับผู้ดูแล
// โครงสร้าง: สลับมุมมอง รายวัน <-> ปฏิทิน + ปุ่มเลื่อนวัน + ส่งต่อวันที่ให้คอมโพเนนต์ลูก
// หมายเหตุสำคัญ:
//  - เช็คอิน/เช็คเอาท์จริง ทำที่ DailyView (ไฟล์ลูก) แล้วค่อยแจ้งกลับมาที่นี่ผ่าน onCheckIn/onCheckOut
//    ตรงนี้ทำหน้าที่ "รับสัญญาณหลังสำเร็จ" (post-success hook) เท่านั้น เพื่อไม่ให้เรียก API ซ้ำซ้อน
//  - ถ้าภายหลังต้องการบันทึก log ฝั่งจอหลัก เช่น toast รวม/รีเฟรชสรุปตัวเลขรวมของหน้า ค่อยมาทำใน handler นี้
// ผู้แก้ไขล่าสุด: ขั้นตอน A4 - เพิ่มคอมเมนต์เพื่อให้ทีมอ่านง่ายขึ้น (ไม่มีการเปลี่ยนพฤติกรรมโค้ด)
// ======================================================================

import { useState } from "react";
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ViewListIcon from "@mui/icons-material/ViewList";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import TodayIcon from "@mui/icons-material/Today";

// ★ คอมโพเนนต์ลูก 2 แบบ: รายวัน / ปฏิทิน
import DailyView from "../../components/DailyView";
import CalendarView from "../../components/CalendarView";

// ★ ประเภทตัวเลือกมุมมอง
import type { ViewMode } from "../../types/dailywork.types";

export default function DailyOperations() {
  // มุมมองปัจจุบัน: "daily" หรือ "calendar"
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  // วันที่ที่กำลังดู (ใช้กับรายวัน และใช้ตัดสินเดือนในปฏิทิน)
  const [selectedDate, setSelectedDate] = useState(new Date());

  // ---------------- ตัวช่วยเลื่อนวัน (เฉพาะโหมดรายวัน) ----------------
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // ---------------- ฟังก์ชันแปลงวันที่ให้แสดงอ่านง่าย ----------------
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ---------------- สลับโหมดแสดงผล ----------------
  const handleViewModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: ViewMode | null
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // ---------------- ฮุกหลังเช็คอิน/เอาท์สำเร็จ ----------------
  // หมายเหตุ: เช็คจริงเรียกใน DailyView แล้ว ที่นี่รับสัญญาณเพื่อทำงานเสริม (เช่น toast / รีเฟรชสรุป)
  const handleCheckIn = (rid: string) => {
    console.log("✅ Check In (post-success hook) @DailyOperations:", rid);
    // ตัวอย่างงานเสริมในอนาคต: refresh ตัวเลขรวม, แจ้งเตือน, เขียน log เพิ่ม
  };

  const handleCheckOut = (rid: string) => {
    console.log("🚪 Check Out (post-success hook) @DailyOperations:", rid);
    // ตัวอย่างงานเสริมในอนาคต: refresh ตัวเลขรวม, แจ้งเตือน, เขียน log เพิ่ม
  };

  // ---------------- รับวันที่จากปฏิทิน แล้วสลับกลับไปโหมดรายวัน ----------------
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setViewMode("daily");
  };

  // ---------------- ส่วนแสดงผล ----------------
  return (
    <Box sx={{ p: 3 }}>
      {/* ส่วนหัวหน้าเพจ */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          งานประจำวัน
        </Typography>

        {/* ปุ่มสลับโหมดแสดงผล */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
          aria-label="เลือกรูปแบบการแสดงผล"
        >
          <ToggleButton value="daily" aria-label="โหมดรายวัน">
            <ViewListIcon sx={{ mr: 1 }} />
            รายวัน
          </ToggleButton>
          <ToggleButton value="calendar" aria-label="โหมดปฏิทิน">
            <CalendarTodayIcon sx={{ mr: 1 }} />
            ปฏิทิน
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* แถบเลื่อนวัน (แสดงเฉพาะโหมดรายวัน) */}
      {viewMode === "daily" && (
        <Box
          sx={{
            mb: 3,
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <IconButton onClick={handlePrevDay} size="small" aria-label="วันก่อนหน้า">
            <ArrowBackIosNewIcon />
          </IconButton>

          <Typography
            variant="h6"
            sx={{
              minWidth: 200,
              textAlign: "center",
              fontWeight: 500,
            }}
          >
            📅 {formatDate(selectedDate)}
          </Typography>

          <IconButton onClick={handleNextDay} size="small" aria-label="วันถัดไป">
            <ArrowForwardIosIcon />
          </IconButton>

          <IconButton onClick={handleToday} size="small" color="primary" aria-label="กลับไปวันนี้">
            <TodayIcon />
          </IconButton>
        </Box>
      )}

      {/* พื้นที่เนื้อหา: สลับคอมโพเนนต์ลูกตามโหมด */}
      <Box sx={{ mt: 3 }}>
        {viewMode === "daily" ? (
          <DailyView date={selectedDate} onCheckIn={handleCheckIn} onCheckOut={handleCheckOut} />
        ) : (
          <CalendarView onDateClick={handleDateClick} />
        )}
      </Box>
    </Box>
  );
}
