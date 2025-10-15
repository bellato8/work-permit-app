// ======================================================================
// File: web/src/lib/permissionHelpers.ts
// Purpose: ตัวช่วยเช็กสิทธิ์ฝั่งหน้าเว็บ (ด่านหน้า) ใช้รูปแบบเดียวกันทั้งโปรเจกต์
// Updated: 2025-10-15 (Asia/Bangkok)
// Notes:
//   - รองรับทั้งการส่ง AdminWithPermissions และ PagePermissions เดิม (overload)
//   - superadmin ทำได้ทุกอย่าง; disabled = ปิดหมด
//   - มีฟังก์ชันลัดที่ใช้บ่อย + guardPage บอกเหตุผลปฏิเสธ
//   - เมนูอิง ORDERED_PAGES กลาง เพื่อให้เรียงตรงกันทั้งแอป
//   - ด่านหลังยังจำเป็น (Firestore Rules / API) เพื่อความปลอดภัยจริง
// ======================================================================

import { ORDERED_PAGES } from "../constants/permissions";
import type {
  PagePermissions,
  PageKey,
  AdminWithPermissions,
} from "../types/permissions";

// ------------------------- //
//  ตัวช่วยภายใน (private)   //
// ------------------------- //

function normalizeRole(role?: string): string {
  return (role ?? "").toLowerCase().trim().replace(/\s+/g, "_");
}

function isAdminObject(
  subject: unknown
): subject is AdminWithPermissions {
  if (!subject || typeof subject !== "object") return false;
  // พอใช้: ถ้ามี role หรือ pagePermissions ถือว่าเป็น AdminObject
  return "role" in subject || "pagePermissions" in subject || "enabled" in subject;
}

type GenericPagePerm = Record<string, boolean>;

function getPermissionsFromSubject(
  subject: AdminWithPermissions | PagePermissions | null | undefined
): PagePermissions | undefined {
  if (!subject) return undefined;
  return isAdminObject(subject) ? subject.pagePermissions : (subject as PagePermissions);
}

function isEnabled(subject: AdminWithPermissions | PagePermissions | null | undefined): boolean {
  if (!subject) return false;
  if (isAdminObject(subject)) return subject.enabled !== false;
  // ถ้ายังใช้แบบเก่า (มีแต่ permissions) ให้ถือว่า enabled
  return true;
}

function isSuperAdminBySubject(
  subject: AdminWithPermissions | PagePermissions | string | null | undefined
): boolean {
  if (!subject) return false;
  if (typeof subject === "string") {
    return normalizeRole(subject) === "superadmin" || normalizeRole(subject) === "super_admin";
  }
  if (isAdminObject(subject)) {
    const r = normalizeRole(subject.role);
    return r === "superadmin" || r === "super_admin";
  }
  return false;
}

// ------------------------- //
//  ระดับบทบาทแบบสั้น ๆ     //
// ------------------------- //

/** เป็นซูเปอร์แอดมินหรือไม่ (รับได้ทั้ง string role หรือ AdminWithPermissions) */
export function isSuperAdmin(roleOrAdmin?: string | AdminWithPermissions | null): boolean;
export function isSuperAdmin(roleOrAdmin?: any): boolean {
  return isSuperAdminBySubject(roleOrAdmin);
}

/** เป็นแอดมินขึ้นไปหรือไม่ (admin/superadmin) */
export function isAdminOrAbove(roleOrAdmin?: string | AdminWithPermissions | null): boolean;
export function isAdminOrAbove(roleOrAdmin?: any): boolean {
  if (!roleOrAdmin) return false;
  if (isSuperAdminBySubject(roleOrAdmin)) return true;
  const role = typeof roleOrAdmin === "string"
    ? normalizeRole(roleOrAdmin)
    : normalizeRole((roleOrAdmin as AdminWithPermissions | undefined)?.role);
  return role === "admin";
}

// --------------------------------------- //
//  แกนกลาง: เช็กสิทธิ์ของ "หน้า+การกระทำ" //
// --------------------------------------- //

/** overload: รับ admin หรือ permissions ก็ได้ */
export function hasPagePermission(
  subject: AdminWithPermissions | null | undefined,
  page: PageKey,
  action?: string
): boolean;
export function hasPagePermission(
  subject: PagePermissions | undefined,
  page: PageKey,
  action?: string
): boolean;
export function hasPagePermission(
  subject: AdminWithPermissions | PagePermissions | null | undefined,
  page: PageKey,
  action: string = "canView"
): boolean {
  // ยังไม่ล็อกอิน / ถูกปิดใช้งาน
  if (!isEnabled(subject)) return false;

  // superadmin: ทำได้ทุกอย่าง
  if (isSuperAdminBySubject(subject)) return true;

  // อ่านสิทธิ์ของหน้านั้น ๆ
  const perms = getPermissionsFromSubject(subject);
  const pagePerm = perms?.[page] as GenericPagePerm | undefined;

  // ถ้ายังไม่มี pagePermissions (ผู้ใช้เก่าหรือยังไม่ได้ migrate) → ปลอดภัยไว้ก่อน
  if (!pagePerm) {
    if (action === "canView") {
      const basicViewPages: PageKey[] = ["dashboard", "approvals", "permits"];
      return basicViewPages.includes(page);
    }
    return false;
  }

  // ค่าเช่น canApprove / canView / ...
  const value = pagePerm[action];

  // ถ้ามีคีย์นี้ชัดเจน → ใช้ตามนั้น
  if (typeof value === "boolean") return value;

  // ถ้าถามการเข้าหน้า แต่ไม่มีฟิลด์ → ยึด canView ถ้ามี
  if (action === "canView" && typeof pagePerm.canView === "boolean") {
    return pagePerm.canView;
  }

  // ไม่ระบุ → ไม่อนุญาต
  return false;
}

/** overload: รับ admin หรือ permissions ก็ได้ */
export function canAccessPage(
  subject: AdminWithPermissions | null | undefined,
  page: PageKey
): boolean;
export function canAccessPage(
  subject: PagePermissions | undefined,
  page: PageKey
): boolean;
export function canAccessPage(
  subject: AdminWithPermissions | PagePermissions | null | undefined,
  page: PageKey
): boolean {
  return hasPagePermission(subject as any, page, "canView");
}

/** overload: รับ admin หรือ permissions ก็ได้ */
export function getAccessiblePages(
  subject: AdminWithPermissions | null | undefined,
  orderedPages?: PageKey[]
): PageKey[];
export function getAccessiblePages(
  subject: PagePermissions | undefined,
  orderedPages?: PageKey[]
): PageKey[];
export function getAccessiblePages(
  subject: AdminWithPermissions | PagePermissions | null | undefined,
  orderedPages: PageKey[] = ORDERED_PAGES
): PageKey[] {
  return orderedPages.filter((p) => canAccessPage(subject as any, p));
}

// --------------------------------- //
//  ชุดลัด (อ่านง่าย ใช้บ่อยใน UI)  //
//  (รับได้ทั้ง admin หรือ permissions) //
// --------------------------------- //

export const canApprove = (s: AdminWithPermissions | PagePermissions | null | undefined) =>
  hasPagePermission(s as any, "approvals", "canApprove");

export const canReject = (s: AdminWithPermissions | PagePermissions | null | undefined) =>
  hasPagePermission(s as any, "approvals", "canReject");

export const canExportApprovals = (s: AdminWithPermissions | PagePermissions | null | undefined) =>
  hasPagePermission(s as any, "approvals", "canExport");

export const canExportPermits = (s: AdminWithPermissions | PagePermissions | null | undefined) =>
  hasPagePermission(s as any, "permits", "canExport");

export const canCheckIn = (s: AdminWithPermissions | PagePermissions | null | undefined) =>
  hasPagePermission(s as any, "dailyWork", "canCheckIn");

export const canCheckOut = (s: AdminWithPermissions | PagePermissions | null | undefined) =>
  hasPagePermission(s as any, "dailyWork", "canCheckOut");

export const canViewOtherDaysWork = (s: AdminWithPermissions | PagePermissions | null | undefined) =>
  hasPagePermission(s as any, "dailyWork", "canViewOtherDays");

// ------------------------- //
//  การ์ดผลตรวจเพื่อแจ้งเตือน //
// ------------------------- //

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: "not-logged-in" | "disabled" | "no-permission"; page?: PageKey; needed?: string };

/**
 * ใช้ก่อนเข้าเพจ/โหลดข้อมูล เพื่อบอกเหตุผลที่ปฏิเสธอย่างสุภาพ
 * แนะนำให้เรียกด้วยอ็อบเจ็กต์ admin เพื่อประเมินสถานะ logged-in/disabled ได้
 */
export function guardPage(
  admin: AdminWithPermissions | null | undefined,
  page: PageKey
): GuardResult {
  if (!admin) return { ok: false, reason: "not-logged-in", page };
  if (admin.enabled === false) return { ok: false, reason: "disabled", page };
  return canAccessPage(admin, page)
    ? { ok: true }
    : { ok: false, reason: "no-permission", page, needed: "canView" };
}

// ------------------------- //
//  กลุ่มช่วยตรวจแบบหลายเงื่อนไข //
// ------------------------- //

/** เช็คว่ามีทุก action ที่ระบุไหม (ใช้กับปุ่มที่ต้องครบเงื่อนไข) */
export function hasAllPermissions(
  subject: AdminWithPermissions | PagePermissions | null | undefined,
  page: PageKey,
  actions: string[]
): boolean {
  return actions.every((a) => hasPagePermission(subject as any, page, a));
}

/** เช็คว่ามีอย่างน้อยหนึ่ง action ไหม (ใช้กับปุ่มที่พอมีอย่างใดอย่างหนึ่ง) */
export function hasAnyPermission(
  subject: AdminWithPermissions | PagePermissions | null | undefined,
  page: PageKey,
  actions: string[]
): boolean {
  return actions.some((a) => hasPagePermission(subject as any, page, a));
}

// === [ADD] Helpers: Summary functions for User Card ===============================

/** นับจำนวนหน้าที่มีสิทธิ์เข้าได้ */
export function countAccessiblePages(
  permissions: PagePermissions | undefined
): number {
  if (!permissions) return 0;
  const pages = getAccessiblePages(permissions);
  return pages.length;
}

/** สร้างข้อความสรุปสิทธิ์ (เช่น "เข้าได้ 5/9 หน้า") */
export function getPermissionsSummary(
  permissions: PagePermissions | undefined
): string {
  if (!permissions) return "ไม่มีสิทธิ์";
  const total = 9; // จำนวนหน้าทั้งหมดตามสเปก Phase 2
  const pages = getAccessiblePages(permissions);
  return `เข้าได้ ${pages.length}/${total} หน้า`;
}
