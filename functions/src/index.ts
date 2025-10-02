// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 23/09/2025 20:45
// หน้าที่: รวม export ของ Cloud Functions ที่ "จะ deploy" เท่านั้น
// เชื่อม auth ผ่าน "อะแดปเตอร์": (ยูทิลิตี้) ./authz และ ./serverAuthz แต่ไม่ต้อง export ที่นี่
// หมายเหตุ: แก้ TS2305 จากการ export ชื่อที่ไม่มีจริงในไฟล์ต้นทาง
// วันที่/เวลา (เขตเวลาไทย): 23/09/2025 20:45
// ======================================================================

// ----------------------------------------------------------------------
// [BACKUP: ของเดิมที่ทำให้ TS2305]
// export { listAdmins } from "./listAdmins";            // <ไม่มีไฟล์นี้แล้ว>
// export { addAdmin } from "./addAdmin";                // <ไม่มีไฟล์นี้แล้ว>
// export { opsGrantSuperadmin } from "./opsGrantSuperadmin"; // <ไม่มีไฟล์นี้แล้ว>
// export { deleteRequestCascade } from "./deleteRequestCascade"; // <ไม่มีไฟล์นี้แล้ว>
// export { whoAmI } from "./whoAmI";                    // <ไม่มีไฟล์นี้แล้ว>
// export { decisionPortal } from "./decisionPortal";    // <ไม่มีไฟล์นี้แล้ว>
// export { authz } from "./authz";                      // <ยูทิลิตี้ ไม่ต้อง export เป็นฟังก์ชัน deploy>
// export { serverAuthz } from "./serverAuthz";          // <ยูทิลิตี้ ไม่ต้อง export เป็นฟังก์ชัน deploy>
// ----------------------------------------------------------------------

// -------------------- Admin / Users --------------------
// [WHY] ไฟล์จริงคือ adminUsers.ts ซึ่ง export ชื่อ listAdmins

export { updateStatus } from "./updateStatus";
export { getRequestAdmin } from "./getRequestAdmin";
export { updateAdminRole } from "./updateAdminRole";



// NOTE: มีไฟล์ onRequestCreatedNotifyApprovers.ts ด้วย
// ถ้าเปิดใช้งานพร้อมกันกับ onRequestCreated อาจทำให้ "ส่งเมลซ้ำ 2 ฉบับ"
// เดี๋ยวไปจัดการในขั้นถัดไปให้เหลือตัวเดียว/ควบคุมเงื่อนไขให้ชัดเจน
// export { onRequestCreatedNotifyApprovers } from "./onRequestCreatedNotifyApprovers";
