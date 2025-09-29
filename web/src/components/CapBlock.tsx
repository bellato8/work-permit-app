// ======================================================================
// File: src/components/CapBlock.tsx
// เวอร์ชัน: 2025-09-18 01:40 (Asia/Bangkok)
// หน้าที่: ห่อบล็อกเนื้อหาให้ตรวจสิทธิ์ก่อนแสดง (ซ่อน/แสดงป้ายไม่มีสิทธิ์)
// เชื่อม auth ผ่าน "อะแดปเตอร์": ../hooks/useAuthzLive
// หมายเหตุ: ใช้ได้กับทั้งส่วน table/card/section ต่าง ๆ ในหน้า Admin
// ======================================================================

import React from "react";
import { Box, Typography } from "@mui/material";
import useAuthzLive from "../hooks/useAuthzLive";
import { hasCap, hasAnyCap, hasAllCaps, isSuperadmin } from "../lib/hasCap";
import { NoPermissionBadge } from "./RequireCap";

type GuardProps = {
  cap?: string;
  anyOf?: string[];
  allOf?: string[];
  /** ซ่อนบล็อกทั้งก้อนเมื่อไม่มีสิทธิ์ (default=false = โชว์ป้าย) */
  hideIfDenied?: boolean;
  /** ข้อความแสดงเมื่อไม่มีสิทธิ์ */
  deniedText?: string;
  children: React.ReactNode;
};

export default function CapBlock({
  cap,
  anyOf,
  allOf,
  hideIfDenied = false,
  deniedText = "คุณไม่มีสิทธิ์ในส่วนนี้",
  children,
}: GuardProps) {
  const { role, caps } = useAuthzLive() ?? {};
  const allowed =
    isSuperadmin(role) ||
    (!!cap && hasCap(caps, cap, role)) ||
    (!!anyOf && anyOf.length > 0 && hasAnyCap(caps, anyOf, role)) ||
    (!!allOf && allOf.length > 0 && hasAllCaps(caps, allOf, role));

  if (allowed) return <>{children}</>;

  if (hideIfDenied) return null;

  return (
    <Box
      sx={{
        border: "1px dashed #e5e7eb",
        borderRadius: 2,
        p: 2,
        bgcolor: "#fafafa",
      }}
    >
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        <NoPermissionBadge />
        <Typography variant="body2">{deniedText}</Typography>
      </Box>
    </Box>
  );
}
