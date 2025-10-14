// ======================================================================
// File: web/src/components/DailyView.tsx
// Purpose: แสดงงานประจำวันในรูปแบบ 3 คอลัมน์ (Kanban)
// Updated: 2025-10-13 (Task 18: เชื่อม DailyView กับ API จริง)
// Changes:
//  - แทนที่ Mock Data ด้วย getDailyWorkByDate()
//  - เชื่อม checkInRequest() และ checkOutRequest()
//  - เพิ่มการแสดงเวลา Check-In/Out ใน WorkCard
//  - ใช้ formatTimestamp() สำหรับแสดงเวลา
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

// ★ นำเข้า Modals
import CheckInModal from "./CheckInModal";
import CheckOutModal from "./CheckOutModal";

// ★ นำเข้า Services และ Types
import { 
  getDailyWorkByDate, 
  checkInRequest, 
  checkOutRequest,
  formatTimestamp,
} from "../services/dailyOperationsService";
import type { DailyViewProps } from "../types/dailywork.types";
import type { DailyWorkItem } from "../types/index";

export default function DailyView({ date, onCheckIn, onCheckOut }: DailyViewProps) {
  // ========== State Management ==========
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [works, setWorks] = useState<DailyWorkItem[]>([]);
  
  // Modal states
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<DailyWorkItem | null>(null);

  // ========== Load Data ==========
  
  useEffect(() => {
    loadWorks();
  }, [date]);

  async function loadWorks() {
    setLoading(true);
    setError(null);
    
    try {
      // ✅ เรียก API จริง - แปลงวันที่เป็น format YYYY-MM-DD
      const dateStr = date.toISOString().split("T")[0]; // "2025-10-13"
      
      const result = await getDailyWorkByDate(dateStr);
      
      // รวมข้อมูลทั้ง 3 กลุ่ม: scheduled, checkedIn, checkedOut
      const allWorks: DailyWorkItem[] = [
        ...result.scheduled,
        ...result.checkedIn,
        ...result.checkedOut
      ];
      
      setWorks(allWorks);
      
      console.log(`📅 โหลดข้อมูลวันที่ ${dateStr} สำเร็จ:`, {
        scheduled: result.scheduled.length,
        checkedIn: result.checkedIn.length,
        checkedOut: result.checkedOut.length,
        total: allWorks.length
      });
    } catch (e: any) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      console.error("❌ Error loading works:", e);
    } finally {
      setLoading(false);
    }
  }

  // ========== Modal Handlers ==========
  
  const handleCheckInClick = (rid: string) => {
    const work = works.find(w => w.rid === rid);
    if (work) {
      setSelectedWork(work);
      setCheckInOpen(true);
    }
  };

  const handleCheckInConfirm = async (rid: string, notes: string) => {
    console.log("✅ Check In Request:", { rid, notes, timestamp: new Date().toISOString() });
    
    try {
      // ✅ เรียก API จริง
      await checkInRequest(rid, notes);
      
      console.log("✅ เช็คอินสำเร็จ");
      
      // Reload data เพื่อแสดงข้อมูลใหม่
      await loadWorks();
      
      setCheckInOpen(false);
      setSelectedWork(null);
      
      // Callback to parent
      onCheckIn?.(rid);
    } catch (e: any) {
      console.error("❌ Check-in error:", e);
      throw e; // ส่งต่อให้ Modal แสดง error
    }
  };

  const handleCheckOutClick = (rid: string) => {
    const work = works.find(w => w.rid === rid);
    if (work) {
      setSelectedWork(work);
      setCheckOutOpen(true);
    }
  };

  const handleCheckOutConfirm = async (rid: string, notes: string) => {
    console.log("🚪 Check Out Request:", { rid, notes, timestamp: new Date().toISOString() });
    
    try {
      // ✅ เรียก API จริง
      await checkOutRequest(rid, notes);
      
      console.log("✅ เช็คเอาท์สำเร็จ");
      
      // Reload data เพื่อแสดงข้อมูลใหม่
      await loadWorks();
      
      setCheckOutOpen(false);
      setSelectedWork(null);
      
      // Callback to parent
      onCheckOut?.(rid);
    } catch (e: any) {
      console.error("❌ Check-out error:", e);
      throw e; // ส่งต่อให้ Modal แสดง error
    }
  };

  // ========== Filter by Status ==========
  
  const scheduled = works.filter(w => w.dailyStatus === "scheduled");
  const checkedIn = works.filter(w => w.dailyStatus === "checked-in");
  const checkedOut = works.filter(w => w.dailyStatus === "checked-out");

  // ========== Loading & Error States ==========
  
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

  // ========== Render ==========
  
  return (
    <>
      <Grid container spacing={2}>
        {/* Column 1: จะเข้า */}
        <Grid item xs={12} md={4}>
          <WorkColumn
            title="🟠 จะเข้า"
            count={scheduled.length}
            color="#ff9800"
            items={scheduled}
            actionLabel="เช็คอิน"
            onAction={handleCheckInClick}
          />
        </Grid>

        {/* Column 2: เข้าแล้ว */}
        <Grid item xs={12} md={4}>
          <WorkColumn
            title="🟢 เข้าแล้ว"
            count={checkedIn.length}
            color="#4caf50"
            items={checkedIn}
            actionLabel="เช็คเอาท์"
            onAction={handleCheckOutClick}
          />
        </Grid>

        {/* Column 3: ออกแล้ว */}
        <Grid item xs={12} md={4}>
          <WorkColumn
            title="🔵 ออกแล้ว"
            count={checkedOut.length}
            color="#2196f3"
            items={checkedOut}
            actionLabel={null}
            onAction={undefined}
          />
        </Grid>
      </Grid>

      {/* ========== Modals ========== */}
      
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

// ========== Sub-Components ==========

interface WorkColumnProps {
  title: string;
  count: number;
  color: string;
  items: DailyWorkItem[];
  actionLabel: string | null;
  onAction?: (rid: string) => void;
}

function WorkColumn({ title, count, color, items, actionLabel, onAction }: WorkColumnProps) {
  return (
    <Paper sx={{ p: 2, minHeight: 400, bgcolor: "#fafafa" }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Chip 
          label={count} 
          size="small" 
          sx={{ bgcolor: color, color: "#fff", fontWeight: 600 }} 
        />
      </Box>

      {/* Items */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.length === 0 ? (
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ textAlign: "center", py: 4 }}
          >
            ไม่มีงาน
          </Typography>
        ) : (
          items.map(item => (
            <WorkCard 
              key={item.rid} 
              item={item} 
              actionLabel={actionLabel}
              onAction={onAction}
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
}

function WorkCard({ item, actionLabel, onAction }: WorkCardProps) {
  const getBorderColor = () => {
    switch (item.dailyStatus) {
      case "scheduled": return "#ff9800";
      case "checked-in": return "#4caf50";
      case "checked-out": return "#2196f3";
      default: return "#9e9e9e";
    }
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        bgcolor: "#fff",
        borderLeft: 4,
        borderColor: getBorderColor(),
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: 4
        }
      }}
    >
      {/* RID */}
      <Typography 
        variant="caption" 
        color="text.secondary" 
        sx={{ fontFamily: "monospace", display: "block" }}
      >
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

      {/* 🆕 แสดงเวลาเช็คอิน (ถ้ามี) */}
      {item.checkedInAt && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "#e8f5e9", borderRadius: 1 }}>
          <Typography variant="caption" color="success.dark" sx={{ display: "block" }}>
            ✅ เช็คอิน: {formatTimestamp(item.checkedInAt)}
          </Typography>
          {item.checkInNotes && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              💬 {item.checkInNotes}
            </Typography>
          )}
        </Box>
      )}

      {/* 🆕 แสดงเวลาเช็คเอาท์ (ถ้ามี) */}
      {item.checkedOutAt && (
        <Box sx={{ mt: 1, p: 1, bgcolor: "#e3f2fd", borderRadius: 1 }}>
          <Typography variant="caption" color="primary.dark" sx={{ display: "block" }}>
            🔵 เช็คเอาท์: {formatTimestamp(item.checkedOutAt)}
          </Typography>
          {item.checkOutNotes && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              💬 {item.checkOutNotes}
            </Typography>
          )}
        </Box>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <Button
          variant="contained"
          size="small"
          fullWidth
          sx={{ mt: 2 }}
          onClick={() => onAction(item.rid)}
        >
          {actionLabel}
        </Button>
      )}
    </Paper>
  );
}