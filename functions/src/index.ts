// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 2025-10-08 (Final Version)
// แก้ไข: กลับมา export ทุกฟังก์ชันเหมือนเดิม
// ======================================================================

import { initializeApp, getApps } from "firebase-admin/app";

// --- Centralized Initialization ---
if (!getApps().length) {
  initializeApp();
}

// Export ฟังก์ชันทั้งหมดสำหรับจัดการ Admin
export {
  listadmins,
  addAdmin as addadmin,
  updateAdminRole,
  removeAdmin as removeadmin
} from "./adminUsers";