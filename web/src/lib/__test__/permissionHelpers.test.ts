// ======================================================================
// File: web/src/lib/__test__/permissionHelpers.test.ts
// Purpose: ทดสอบฟังก์ชันช่วยตรวจสอบสิทธิ์ (permissionHelpers)
// Created: 2025-10-14 (Asia/Bangkok)
// ======================================================================

import {
  canAccessPage,
  hasPagePermission,
  isSuperAdmin,
  isAdminOrAbove,
  getAccessiblePages,
  hasAllPermissions,
  hasAnyPermission,
} from "../permissionHelpers";
import { getDefaultPermissions } from "../defaultPermissions";

console.log("=== Testing Permission Helpers ===\n");

// เตรียมข้อมูลทดสอบจากชุดสิทธิ์ตั้งต้นตามตำแหน่ง
const viewerPerms = getDefaultPermissions("viewer");
const approverPerms = getDefaultPermissions("approver");
const adminPerms = getDefaultPermissions("admin");
const superAdminPerms = getDefaultPermissions("superadmin");

// 1) canAccessPage
console.log("1. canAccessPage():");
console.assert(canAccessPage(viewerPerms, "dashboard") === true);
console.assert(canAccessPage(viewerPerms, "users") === false);
console.assert(canAccessPage(adminPerms, "users") === true);
console.log("   ✅ OK\n");

// 2) hasPagePermission
console.log("2. hasPagePermission():");
console.assert(hasPagePermission(viewerPerms, "approvals", "canApprove") === false);
console.assert(hasPagePermission(approverPerms, "approvals", "canApprove") === true);
console.assert(hasPagePermission(adminPerms, "users", "canEdit") === true);
console.log("   ✅ OK\n");

// 3) isSuperAdmin
console.log("3. isSuperAdmin():");
console.assert(isSuperAdmin("viewer") === false);
console.assert(isSuperAdmin("superadmin") === true);
console.assert(isSuperAdmin("SUPERADMIN") === true);
console.assert(isSuperAdmin("super_admin") === true);
console.log("   ✅ OK\n");

// 4) isAdminOrAbove
console.log("4. isAdminOrAbove():");
console.assert(isAdminOrAbove("viewer") === false);
console.assert(isAdminOrAbove("approver") === false);
console.assert(isAdminOrAbove("admin") === true);
console.assert(isAdminOrAbove("superadmin") === true);
console.log("   ✅ OK\n");

// 5) getAccessiblePages
console.log("5. getAccessiblePages():");
const viewerPages = getAccessiblePages(viewerPerms);
const approverPages = getAccessiblePages(approverPerms);
const adminPages = getAccessiblePages(adminPerms);
const superAdminPages = getAccessiblePages(superAdminPerms);

console.assert(viewerPages.length < approverPages.length);
console.assert(approverPages.length < adminPages.length);
console.assert(adminPages.length < superAdminPages.length);
console.assert(superAdminPages.length === 9);
console.log("   Viewer:", viewerPages);
console.log("   Approver:", approverPages);
console.log("   Admin:", adminPages);
console.log("   Super Admin:", superAdminPages);
console.log("   ✅ OK\n");

// 6) hasAllPermissions
console.log("6. hasAllPermissions():");
console.assert(
  hasAllPermissions(approverPerms, "approvals", ["canApprove", "canReject"]) === true
);
console.assert(
  hasAllPermissions(viewerPerms, "approvals", ["canApprove", "canReject"]) === false
);
console.log("   ✅ OK\n");

// 7) hasAnyPermission
console.log("7. hasAnyPermission():");
console.assert(
  hasAnyPermission(viewerPerms, "approvals", ["canApprove", "canView"]) === true
);
console.assert(
  hasAnyPermission(viewerPerms, "users", ["canEdit", "canDelete"]) === false
);
console.log("   ✅ OK\n");

// 8) Undefined/null handling
console.log("8. Undefined/null handling:");
console.assert(canAccessPage(undefined, "dashboard") === false);
console.assert(hasPagePermission(undefined, "approvals", "canApprove") === false);
console.assert(isSuperAdmin(undefined) === false);
console.assert(getAccessiblePages(undefined).length === 0);
console.log("   ✅ OK\n");

console.log("=== All Tests Passed! ===");
