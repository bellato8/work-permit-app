// ======================================================================
// File: web/src/components/RequireCap.tsx
// เวอร์ชัน: 2025-09-17 23:00 (Asia/Bangkok)
// หน้าที่: คอมโพเนนต์ด่านตรวจสิทธิ์ (UI Guard) เพื่อซ่อน/แสดงเมนูหรือปุ่มตาม role/caps
// เชื่อม auth ผ่าน "อะแดปเตอร์": ./lib/auth (ถ้ามี) — ส่ง role/caps เข้ามาเองจาก useAuthzLive
// หมายเหตุ: รองรับ prop cap / anyOf / allOf + fallback (แสดงแทนเมื่อไม่มีสิทธิ์)
// ======================================================================

import React from "react";
import {
  CapInput,
  hasCap,
  hasAnyCap,
  hasAllCaps,
  isSuperadmin,
} from "../lib/hasCap";

type RequireCapProps = {
  role?: string | null;
  caps?: CapInput;
  /** ต้องมีสิทธิ์ตัวนี้ตัวเดียวก็พอ */
  cap?: string;
  /** มีสักสิทธิ์ในนี้ก็พอ */
  anyOf?: string[];
  /** ต้องมีครบทุกสิทธิ์ในนี้ */
  allOf?: string[];
  /** จะแสดงอะไรแทน ถ้าไม่มีสิทธิ์ (เช่น ปุ่มเทา/ข้อความ) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

function isAllowed(p: RequireCapProps): boolean {
  // superadmin ผ่านหมด
  if (isSuperadmin(p.role)) return true;

  if (p.cap) return hasCap(p.caps, p.cap, p.role);
  if (p.anyOf && p.anyOf.length > 0) return hasAnyCap(p.caps, p.anyOf, p.role);
  if (p.allOf && p.allOf.length > 0) return hasAllCaps(p.caps, p.allOf, p.role);

  // ถ้าไม่ระบุ cap/anyOf/allOf ให้ถือว่า "ไม่อนุญาต" เพื่อลดความเสี่ยง
  return false;
}

export default function RequireCap(props: RequireCapProps) {
  const ok = isAllowed(props);
  if (!ok) return <>{props.fallback ?? null}</>;
  return <>{props.children}</>;
}

/** ป้ายสำเร็จรูปเมื่อไม่มีสิทธิ์ */
export function NoPermissionBadge({
  text = "ไม่มีสิทธิ์ (No permission)",
}: {
  text?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-gray-200 bg-gray-100 text-gray-600">
      {text}
    </span>
  );
}
