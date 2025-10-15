// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 2025-10-15 (เพิ่ม export ของ updateAdminPermissions)
// หน้าที่: Export Cloud Functions (เฉพาะที่มีจริงและทำงานได้)
// หมายเหตุ: การ "ส่งออก" ฟังก์ชันจากไฟล์นี้เป็นขั้นที่จำเป็น
// เพื่อให้ Firebase รวมและเปิดเป็น HTTP endpoint หลัง deploy
// อ้างอิง: ใช้ไฟล์ index.ts เป็นศูนย์รวมการ export ตามแนวทาง Firebase
// https://firebase.google.com/docs/functions/typescript
// ======================================================================

// ==================== Admin Management (ไฟล์เดิมที่มี) ====================
export {
  listadmins,
  addAdmin as addadmin,
  removeAdmin as removeadmin,
} from "./adminUsers";

export { updateAdminRole } from "./updateAdminRole";

// ✨ เพิ่มบรรทัดนี้: ประกาศฟังก์ชันแก้ไขสิทธิ์แบบละเอียด
export { updateAdminPermissions } from "./updateAdminPermissions";

// ==================== Daily Work by Date (Task 13) ====================
export { getDailyWorkByDate } from "./getDailyWorkByDate";

// ==================== Check-In Management (Task 14) ====================
export { checkInRequest } from "./checkInRequest";

// ==================== Check-Out Management (Task 15) ====================
export { checkOutRequest } from "./checkOutRequest";

// ==================== Calendar View (Task 16) ====================
export { getCalendarView } from "./getCalendarView";
