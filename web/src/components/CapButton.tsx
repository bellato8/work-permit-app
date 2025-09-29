// ======================================================================
// File: src/components/CapButton.tsx
// เวอร์ชัน: 2025-09-18 01:40 (Asia/Bangkok)
// หน้าที่: ปุ่ม MUI ที่มีด่านตรวจสิทธิ์ในตัว (cap/anyOf/allOf) ใช้แทน <Button />
// เชื่อม auth ผ่าน "อะแดปเตอร์": ../hooks/useAuthzLive (อ่าน role/caps สด)
// หมายเหตุ: ไม่มีสิทธิ์ -> disabled + tooltip หรือซ่อนเลยด้วย hideIfDenied
// ======================================================================

import React from "react";
import { Button, ButtonProps, Tooltip } from "@mui/material";
import useAuthzLive from "../hooks/useAuthzLive";
import { hasCap, hasAnyCap, hasAllCaps, isSuperadmin } from "../lib/hasCap";

type GuardProps = {
  cap?: string;
  anyOf?: string[];
  allOf?: string[];
  /** ถ้าไม่มีสิทธิ์ ให้ซ่อนทั้งปุ่มเลย (default = false) */
  hideIfDenied?: boolean;
  /** ข้อความ tooltip ตอนถูกปิดสิทธิ์ */
  deniedText?: React.ReactNode;
};

type CapButtonProps = ButtonProps & GuardProps;

export default function CapButton({
  cap,
  anyOf,
  allOf,
  hideIfDenied = false,
  deniedText = "ไม่มีสิทธิ์ (No permission)",
  children,
  ...btnProps
}: CapButtonProps) {
  const { role, caps } = useAuthzLive() ?? {};
  const allowed =
    isSuperadmin(role) ||
    (!!cap && hasCap(caps, cap, role)) ||
    (!!anyOf && anyOf.length > 0 && hasAnyCap(caps, anyOf, role)) ||
    (!!allOf && allOf.length > 0 && hasAllCaps(caps, allOf, role));

  if (allowed) {
    return <Button {...btnProps}>{children}</Button>;
  }

  if (hideIfDenied) return null;

  // หมายเหตุ: ต้องห่อ Button ที่ disabled ด้วย <span> เพื่อให้ Tooltip ทำงาน
  return (
    <Tooltip title={deniedText}>
      <span>
        <Button {...btnProps} disabled>
          {children}
        </Button>
      </span>
    </Tooltip>
  );
}
