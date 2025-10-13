// ======================================================================
// File: web/src/pages/admin/DailyOperations.tsx
// Purpose: หน้าจัดการงานประจำวัน (Daily Work Management)
// Updated: 2025-10-11 (Task 10: Integration Testing)
// Changes:
//  - แก้ Thai encoding ให้ถูกต้อง
//  - เพิ่ม TypeScript types
//  - ปรับปรุง imports
//  - เพิ่ม error handling
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

// ★ นำเข้า Components (ไม่มี folder daily/)
import DailyView from "../../components/DailyView";
import CalendarView from "../../components/CalendarView";

// ★ นำเข้า Types
import type { ViewMode } from "../../types/dailywork.types";

export default function DailyOperations() {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedDate, setSelectedDate] = useState(new Date());

  // ========== Date Navigation Handlers ==========
  
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

  // ========== Formatting ==========
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ========== Event Handlers ==========
  
  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const handleCheckIn = (rid: string) => {
    console.log("✅ Check In from DailyOperations:", rid);
    // TODO: Phase 2 - เชื่อม API
  };

  const handleCheckOut = (rid: string) => {
    console.log("🚪 Check Out from DailyOperations:", rid);
    // TODO: Phase 2 - เชื่อม API
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setViewMode("daily");
  };

  // ========== Render ==========
  
  return (
    <Box sx={{ p: 3 }}>
      {/* ========== Header ========== */}
      <Box 
        sx={{ 
          mb: 3, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          งานประจำวัน
        </Typography>

        {/* Toggle View Mode */}
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

      {/* ========== Date Navigator (แสดงเฉพาะโหมดรายวัน) ========== */}
      {viewMode === "daily" && (
        <Box 
          sx={{ 
            mb: 3, 
            display: "flex", 
            alignItems: "center", 
            gap: 2,
            flexWrap: "wrap"
          }}
        >
          <IconButton 
            onClick={handlePrevDay} 
            size="small"
            aria-label="วันก่อนหน้า"
          >
            <ArrowBackIosNewIcon />
          </IconButton>

          <Typography 
            variant="h6" 
            sx={{ 
              minWidth: 200, 
              textAlign: "center",
              fontWeight: 500
            }}
          >
            📅 {formatDate(selectedDate)}
          </Typography>

          <IconButton 
            onClick={handleNextDay} 
            size="small"
            aria-label="วันถัดไป"
          >
            <ArrowForwardIosIcon />
          </IconButton>

          <IconButton 
            onClick={handleToday} 
            size="small" 
            color="primary"
            aria-label="กลับไปวันนี้"
          >
            <TodayIcon />
          </IconButton>
        </Box>
      )}

      {/* ========== Content Area ========== */}
      <Box sx={{ mt: 3 }}>
        {viewMode === "daily" ? (
          <DailyView 
            date={selectedDate}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
          />
        ) : (
          <CalendarView 
            onDateClick={handleDateClick}
          />
        )}
      </Box>
    </Box>
  );
}
