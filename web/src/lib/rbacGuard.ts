// ======================================================================
// File: web/src/lib/rbacGuard.ts
// Purpose: ตัวช่วยตรวจสอบสิทธิ์การเข้าถึงหน้าและการกระทำต่างๆ
// Created: 2025-10-25 (Asia/Bangkok)
// Notes:
//  - ใช้ร่วมกับ PagePermissions จาก types/permissions.ts
//  - ให้ผลลัพธ์เป็น boolean เพื่อใช้ในการซ่อน/แสดง UI
//  - รองรับ fallback เมื่อไม่มี pagePermissions
// ======================================================================

import { PagePermissions, PageKey } from "../types/permissions";
import { getDefaultPermissions } from "./defaultPermissions";

/**
 * ตรวจสอบว่าผู้ใช้สามารถเข้าถึงหน้านี้ได้หรือไม่
 * @param pageKey - ชื่อหน้า เช่น "dashboard", "permits", "users"
 * @param pagePermissions - สิทธิ์ทั้งหมดของผู้ใช้
 * @param role - บทบาทของผู้ใช้ (ใช้สำหรับ fallback)
 * @returns true ถ้าเข้าถึงได้, false ถ้าไม่ได้
 */
export function canAccessPage(
  pageKey: PageKey,
  pagePermissions?: PagePermissions,
  role?: string | null
): boolean {
  // ถ้าไม่มี pagePermissions ให้ใช้ค่า default จาก role
  const perms = pagePermissions || (role ? getDefaultPermissions(role) : undefined);
  
  if (!perms) return false;

  // ตรวจสอบว่ามี canView หรือไม่
  const pagePerm = perms[pageKey];
  if (!pagePerm) return false;

  return (pagePerm as any).canView === true;
}

/**
 * ตรวจสอบว่าผู้ใช้สามารถทำการกระทำนี้ได้หรือไม่
 * @param pageKey - ชื่อหน้า
 * @param action - การกระทำ เช่น "canEdit", "canApprove", "canDelete"
 * @param pagePermissions - สิทธิ์ทั้งหมดของผู้ใช้
 * @param role - บทบาทของผู้ใช้ (ใช้สำหรับ fallback)
 * @returns true ถ้าทำได้, false ถ้าไม่ได้
 */
export function canPerformAction(
  pageKey: PageKey,
  action: string,
  pagePermissions?: PagePermissions,
  role?: string | null
): boolean {
  // ถ้าไม่มี pagePermissions ให้ใช้ค่า default จาก role
  const perms = pagePermissions || (role ? getDefaultPermissions(role) : undefined);
  
  if (!perms) return false;

  const pagePerm = perms[pageKey];
  if (!pagePerm) return false;

  return (pagePerm as any)[action] === true;
}

/**
 * ตรวจสอบว่าผู้ใช้เป็น Superadmin หรือไม่
 * @param role - บทบาทของผู้ใช้
 * @param caps - ความสามารถของผู้ใช้ (สำหรับ fallback)
 * @returns true ถ้าเป็น Superadmin
 */
export function isSuperadmin(
  role?: string | null,
  caps?: Set<string> | string[] | Record<string, boolean> | null
): boolean {
  // เช็คจาก role ก่อน
  if (role === "superadmin") return true;

  // เช็คจาก caps
  if (!caps) return false;

  if (caps instanceof Set) {
    return caps.has("superadmin");
  }

  if (Array.isArray(caps)) {
    return caps.includes("superadmin");
  }

  if (typeof caps === "object") {
    return caps.superadmin === true;
  }

  return false;
}

/**
 * กรองรายการเมนูที่ผู้ใช้มีสิทธิ์เห็น
 * @param menuItems - รายการเมนูทั้งหมด
 * @param pagePermissions - สิทธิ์ทั้งหมดของผู้ใช้
 * @param role - บทบาทของผู้ใช้
 * @returns รายการเมนูที่ผู้ใช้เห็นได้
 */
export function filterVisibleMenus<T extends { pageKey?: PageKey; requireSuperadmin?: boolean }>(
  menuItems: T[],
  pagePermissions?: PagePermissions,
  role?: string | null,
  caps?: Set<string> | string[] | Record<string, boolean> | null
): T[] {
  const isSuperAdmin = isSuperadmin(role, caps);

  return menuItems.filter((item) => {
    // ถ้าเมนูนี้ต้องการ Superadmin เท่านั้น
    if (item.requireSuperadmin && !isSuperAdmin) {
      return false;
    }

    // ถ้าไม่มี pageKey แสดงว่าเป็นเมนูพิเศษ (เช่น Divider) ให้แสดง
    if (!item.pageKey) {
      return true;
    }

    // ตรวจสอบว่ามีสิทธิ์เข้าถึงหน้านี้หรือไม่
    return canAccessPage(item.pageKey, pagePermissions, role);
  });
}

/**
 * สร้างข้อความแจ้งเตือนเมื่อไม่มีสิทธิ์
 * @param action - การกระทำที่ต้องการทำ เช่น "อนุมัติ", "แก้ไข", "ลบ"
 * @returns ข้อความแจ้งเตือน
 */
export function getNoPermissionMessage(action: string): string {
  return `คุณไม่มีสิทธิ์${action} กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์`;
}

/**
 * ตรวจสอบว่าผู้ใช้มีสิทธิ์อย่างน้อยหนึ่งหน้า
 * @param pagePermissions - สิทธิ์ทั้งหมดของผู้ใช้
 * @param role - บทบาทของผู้ใช้
 * @returns true ถ้ามีสิทธิ์อย่างน้อยหนึ่งหน้า
 */
export function hasAnyPageAccess(
  pagePermissions?: PagePermissions,
  role?: string | null
): boolean {
  const perms = pagePermissions || (role ? getDefaultPermissions(role) : undefined);
  
  if (!perms) return false;

  // ตรวจสอบว่ามีหน้าไหนที่ canView = true บ้าง
  const pages: PageKey[] = [
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

  return pages.some((pageKey) => {
    const pagePerm = perms[pageKey];
    return pagePerm && (pagePerm as any).canView === true;
  });
}

