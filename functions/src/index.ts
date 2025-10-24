// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 2025-10-24 (เพิ่ม export functions ที่หายไป)
// หน้าที่: Export Cloud Functions (เฉพาะที่มีจริงและทำงานได้)
// หมายเหตุ: การ "ส่งออก" ฟังก์ชันจากไฟล์นี้เป็นขั้นที่จำเป็น
// เพื่อให้ Firebase รวมและเปิดเป็น HTTP endpoint หลัง deploy
// อ้างอิง: ใช้ไฟล์ index.ts เป็นศูนย์รวมการ export ตามแนวทาง Firebase
// https://firebase.google.com/docs/functions/typescript
// ======================================================================

import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

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

// ==================== Auth ====================
export { logAuth } from "./logAuth";
export { inviteAdmin } from "./inviteAdmin";

// ==================== Triggers ====================
export { onRequestCreated } from "./onRequestCreated";
export { onRequestCreatedNotifyApprovers } from "./onRequestCreatedNotifyApprovers";
export { onRequestUpdatedNotifyRequester } from "./onRequestUpdatedNotifyRequester";

// ==================== Utilities ====================
export { ensureCreatedAt } from "./ensureCreatedAt";
export { getStatus } from "./getStatus";

