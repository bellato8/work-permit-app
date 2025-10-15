// ======================================================================
// File: web/src/components/PermissionCheckboxGroup.tsx
// Purpose: Component สำหรับแสดง Checkbox Group ของสิทธิ์แต่ละหน้า
// Updated: 2025-10-14 — แก้ IconType และ label indexing ให้ถูกชนิด
// ======================================================================

import React from "react";
import {
  Box,
  Paper,
  Typography,
  FormControlLabel,
  Checkbox,
  Collapse
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { PAGE_NAMES, PAGE_ICONS, PERMISSION_LABELS } from "../constants/permissions";
import { PageKey } from "../types/permissions";

type Props = {
  page: PageKey;
  permissions: Record<string, boolean>;
  onChange: (permissionKey: string, value: boolean) => void;
  disabled?: boolean;
};

export default function PermissionCheckboxGroup({
  page,
  permissions,
  onChange,
  disabled = false
}: Props) {
  const [expanded, setExpanded] = React.useState(true);

  // รายชื่อคีย์สิทธิ์ของหน้านี้
  const permissionKeys = Object.keys(permissions);

  // master checkbox
  const canView = permissions.canView === true;

  // ---- (1) ทำ icon ให้เป็น React element เสมอ (รองรับทั้ง IconType และ ReactNode) ----
  const iconValue = (PAGE_ICONS as any)[page];
  const iconEl = React.isValidElement(iconValue)
    ? iconValue
    : (iconValue
        ? React.createElement(iconValue as React.ComponentType<any>, { fontSize: "small" })
        : null);

  // ---- (2) ดึง label ให้ถูกมิติ: page -> key (fallback เป็น flat map -> key) ----
  const getLabel = (k: string): string => {
    const anyLabels = PERMISSION_LABELS as any;
    return anyLabels?.[page]?.[k] ?? anyLabels?.[k] ?? k;
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        mb: 2,
        border: canView ? "2px solid #4caf50" : "1px solid #e0e0e0",
        opacity: disabled ? 0.6 : 1
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          mb: 1
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="h6"
            component="div"
            sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}
          >
            {iconEl}
            {PAGE_NAMES[page]}
          </Typography>

          {canView && (
            <Typography
              variant="caption"
              sx={{
                bgcolor: "success.light",
                color: "success.contrastText",
                px: 1,
                py: 0.5,
                borderRadius: 1
              }}
            >
              เปิดใช้งาน
            </Typography>
          )}
        </Box>

        <ExpandMoreIcon
          sx={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s"
          }}
        />
      </Box>

      {/* Checkboxes Section */}
      <Collapse in={expanded}>
        <Box sx={{ pl: 2 }}>
          {permissionKeys.map((key) => {
            const isMainPermission = key === "canView";
            const value = permissions[key] === true;

            return (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={value}
                    onChange={(e) => onChange(key, e.target.checked)}
                    disabled={disabled || (!canView && !isMainPermission)}
                  />
                }
                label={
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: isMainPermission ? 600 : 400,
                      color: isMainPermission ? "primary.main" : "text.primary"
                    }}
                  >
                    {getLabel(key)}
                  </Typography>
                }
                sx={{ display: "block", mb: 0.5 }}
              />
            );
          })}
        </Box>
      </Collapse>
    </Paper>
  );
}
