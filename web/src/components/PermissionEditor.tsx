// ======================================================================
// File: web/src/components/PermissionEditor.tsx
// Purpose: Component หลักสำหรับแก้ไขสิทธิ์ทั้งหมด
// Created: 2025-10-14
// Notes:
//  - ซิงก์ state ภายใน (localPerms) เมื่อเปลี่ยน email/role/currentPermissions หรือเปิด dialog
//    เพื่อให้แก้ผู้ใช้คนใหม่แล้วเห็นค่าปัจจุบันทันที (React Effects แนวซิงก์กับ external state)
//  - Dialog ใช้ fullWidth + maxWidth="md" ตามแนวทาง MUI
// ======================================================================

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Divider
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import PermissionCheckboxGroup from "./PermissionCheckboxGroup";
import { PagePermissions, PageKey } from "../types/permissions";
import { getDefaultPermissions } from "../lib/defaultPermissions";

type Props = {
  open: boolean;
  onClose: () => void;
  email: string;
  role: string; // "viewer" | "approver" | "admin" | "superadmin";
  currentPermissions: PagePermissions;
  onSave: (permissions: PagePermissions) => Promise<void>;
};

export default function PermissionEditor({
  open,
  onClose,
  email,
  role,
  currentPermissions,
  onSave
}: Props) {
  const [localPerms, setLocalPerms] = useState<PagePermissions>(currentPermissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✨ Sync เมื่อเปิด/เปลี่ยน user/role/permissions (อ้างแนวคิด "Synchronizing with Effects")
  useEffect(() => {
    if (open) {
      setLocalPerms(currentPermissions);
    }
  }, [open, email, role, currentPermissions]);

  // รีเซ็ตสิทธิ์กลับไปเป็นค่าเริ่มต้นตาม role
  const handleReset = () => {
    const defaultPerms = getDefaultPermissions(role);
    setLocalPerms(defaultPerms);
  };

  // บันทึก
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(localPerms);
      onClose();
    } catch (err: any) {
      setError(err?.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  // อัพเดทสิทธิ์ของแต่ละหน้า
  const updatePagePermission = (page: PageKey, permKey: string, value: boolean) => {
    setLocalPerms((prev) => ({
      ...prev,
      [page]: {
        ...prev[page],
        [permKey]: value
      } as any
    }));
  };

  const pages: PageKey[] = [
    "dashboard",
    "approvals",
    "permits",
    "dailyWork",
    "reports",
    "users",
    "logs",
    "cleanup",
    "settings"
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { maxHeight: "90vh" } }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6">จัดการสิทธิ์</Typography>
            <Typography variant="body2" color="text.secondary">
              {email}
            </Typography>
          </Box>
          <Chip
            label={role.toUpperCase()}
            color={
              role === "superadmin" ? "error" :
              role === "admin" ? "warning" :
              role === "approver" ? "info" : "default"
            }
            size="small"
          />
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" size="small" onClick={handleReset} disabled={saving}>
            รีเซ็ตเป็นค่าเริ่มต้น ({role})
          </Button>
        </Box>

        {pages.map((page) => (
          <PermissionCheckboxGroup
            key={page}
            page={page}
            permissions={localPerms[page] as Record<string, boolean>}
            onChange={(permKey, value) => updatePagePermission(page, permKey, value)}
            disabled={saving}
          />
        ))}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving} startIcon={<CloseIcon />}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
