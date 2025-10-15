// ======================================================================
// File: web/src/types/permissions.ts
// Purpose: Type Definitions สำหรับระบบสิทธิ์แบบละเอียด (Granular Permissions)
// Created: 2025-10-14 (Asia/Bangkok)
// Notes:
//  - แยก "ตำแหน่งงาน (role)" ออกจาก "สิทธิ์รายหน้า/รายปุ่ม (pagePermissions)"
//  - ใช้ชื่อ field แบบตรงไปตรงมา: canView / canEdit / canApprove ฯลฯ
// ======================================================================

/**
 * ตำแหน่งงานหลักของผู้ดูแล
 * ใช้คู่กับสิทธิ์แบบละเอียด เพื่อความยืดหยุ่น
 */
export type AdminRole = "viewer" | "approver" | "admin" | "superadmin";

/**
 * หน้าทั้งหมดในระบบ Admin (สำหรับอ้างอิง/วนลูป)
 */
export type PageKey =
  | "dashboard"   // หน้าแดชบอร์ด
  | "approvals"   // หน้ารออนุมัติ
  | "permits"     // หน้าใบงาน
  | "dailyWork"   // หน้างานประจำวัน
  | "reports"     // หน้ารายงาน
  | "users"       // หน้าจัดการผู้ใช้
  | "logs"        // หน้า Logs
  | "cleanup"     // หน้า Cleanup
  | "settings";   // หน้าตั้งค่า

/**
 * สิทธิ์สำหรับหน้า Dashboard
 */
export type DashboardPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Approvals (รออนุมัติ)
 */
export type ApprovalsPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
  /** ดูรายละเอียดใบคำขอแต่ละรายการได้ */
  canViewDetails: boolean;
  /** กดอนุมัติได้ */
  canApprove: boolean;
  /** กดปฏิเสธได้ */
  canReject: boolean;
  /** ส่งออกข้อมูล (เช่น CSV) ได้ */
  canExport: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Permits (ใบงาน)
 */
export type PermitsPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
  /** ดูรายละเอียดแต่ละใบงานได้ */
  canViewDetails: boolean;
  /** ส่งออก PDF/CSV ได้ */
  canExport: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Daily Work (งานประจำวัน)
 */
export type DailyWorkPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
  /** เช็คอินได้ */
  canCheckIn: boolean;
  /** เช็คเอาท์ได้ */
  canCheckOut: boolean;
  /** ดูงานวันอื่นได้ (นอกจากวันนี้) */
  canViewOtherDays: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Reports (รายงาน)
 */
export type ReportsPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
  /** ส่งออกรายงานได้ */
  canExport: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Users (จัดการผู้ใช้)
 */
export type UsersPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
  /** แก้ไขสิทธิ์/ข้อมูลผู้ใช้ได้ */
  canEdit: boolean;
  /** เพิ่มผู้ใช้ใหม่ได้ */
  canAdd: boolean;
  /** ลบผู้ใช้ได้ */
  canDelete: boolean;
  /** เชิญผู้ใช้ใหม่ได้ (ส่งอีเมลเชิญ) */
  canInvite: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Logs
 */
export type LogsPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Cleanup
 */
export type CleanupPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
  /** ลบข้อมูลที่ไม่จำเป็นได้ (ต้องระวัง) */
  canDelete: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Settings
 */
export type SettingsPermissions = {
  /** เข้าดูหน้านี้ได้ */
  canView: boolean;
  /** แก้ไขการตั้งค่าได้ */
  canEdit: boolean;
};

/**
 * โครงรวมสิทธิ์ทุกหน้าในระบบ (เก็บใน field pagePermissions)
 */
export type PagePermissions = {
  dashboard: DashboardPermissions;
  approvals: ApprovalsPermissions;
  permits: PermitsPermissions;
  dailyWork: DailyWorkPermissions;
  reports: ReportsPermissions;
  users: UsersPermissions;
  logs: LogsPermissions;
  cleanup: CleanupPermissions;
  settings: SettingsPermissions;
};

/**
 * แบบข้อมูลผู้ดูแลพร้อมสิทธิ์แบบละเอียด
 * หมายเหตุ:
 *  - createdAt/updatedAt ใช้ string เพื่อให้ฝั่งเว็บอ่านง่าย
 *    (ถ้าอ่านจาก Firestore อาจเป็น timestamp ก็แปลงเป็น string ตอนดึง)
 */
export type AdminWithPermissions = {
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
  enabled: boolean;
  pagePermissions: PagePermissions;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};
