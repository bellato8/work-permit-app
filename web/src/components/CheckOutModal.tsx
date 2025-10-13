// ======================================================================
// File: web/src/components/CheckOutModal.tsx
// Purpose: Modal สำหรับเช็คเอาท์งาน
// Updated: 2025-10-11 (Task 10: Integration Testing)
// Changes:
//  - แก้ Thai encoding ให้ถูกต้อง
//  - เพิ่ม TypeScript types
//  - แสดงข้อมูลเช็คอิน
//  - ปรับปรุง UI/UX
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
  Chip,
  Divider
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonIcon from "@mui/icons-material/Person";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LogoutIcon from "@mui/icons-material/Logout";

// ★ นำเข้า Types
import type { CheckOutModalProps } from "../types/dailywork.types";

export default function CheckOutModal({ 
  open, 
  work, 
  onClose, 
  onConfirm 
}: CheckOutModalProps) {
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
      setError(e?.message || "เช็คเอาท์ไม่สำเร็จ");
      console.error("Check-out error:", e);
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

  // ========== Format Check-in Time ==========
  
  const formatCheckInTime = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      return new Date(isoString).toLocaleString("th-TH", {
        hour12: false,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "—";
    }
  };

  // ========== Render ==========
  
  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="checkout-modal-title"
    >
      <DialogTitle id="checkout-modal-title">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LogoutIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            เช็คเอาท์
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
              <Typography variant="body2" color="text.secondary">
                <LocationOnIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: "middle" }} />
                <strong>พื้นที่:</strong> {work.area}
              </Typography>
            </Box>

            {/* ========== Check-in Information ========== */}
            <Box sx={{ 
              mb: 3,
              p: 2, 
              bgcolor: "#e8f5e9", 
              borderRadius: 1,
              border: 1,
              borderColor: "success.light"
            }}>
              <Typography 
                variant="body2" 
                color="success.dark" 
                sx={{ fontWeight: 600, mb: 1, display: "flex", alignItems: "center", gap: 1 }}
              >
                <CheckCircleIcon fontSize="small" />
                เช็คอินแล้ว
              </Typography>
              
              {work.checkedInAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  <AccessTimeIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: "middle" }} />
                  เวลาเช็คอิน: {formatCheckInTime(work.checkedInAt)}
                </Typography>
              )}

              {work.checkInNotes && (
                <Box sx={{ mt: 1 }}>
                  <Chip 
                    label={`หมายเหตุ: ${work.checkInNotes}`}
                    size="small"
                    sx={{ 
                      bgcolor: "#fff", 
                      fontSize: 11,
                      maxWidth: "100%",
                      height: "auto",
                      "& .MuiChip-label": {
                        whiteSpace: "normal",
                        padding: "4px 8px"
                      }
                    }}
                  />
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* ========== Notes Input ========== */}
            <TextField
              label="📝 หมายเหตุเช็คเอาท์"
              placeholder="เช่น ผิดระเบียบ, ทำงานไม่เสร็จ, ทำงานเสร็จเรียบร้อย"
              multiline
              rows={3}
              fullWidth
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              helperText="กด Ctrl+Enter เพื่อยืนยันเช็คเอาท์"
              sx={{ mb: 2 }}
              inputProps={{
                maxLength: 500,
                "aria-label": "หมายเหตุการเช็คเอาท์"
              }}
            />

            {/* ========== Check-out Time ========== */}
            <Box sx={{ 
              p: 2, 
              bgcolor: "#e3f2fd", 
              borderRadius: 1,
              border: 1,
              borderColor: "primary.light"
            }}>
              <Typography 
                variant="body2" 
                color="primary.main" 
                sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}
              >
                <AccessTimeIcon fontSize="small" />
                เวลาเช็คเอาท์: {now}
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
          color="primary"
          onClick={handleConfirm}
          disabled={loading || !work}
          startIcon={loading ? <CircularProgress size={20} /> : <LogoutIcon />}
        >
          {loading ? "กำลังบันทึก..." : "🔵 ยืนยันเช็คเอาท์"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
