// ======================================================================
// File: web/src/components/CheckInModal.tsx
// Purpose: Modal สำหรับเช็คอินงาน
// Updated: 2025-10-11 (Task 10: Integration Testing)
// Changes:
//  - แก้ Thai encoding ให้ถูกต้อง
//  - เพิ่ม TypeScript types
//  - ปรับปรุง UI/UX
//  - เพิ่ม error handling
// ======================================================================

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Divider
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

// ★ นำเข้า Types
import type { CheckInModalProps } from "../types/dailywork.types";

export default function CheckInModal({ 
  open, 
  work, 
  onClose, 
  onConfirm 
}: CheckInModalProps) {
  // ========== State Management ==========
  
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ========== Reset Form ==========
  
  useEffect(() => {
    if (open) {
      setNotes("");
      setError(null);
    }
  }, [open]);

  // ========== Handlers ==========
  
  const handleConfirm = async () => {
    if (!work) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await onConfirm(work.rid, notes);
      // Modal จะปิดจาก parent component
    } catch (e: any) {
      setError(e?.message || "เช็คอินไม่สำเร็จ");
      console.error("Check-in error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleConfirm();
    }
  };

  // ========== Current Time ==========
  
  const now = new Date().toLocaleString("th-TH", { 
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  // ========== Render ==========
  
  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="checkin-modal-title"
    >
      <DialogTitle id="checkin-modal-title">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CheckCircleOutlineIcon color="success" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            เช็คอิน
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {work && (
          <>
            {/* ========== Work Information ========== */}
            <Box sx={{ mb: 3 }}>
              {/* RID */}
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ fontFamily: "monospace", display: "block", mb: 1 }}
              >
                ใบอนุญาต: {work.rid}
              </Typography>

              {/* ชื่อผู้รับเหมา */}
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                <PersonIcon sx={{ fontSize: 18, mr: 0.5, verticalAlign: "middle" }} />
                {work.contractorName}
              </Typography>

              {/* ประเภทงาน */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                <strong>ประเภท:</strong> {work.permitType}
              </Typography>

              {/* พื้นที่ */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                <LocationOnIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                <strong>พื้นที่:</strong> {work.area}
              </Typography>

              {/* เวลา */}
              <Typography variant="body2" color="text.secondary">
                <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                <strong>เวลาที่กำหนด:</strong> {work.startTime} - {work.endTime}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* ========== Notes Input ========== */}
            <TextField
              label="📝 หมายเหตุ"
              placeholder="เช่น มาไม่ครบ 3 คน, ไม่สวม PPE ครบ"
              multiline
              rows={3}
              fullWidth
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              helperText="กด Ctrl+Enter เพื่อยืนยันเช็คอิน"
              sx={{ mb: 2 }}
              inputProps={{
                maxLength: 500,
                "aria-label": "หมายเหตุการเช็คอิน"
              }}
            />

            {/* ========== Check-in Time ========== */}
            <Box sx={{ 
              p: 2, 
              bgcolor: "#e8f5e9", 
              borderRadius: 1,
              border: 1,
              borderColor: "success.light"
            }}>
              <Typography 
                variant="body2" 
                color="success.dark" 
                sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}
              >
                <AccessTimeIcon fontSize="small" />
                เวลาเช็คอิน: {now}
              </Typography>
            </Box>

            {/* ========== Error Message ========== */}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={handleClose}
          disabled={loading}
          color="inherit"
        >
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleConfirm}
          disabled={loading || !work}
          startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleOutlineIcon />}
        >
          {loading ? "กำลังบันทึก..." : "✅ ยืนยันเช็คอิน"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
