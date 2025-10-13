// ======================================================================
// File: web/src/components/CalendarView.tsx
// Purpose: แสดงงานประจำวันในรูปแบบปฏิทิน (เชื่อม API จริงแล้ว)
// Updated: 2025-10-13 (Task 19 Complete)
// Changes:
//  - ✅ แทนที่ Mock Data ด้วย getCalendarView() API
//  - ✅ แก้การแปลง month: JS (0-11) → API (1-12)
//  - ✅ เพิ่ม Retry button เมื่อ error
//  - ✅ รักษารูปแบบ UI เดิมทั้งหมด
// ======================================================================

import { useState, useEffect, useMemo } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  IconButton,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Button
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import type { CalendarViewProps } from "../types/dailywork.types";
import type { CalendarDayData } from "../types/index";
import { getCalendarView } from "../services/dailyOperationsService";

// 0 = อาทิตย์ขึ้นก่อน, 1 = จันทร์ขึ้นก่อน  (ตอนนี้ UI หัวคอลัมน์เป็น "อา จ อ พ พฤ ศ ส" จึงตั้ง 0)
const WEEK_STARTS_ON: 0 | 1 = 0;

// หัวตารางวันแบบยืดหยุ่น
const DAY_NAMES_SUN_FIRST = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;
const DAY_NAMES_MON_FIRST = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"] as const;

// helper: pad 2 หลัก
const pad2 = (n: number) => String(n).padStart(2, "0");

// helper: คืน "YYYY-MM-DD" ด้วยเวลาท้องถิ่น (หลีกเลี่ยง toISOString ซึ่งเป็น UTC เสมอ)
function ymdLocal(y: number, mZeroBase: number, d: number) {
  return `${y}-${pad2(mZeroBase + 1)}-${pad2(d)}`;
}

export default function CalendarView({ onDateClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daysData, setDaysData] = useState<CalendarDayData[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ชื่อเดือนแบบไทย + ปี พ.ศ.
  const monthName = useMemo(() => {
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      year: "numeric",
      month: "long",
    }).format(currentDate);
  }, [currentDate]);

  useEffect(() => {
    loadCalendarData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function loadCalendarData() {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ แปลง JavaScript month (0-11) เป็น API month (1-12)
      const apiMonth = month + 1;
      
      // ✅ เรียก API จริง
      const result = await getCalendarView(year, apiMonth);
      
      // ตั้งค่าข้อมูล
      setDaysData(result.days);
    } catch (e: any) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      setDaysData([]);
      console.error("Error loading calendar data:", e);
    } finally {
      setLoading(false);
    }
  }

  // ========== Navigation ==========
  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // ========== Calendar grid algorithm (ยืดหยุ่นวันเริ่มสัปดาห์) ==========
  // JS getDay(): 0=อาทิตย์..6=เสาร์ (ตาม local time)
  const firstDayRaw = new Date(year, month, 1).getDay();
  // ปรับ offset ให้ตรงกับหัวคอลัมน์ตาม WEEK_STARTS_ON
  // ถ้าเริ่มจันทร์: Monday-first index = (raw + 6) % 7
  const firstDayIndex =
    WEEK_STARTS_ON === 0 ? firstDayRaw : (firstDayRaw + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // สร้างตารางทีละสัปดาห์
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = new Array(firstDayIndex).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  // ========== Data lookup ==========
  const getDataForDate = (day: number): CalendarDayData | null => {
    const dateStr = ymdLocal(year, month, day); // local YYYY-MM-DD
    return daysData.find((d) => d.date === dateStr) || null;
  };

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
        <Button 
          size="small" 
          onClick={loadCalendarData} 
          sx={{ ml: 2 }}
        >
          ลองอีกครั้ง
        </Button>
      </Alert>
    );
  }

  const dayNames =
    WEEK_STARTS_ON === 0 ? DAY_NAMES_SUN_FIRST : DAY_NAMES_MON_FIRST;

  const today = new Date();

  return (
    <Paper sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <IconButton onClick={handlePrevMonth} aria-label="เดือนก่อนหน้า">
          <ArrowBackIosNewIcon />
        </IconButton>

        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {monthName}
        </Typography>

        <IconButton onClick={handleNextMonth} aria-label="เดือนถัดไป">
          <ArrowForwardIosIcon />
        </IconButton>
      </Box>

      {/* Day Names */}
      <Grid container spacing={1} sx={{ mb: 1 }}>
        {dayNames.map((d) => (
          <Grid item xs key={`head-${d}`}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                textAlign: "center",
                fontWeight: 600,
                color: "text.secondary",
              }}
            >
              {d}
            </Typography>
          </Grid>
        ))}
      </Grid>

      {/* Calendar Grid */}
      <Box>
        {weeks.map((week, weekIdx) => (
          <Grid container spacing={1} key={`w-${year}-${month}-${weekIdx}`} sx={{ mb: 1 }}>
            {week.map((day, dayIdx) => {
              if (day === null) {
                return (
                  <Grid item xs key={`empty-${weekIdx}-${dayIdx}`}>
                    <Box sx={{ height: 80 }} />
                  </Grid>
                );
              }

              const data = getDataForDate(day);
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();

              return (
                <Grid item xs key={`d-${year}-${pad2(month + 1)}-${pad2(day)}`}>
                  <Paper
                    elevation={isToday ? 4 : 1}
                    sx={{
                      p: 1,
                      height: 80,
                      cursor: data && data.totalWorks > 0 ? "pointer" : "default",
                      bgcolor: isToday ? "#e3f2fd" : "#fff",
                      border: isToday ? 2 : 0,
                      borderColor: "primary.main",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      "&:hover": data && data.totalWorks > 0
                        ? {
                            bgcolor: "#f5f5f5",
                            transform: "translateY(-2px)",
                            boxShadow: 3,
                          }
                        : {},
                    }}
                    onClick={() => {
                      if (data && data.totalWorks > 0 && onDateClick) {
                        onDateClick(new Date(year, month, day));
                      }
                    }}
                    role={data && data.totalWorks > 0 ? "button" : undefined}
                    tabIndex={data && data.totalWorks > 0 ? 0 : undefined}
                    aria-label={data ? `วันที่ ${day} มี ${data.totalWorks} งาน` : undefined}
                  >
                    <Typography variant="body2" sx={{ fontWeight: isToday ? 700 : 400 }}>
                      {day}
                    </Typography>

                    {data && data.totalWorks > 0 && (
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          label={`${data.totalWorks} งาน`}
                          size="small"
                          color="primary"
                          sx={{ fontSize: 10, height: 20 }}
                        />
                        <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
                          {data.scheduled > 0 && (
                            <Box 
                              sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#ff9800" }} 
                              title={`จะเข้า ${data.scheduled} งาน`} 
                            />
                          )}
                          {data.checkedIn > 0 && (
                            <Box 
                              sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#4caf50" }} 
                              title={`เข้าแล้ว ${data.checkedIn} งาน`} 
                            />
                          )}
                          {data.checkedOut > 0 && (
                            <Box 
                              sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#2196f3" }} 
                              title={`ออกแล้ว ${data.checkedOut} งาน`} 
                            />
                          )}
                        </Box>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        ))}
      </Box>

      {/* Legend */}
      <Box sx={{ mt: 3, display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#ff9800" }} />
          <Typography variant="caption">จะเข้า</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#4caf50" }} />
          <Typography variant="caption">เข้าแล้ว</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#2196f3" }} />
          <Typography variant="caption">ออกแล้ว</Typography>
        </Box>
      </Box>
    </Paper>
  );
}