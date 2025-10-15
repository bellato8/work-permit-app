// ======================================================================
// File: functions/src/types/permissions.ts
// Purpose: Type Definitions สำหรับ Backend (Cloud Functions)
// Note: ต้องเหมือนกับ web/src/types/permissions.ts
// Created: 2025-10-14 (Asia/Bangkok)
// ======================================================================

/**
 * หน้าทั้งหมดในระบบ Admin
 */
export type PageKey =
  | "dashboard"      // หน้าแดชบอร์ด
  | "approvals"      // หน้ารออนุมัติ
  | "permits"        // หน้าใบงาน
  | "dailyWork"      // หน้างานประจำวัน
  | "reports"        // หน้ารายงาน
  | "users"          // หน้าจัดการผู้ใช้
  | "logs"           // หน้า Logs
  | "cleanup"        // หน้า Cleanup
  | "settings";      // หน้าตั้งค่า

/**
 * สิทธิ์สำหรับหน้า Dashboard
 */
export type DashboardPermissions = {
  canView: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Approvals (รออนุมัติ)
 */
export type ApprovalsPermissions = {
  canView: boolean;
  canViewDetails: boolean;
  canApprove: boolean;
  canReject: boolean;
  canExport: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Permits (ใบงาน)
 */
export type PermitsPermissions = {
  canView: boolean;
  canViewDetails: boolean;
  canExport: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Daily Work (งานประจำวัน)
 */
export type DailyWorkPermissions = {
  canView: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canViewOtherDays: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Reports (รายงาน)
 */
export type ReportsPermissions = {
  canView: boolean;
  canExport: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Users (จัดการผู้ใช้)
 */
export type UsersPermissions = {
  canView: boolean;
  canEdit: boolean;
  canAdd: boolean;
  canDelete: boolean;
  canInvite: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Logs
 */
export type LogsPermissions = {
  canView: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Cleanup
 */
export type CleanupPermissions = {
  canView: boolean;
  canDelete: boolean;
};

/**
 * สิทธิ์สำหรับหน้า Settings
 */
export type SettingsPermissions = {
  canView: boolean;
  canEdit: boolean;
};

/**
 * โครงสร้างสิทธิ์ทั้งหมด
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
 * ตำแหน่งงานมาตรฐาน
 */
export type AdminRole = "viewer" | "approver" | "admin" | "superadmin";

/**
 * Admin User พร้อมสิทธิ์แบบละเอียด (ฝั่ง Backend)
 * หมายเหตุ:
 *  - uid ใช้เป็น optional เพราะบางบริบทเราอ่านจากเอกสารที่ไม่มี uid ติดมา
 *  - createdAt/updatedAt ใช้ any เพื่อรองรับ Firestore Timestamp/Date แล้วค่อยแปลงตอนใช้งาน
 */
export type AdminWithPermissions = {
  uid?: string;
  email: string;
  displayName?: string;
  name?: string; // alias ของ displayName
  role: AdminRole;
  enabled: boolean;
  pagePermissions: PagePermissions;
  createdAt?: any; // FirebaseFirestore.Timestamp | Date | string
  updatedAt?: any; // FirebaseFirestore.Timestamp | Date | string
  updatedBy?: string;
};
