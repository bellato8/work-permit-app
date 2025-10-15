// ======================================================================
// File: web/src/constants/permissions.ts
// Purpose: ค่ากลางสำหรับ UI ของระบบสิทธิ์ (ชื่อหน้า, ไอคอน, ป้ายสิทธิ์)
// Created: 2025-10-14
// Notes:
//  - รวมทุกอย่างไว้ที่เดียว เพื่อลดงานซ้ำและสะกดไม่ตรงกัน
//  - ใช้ร่วมกับชนิดข้อมูลจาก web/src/types/permissions.ts
//  - เวอร์ชันนี้ย้ายมาใช้ react-icons (ชุด Material Design: md)
// ======================================================================

import type { PageKey } from "../types/permissions";

// ไอคอนจาก react-icons (Material Design set: md)
// อ้างอิง: https://react-icons.github.io/react-icons/  • วิธี import รายชุด: react-icons/md
// Type ของไอคอน: IconType
import type { IconType } from "react-icons";
import {
  MdDashboard,
  MdFactCheck,
  MdAssignment,
  MdToday,
  MdBarChart,
  MdGroup,
  MdListAlt,
  MdDeleteSweep,
  MdSettings,
} from "react-icons/md";

/** 1) ชื่อไทยของแต่ละหน้า (โชว์ในเมนู/หัวข้อหน้า) */
export const PAGE_NAMES: Record<PageKey, string> = {
  dashboard: "แดชบอร์ด",
  approvals: "อนุมัติ",
  permits: "ใบงาน",
  dailyWork: "งานประจำวัน",
  reports: "รายงาน",
  users: "ผู้ใช้",
  logs: "บันทึกระบบ",
  cleanup: "ล้างข้อมูล",
  settings: "ตั้งค่า",
} as const;

/** ลำดับเมนู (ใช้ควบคุมการเรียงใน Sidebar/TopNav) */
export const ORDERED_PAGES: PageKey[] = [
  "dashboard",
  "approvals",
  "permits",
  "dailyWork",
  "reports",
  "users",
  "logs",
  "cleanup",
  "settings",
];

/** 2) ไอคอนของแต่ละหน้า (react-icons) */
export const PAGE_ICONS: Record<PageKey, IconType> = {
  dashboard: MdDashboard,
  approvals: MdFactCheck,
  permits: MdAssignment,
  dailyWork: MdToday,
  reports: MdBarChart,
  users: MdGroup,
  logs: MdListAlt,
  cleanup: MdDeleteSweep,
  settings: MdSettings,
} as const;

/** 3) ป้ายข้อความของสิทธิ์ย่อยแต่ละหน้า (ใช้ทำสวิตช์/เช็กบ็อกซ์/คำอธิบาย) */
export const PERMISSION_LABELS = {
  dashboard: {
    canView: "ดูแดชบอร์ด",
  },
  approvals: {
    canView: "ดูรายการ",
    canViewDetails: "ดูรายละเอียด",
    canApprove: "อนุมัติ",
    canReject: "ปฏิเสธ",
    canExport: "ส่งออก",
  },
  permits: {
    canView: "ดูรายการ",
    canViewDetails: "ดูรายละเอียด",
    canExport: "ส่งออก",
  },
  dailyWork: {
    canView: "เข้าหน้างานประจำวัน",
    canCheckIn: "เช็คอิน",
    canCheckOut: "เช็คเอาท์",
    canViewOtherDays: "ดูวันอื่นได้",
  },
  reports: {
    canView: "ดูรายงาน",
    canExport: "ส่งออก",
  },
  users: {
    canView: "เข้าหน้าผู้ใช้",
    canEdit: "แก้ไขผู้ใช้",
    canAdd: "เพิ่มผู้ใช้",
    canDelete: "ลบผู้ใช้",
    canInvite: "เชิญผู้ใช้",
  },
  logs: {
    canView: "ดูบันทึกระบบ",
  },
  cleanup: {
    canView: "เข้าหน้าล้างข้อมูล",
    canDelete: "ลบข้อมูล",
  },
  settings: {
    canView: "เข้าหน้าตั้งค่า",
    canEdit: "แก้ไขตั้งค่า",
  },
} as const;

/** ชนิดสำหรับผู้ใช้ภายในไฟล์อื่น หากต้องการอ้างถึงโครงสร้างป้ายสิทธิ์ */
export type PermissionLabels = typeof PERMISSION_LABELS;

/** (ไม่บังคับ) คำอธิบายสั้น ๆ ของแต่ละหน้า — สำหรับ tooltip/ช่วยจำ */
export const PAGE_DESCRIPTIONS: Record<PageKey, string> = {
  dashboard: "ภาพรวมตัวเลขและสถานะโดยย่อ",
  approvals: "จัดการคำขอที่ต้องตรวจและอนุมัติ",
  permits: "รายการใบงานทั้งหมดและรายละเอียด",
  dailyWork: "บันทึกเช็คอิน/เช็คเอาท์ของงานประจำวัน",
  reports: "สรุปผลและรายงานต่าง ๆ",
  users: "จัดการผู้ใช้และสิทธิ์การเข้าถึง",
  logs: "ประวัติการใช้งานและเหตุการณ์ในระบบ",
  cleanup: "เครื่องมือจัดการข้อมูลทดสอบ/เก่า",
  settings: "ตั้งค่าระบบและค่าทั่วไป",
} as const;
