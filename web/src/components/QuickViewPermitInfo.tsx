// ======================================================================
// File: web/src/components/QuickViewPermitInfo.tsx
// เวอร์ชัน: 2025-10-22 18:xx Asia/Bangkok
// สรุป: คอนเทนต์ "อ่านเร็ว" สำหรับใบงานใน Quick View Drawer
// - แสดงหัวเรื่อง (RID/หัวข้อ) + หัวข้อย่อย (ผู้รับเหมา/พื้นที่/เวลา)
// - แถบสถานะ + ตัวเลขสรุป (ตามแผน/เข้าแล้ว/ออกแล้ว)
// - รายการข้อมูลเสริม (meta) และบันทึกสั้น ๆ (notes) ถ้ามี
// - โครงนี้ตั้งใจให้ "กวาดตาแล้วเข้าใจทันที" และเป็นรองจากหน้าหลัก
//   ตามแนวทาง side sheet / progressive disclosure
// ======================================================================

import * as React from "react";
import {
  Box,
  Stack,
  Typography,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";

import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";

export interface QuickViewPermitInfoProps {
  // หัวเรื่อง
  rid?: string;                  // เช่น "WP-20251022-XXXX"
  title?: string;                // ชื่อ/หัวข้อใบงาน (optional)

  // หัวข้อย่อย
  contractorName?: string;       // ผู้รับเหมา
  location?: string;             // พื้นที่/อาคาร/ชั้น
  schedule?: {
    dateText?: string;           // เช่น "22 ต.ค. 2568"
    startTime?: string;          // เช่น "08:00"
    endTime?: string;            // เช่น "17:00"
    timezoneNote?: string;       // note โซนเวลา (ถ้าต้องการ)
  };

  // สถานะและตัวเลขสรุป
  status?: "scheduled" | "in" | "out" | "closed" | string;
  counts?: {
    scheduled?: number;
    checkedIn?: number;
    checkedOut?: number;
  };

  // ป้ายสั้น ๆ เพิ่มเติม (เช่น "งานด่วน", "มีเอกสารแนบ")
  badges?: string[];

  // meta เสริม (กุญแจ → ค่า) เช่น { "ผู้ควบคุมงาน": "คุณ A", "แผนก": "Facility" }
  meta?: Record<string, string | number | undefined>;

  // บันทึก/หมายเหตุสั้น ๆ
  notes?: string;
}

function statusChip(status?: string) {
  const map: Record<
    string,
    { label: string; color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" }
  > = {
    scheduled: { label: "จะเข้า", color: "warning" },
    in: { label: "เข้าแล้ว", color: "success" },
    out: { label: "ออกแล้ว", color: "info" },
    closed: { label: "ปิดงาน", color: "default" },
  };

  const cfg = (status && map[status]) || { label: status || "—", color: "default" as const };
  return <Chip size="small" label={cfg.label} color={cfg.color} />;
}

export default function QuickViewPermitInfo(props: QuickViewPermitInfoProps) {
  const {
    rid,
    title,
    contractorName,
    location,
    schedule,
    status,
    counts,
    badges,
    meta,
    notes,
  } = props;

  const timeText =
    schedule?.startTime && schedule?.endTime
      ? `${schedule.startTime}–${schedule.endTime}`
      : schedule?.startTime
      ? `${schedule.startTime}–`
      : schedule?.endTime
      ? `–${schedule.endTime}`
      : undefined;

  return (
    <Stack spacing={1.5} sx={{ minHeight: 0 }}>
      {/* หัวเรื่อง */}
      <Stack spacing={0.25}>
        {rid ? (
          <Typography variant="overline" sx={{ opacity: 0.8 }}>
            {rid}
          </Typography>
        ) : null}
        <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
          {title || "รายละเอียดใบงาน"}
        </Typography>
      </Stack>

      {/* แถบป้ายสถานะ + ป้ายอื่น ๆ */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {statusChip(status)}
        {badges?.map((b, i) => (
          <Chip key={i} size="small" variant="outlined" label={b} />
        ))}
      </Stack>

      <Divider />

      {/* หัวข้อย่อยสำคัญ: ผู้รับเหมา / พื้นที่ / เวลา */}
      <List dense disablePadding>
        {contractorName ? (
          <ListItem disableGutters sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 34 }}>
              <PersonOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2">{contractorName}</Typography>}
              secondary={<Typography variant="caption" color="text.secondary">ผู้รับเหมา</Typography>}
            />
          </ListItem>
        ) : null}

        {location ? (
          <ListItem disableGutters sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 34 }}>
              <PlaceOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2">{location}</Typography>}
              secondary={<Typography variant="caption" color="text.secondary">พื้นที่</Typography>}
            />
          </ListItem>
        ) : null}

        {schedule?.dateText || timeText ? (
          <ListItem disableGutters sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 34 }}>
              <AccessTimeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2">
                  {schedule?.dateText}
                  {schedule?.dateText && timeText ? " • " : ""}
                  {timeText}
                </Typography>
              }
              secondary={
                schedule?.timezoneNote ? (
                  <Typography variant="caption" color="text.secondary">
                    {schedule.timezoneNote}
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    กำหนดการ
                  </Typography>
                )
              }
            />
          </ListItem>
        ) : null}
      </List>

      {/* ตัวเลขสรุป (ตามแผน/เข้าแล้ว/ออกแล้ว) */}
      {counts ? (
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Tooltip title="จำนวนตามแผน">
            <Chip
              icon={<WorkOutlineIcon />}
              label={`แผน ${counts.scheduled ?? 0}`}
              size="small"
              variant="outlined"
            />
          </Tooltip>
          <Tooltip title="เช็คอินแล้ว">
            <Chip
              icon={<PeopleAltOutlinedIcon />}
              label={`เข้าแล้ว ${counts.checkedIn ?? 0}`}
              size="small"
              color="success"
              variant="outlined"
            />
          </Tooltip>
          <Tooltip title="เช็คเอาต์แล้ว">
            <Chip
              icon={<PeopleAltOutlinedIcon />}
              label={`ออกแล้ว ${counts.checkedOut ?? 0}`}
              size="small"
              color="info"
              variant="outlined"
            />
          </Tooltip>
        </Stack>
      ) : null}

      {/* meta เสริม */}
      {meta && Object.keys(meta).length > 0 ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={0.75}>
            {Object.entries(meta).map(([k, v]) => (
              <Stack key={k} direction="row" gap={1} sx={{ "& > *:first-of-type": { width: 120, color: "text.secondary" } }}>
                <Typography variant="caption">{k}</Typography>
                <Typography variant="caption">{String(v ?? "—")}</Typography>
              </Stack>
            ))}
          </Stack>
        </>
      ) : null}

      {/* บันทึก/หมายเหตุ */}
      {notes ? (
        <>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              หมายเหตุ
            </Typography>
            <Typography variant="body2">{notes}</Typography>
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
