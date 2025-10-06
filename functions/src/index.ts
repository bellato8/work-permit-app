// ======================================================================
// File: functions/src/index.ts
// Version: 2025-10-06 (Asia/Bangkok)
// หน้าที่: รวม "ฟังก์ชันที่จะดีพลอยจริง" เท่านั้น โดยคงชื่อเดิมบนระบบ (ตัวเล็ก)
// หมายเหตุ: คงชื่อเดิมเพื่ออัปเดตบริการเดิม ไม่ต้องไล่แก้ที่เรียกใช้
// ======================================================================

// -------------------- Admin / Users --------------------
// คงชื่อเดิมบนระบบ: listadmins / addadmin / removeadmin
export { listadmins } from "./adminUsers";
export { addAdmin as addadmin } from "./adminUsers";
export { updateAdminRole } from "./updateAdminRole";
export { inviteAdmin } from "./inviteAdmin";
export { removeAdmin as removeadmin } from "./removeAdmin";

// -------------------- Requests / Status --------------------
export { listRequests } from "./listRequests";
export { getRequestAdmin } from "./getRequestAdmin";
export { updateStatus } from "./updateStatus";
export { getStatus } from "./getStatus";

// -------------------- Logs & Cleanup --------------------
export { listLogs } from "./listLogs";
export { deleteLogs } from "./deleteLogs";
export { cleanupDeleteLogs, deleteRequestCascade } from "./cleanup";

// -------------------- Triggers / Notifications --------------------
export { onRequestCreated } from "./onRequestCreated";
// ถ้าพบว่ามีการแจ้งซ้ำ ให้คอมเมนต์ตัวใดตัวหนึ่ง แล้วค่อยจัดเงื่อนไข
export { onRequestCreatedNotifyApprovers } from "./onRequestCreatedNotifyApprovers";
export { onRequestUpdatedNotifyRequester } from "./onRequestUpdatedNotifyRequester";

// -------------------- Auth / Security Logs --------------------
// (ยังไม่เปิด beforeSignIn เพื่อเลี่ยงปัญหาคอมไพล์/สิทธิ์ระหว่างทาง)
export { logAuth } from "./logAuth";

// -------------------- Proxies --------------------
export { proxyListRequests } from "./proxyListRequests";
export { proxyListAdmins } from "./proxyListAdmins";

// -------------------- Data Integrity --------------------
export { ensureCreatedAt } from "./ensureCreatedAt";

// อย่า export: withCors, corsOrigins, serverAuthz, authz, lib/*, tools/*, types/*
// ======================================================================
