// ======================================================================
// File: web/src/lib/defaultPermissions.ts
// Purpose: กำหนดสิทธิ์เริ่มต้นสำหรับแต่ละ Role (Viewer/Approver/Admin/Super Admin)
// Created: 2025-10-14 (Asia/Bangkok)
// Notes:
//  - ตั้งต้นตามหลัก "ให้น้อยที่สุดเท่าที่จำเป็นต่อการทำงาน" (Least Privilege)
//  - ใช้ควบคู่กับ PagePermissions จาก web/src/types/permissions.ts
// ======================================================================

import { PagePermissions } from "../types/permissions";

/**
 * สิทธิ์เริ่มต้นสำหรับ Viewer
 * - ดูได้บางหน้าเท่านั้น
 * - ไม่มีสิทธิ์กดอนุมัติ/ลบ/แก้ไข
 */
export const VIEWER_DEFAULT: PagePermissions = {
  dashboard: {
    canView: true,
  },
  approvals: {
    canView: true,
    canViewDetails: true,
    canApprove: false,
    canReject: false,
    canExport: false,
  },
  permits: {
    canView: true,
    canViewDetails: true,
    canExport: false,
  },
  dailyWork: {
    canView: false,
    canCheckIn: false,
    canCheckOut: false,
    canViewOtherDays: false,
  },
  reports: {
    canView: false,
    canExport: false,
  },
  users: {
    canView: false,
    canEdit: false,
    canAdd: false,
    canDelete: false,
    canInvite: false,
  },
  logs: {
    canView: false,
  },
  cleanup: {
    canView: false,
    canDelete: false,
  },
  settings: {
    canView: false,
    canEdit: false,
  },
};

/**
 * สิทธิ์เริ่มต้นสำหรับ Approver
 * - เพิ่มจาก Viewer: กดอนุมัติ/ปฏิเสธ, ดูรายงาน, เช็คอิน/เช็คเอาท์
 */
export const APPROVER_DEFAULT: PagePermissions = {
  ...VIEWER_DEFAULT,
  approvals: {
    canView: true,
    canViewDetails: true,
    canApprove: true,
    canReject: true,
    canExport: true,
  },
  permits: {
    canView: true,
    canViewDetails: true,
    canExport: true,
  },
  dailyWork: {
    canView: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewOtherDays: false,
  },
  reports: {
    canView: true,
    canExport: true,
  },
};

/**
 * สิทธิ์เริ่มต้นสำหรับ Admin
 * - เพิ่มจาก Approver: จัดการผู้ใช้ได้ + ดูงานวันอื่นได้
 */
export const ADMIN_DEFAULT: PagePermissions = {
  ...APPROVER_DEFAULT,
  dailyWork: {
    canView: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewOtherDays: true,
  },
  users: {
    canView: true,
    canEdit: true,
    canAdd: true,
    canDelete: false,
    canInvite: true,
  },
};

/**
 * สิทธิ์เริ่มต้นสำหรับ Super Admin
 * - ทำได้ทุกอย่าง
 */
export const SUPERADMIN_DEFAULT: PagePermissions = {
  dashboard: { canView: true },
  approvals: {
    canView: true,
    canViewDetails: true,
    canApprove: true,
    canReject: true,
    canExport: true,
  },
  permits: {
    canView: true,
    canViewDetails: true,
    canExport: true,
  },
  dailyWork: {
    canView: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewOtherDays: true,
  },
  reports: { canView: true, canExport: true },
  users: {
    canView: true,
    canEdit: true,
    canAdd: true,
    canDelete: true,
    canInvite: true,
  },
  logs: { canView: true },
  cleanup: { canView: true, canDelete: true },
  settings: { canView: true, canEdit: true },
};

/**
 * คืนค่า "สิทธิ์เริ่มต้น" ตามตำแหน่งงาน
 * - ถ้าไม่รู้จัก role ให้กลับไปใช้ของ Viewer เพื่อความปลอดภัย
 */
export function getDefaultPermissions(role: string): PagePermissions {
  const normalized = (role || "viewer").toLowerCase().trim();
  switch (normalized) {
    case "viewer":
      return VIEWER_DEFAULT;
    case "approver":
      return APPROVER_DEFAULT;
    case "admin":
      return ADMIN_DEFAULT;
    case "superadmin":
    case "super_admin":
      return SUPERADMIN_DEFAULT;
    default:
      console.warn(`Unknown role: ${role}, fallback to Viewer permissions`);
      return VIEWER_DEFAULT;
  }
}

/**
 * แปลง "สิทธิ์เริ่มต้น" ให้เป็นข้อความสั้นๆ สำหรับโชว์บน UI
 * เช่น ใช้สรุปความสามารถของแต่ละตำแหน่ง
 */
export function getRoleCapabilities(role: string): string[] {
  const p = getDefaultPermissions(role);
  const caps: string[] = [];

  // Dashboard
  if (p.dashboard.canView) caps.push("ดูหน้า Dashboard");

  // Approvals
  if (p.approvals.canView) caps.push("ดูรายการรออนุมัติ");
  if (p.approvals.canApprove) caps.push("กดอนุมัติได้");
  if (p.approvals.canReject) caps.push("กดปฏิเสธได้");

  // Daily Work
  if (p.dailyWork.canView) caps.push("ดูงานประจำวัน");
  if (p.dailyWork.canCheckIn) caps.push("เช็คอินได้");
  if (p.dailyWork.canCheckOut) caps.push("เช็คเอาท์ได้");
  if (p.dailyWork.canViewOtherDays) caps.push("ดูงานวันอื่นได้");

  // Reports
  if (p.reports.canView) caps.push("ดูรายงาน");
  if (p.reports.canExport) caps.push("ส่งออกรายงาน");

  // Users
  if (p.users.canView) caps.push("เปิดหน้าจัดการผู้ใช้");
  if (p.users.canEdit) caps.push("แก้ไขผู้ใช้ได้");
  if (p.users.canAdd) caps.push("เพิ่มผู้ใช้ใหม่ได้");
  if (p.users.canInvite) caps.push("เชิญผู้ใช้ใหม่ได้");
  if (p.users.canDelete) caps.push("ลบผู้ใช้ได้");

  // Logs
  if (p.logs.canView) caps.push("ดูบันทึกเหตุการณ์ (Logs)");

  // Cleanup
  if (p.cleanup.canView) caps.push("เข้าหน้า Cleanup");
  if (p.cleanup.canDelete) caps.push("ลบข้อมูลใน Cleanup");

  // Settings
  if (p.settings.canView) caps.push("ดูการตั้งค่า");
  if (p.settings.canEdit) caps.push("แก้ไขการตั้งค่า");

  return caps;
}
