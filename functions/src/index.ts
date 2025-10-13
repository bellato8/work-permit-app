// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 2025-10-13 (Task 16 - เพิ่ม getCalendarView)
// หน้าที่: Export Cloud Functions (เฉพาะที่มีจริงและทำงานได้)
// ======================================================================

// ==================== Admin Management (ไฟล์เดิมที่มี) ====================
export {
  listadmins,
  addAdmin as addadmin,
  removeAdmin as removeadmin
} from "./adminUsers";

export { updateAdminRole } from "./updateAdminRole";

// ==================== Daily Work by Date (Task 13) ====================
export { getDailyWorkByDate } from "./getDailyWorkByDate";

// ==================== Check-In Management (Task 14) ====================
export { checkInRequest } from "./checkInRequest";

// ==================== Check-Out Management (Task 15) ====================
export { checkOutRequest } from "./checkOutRequest";

// ==================== Calendar View (Task 16) ====================
export { getCalendarView } from "./getCalendarView";