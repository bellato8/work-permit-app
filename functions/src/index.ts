// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 26/10/2025 22:45 (Asia/Bangkok)
// หน้าที่: รวม/ส่งออก Cloud Functions ทั้งหมดให้ Firebase deploy เป็น endpoint
// เปลี่ยนแปลงรอบนี้:
//   • จัดหมวดหมู่ + คอมเมนต์ให้ชัดเจน
//   • คง export ฟังก์ชันเดิมทั้งหมด และยืนยันการส่งออก createContractorLink (LP Module)
// หมายเหตุ:
//   • ห้าม export ไฟล์ที่ “ยังไม่มีจริง” เพราะจะทำให้ build ล้มเหลว
//   • เมื่อพร้อม mockPermitSubmitted ค่อยมาเพิ่ม export ภายหลัง
// ======================================================================

// ==================== Admin Management ====================
export {
  listadmins,
  addAdmin as addadmin,
  removeAdmin as removeadmin,
} from "./adminUsers";

export { updateAdminRole } from "./updateAdminRole";
export { updateAdminPermissions } from "./updateAdminPermissions";

// ==================== Daily Operations ====================
export { getDailyWorkByDate } from "./getDailyWorkByDate";
export { checkInRequest } from "./checkInRequest";
export { checkOutRequest } from "./checkOutRequest";
export { getCalendarView } from "./getCalendarView";

// ==================== Request Management ====================
export { getRequestAdmin } from "./getRequestAdmin";
export { listRequests } from "./listRequests";
export { updateStatus } from "./updateStatus";

// ==================== Proxy Functions ====================
export { proxyListAdmins } from "./proxyListAdmins";
export { proxyListRequests } from "./proxyListRequests";

// ==================== Logs ====================
export { listLogs } from "./listLogs";
export { deleteLogs } from "./deleteLogs";

// ==================== Cleanup (Superadmin Only) ====================
export { deleteRequestCascade, cleanupDeleteLogs } from "./cleanup";

// ==================== Auth ====================
export { logAuth } from "./logAuth";
export { inviteAdmin } from "./inviteAdmin";
export { applyRolesOnSignIn } from "./auth/beforeSignIn";

// ==================== Triggers ====================
export { onRequestCreated } from "./onRequestCreated";
export { onRequestCreatedNotifyApprovers } from "./onRequestCreatedNotifyApprovers";
export { onRequestUpdatedNotifyRequester } from "./onRequestUpdatedNotifyRequester";

// ==================== Utilities ====================
export { ensureCreatedAt } from "./ensureCreatedAt";
export { getStatus } from "./getStatus";

// ==================== LP Module (Module 2) ====================
// อนุมัติเบื้องต้น → สร้าง RID + อัปเดตสถานะ + คืน URL mock สำหรับผู้รับเหมา
export { createContractorLink } from "./createContractorLink";

// TODO (ภายหลัง): เมื่อไฟล์พร้อมให้เปิด export นี้
// export { mockPermitSubmitted } from "./mockPermitSubmitted";
