"use strict";
// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 23/09/2025 20:45
// หน้าที่: รวม export ของ Cloud Functions ที่ "จะ deploy" เท่านั้น
// เชื่อม auth ผ่าน "อะแดปเตอร์": (ยูทิลิตี้) ./authz และ ./serverAuthz แต่ไม่ต้อง export ที่นี่
// หมายเหตุ: แก้ TS2305 จากการ export ชื่อที่ไม่มีจริงในไฟล์ต้นทาง
// วันที่/เวลา (เขตเวลาไทย): 23/09/2025 20:45
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRolesOnSignIn = exports.onRequestUpdatedNotifyRequester = exports.onRequestCreated = exports.logAuth = exports.deleteLogs = exports.listLogs = exports.updateStatus = exports.getStatus = exports.getRequestAdmin = exports.listRequests = exports.proxyListRequests = exports.proxyListAdmins = exports.updateAdminRole = exports.removeAdmin = exports.inviteAdmin = exports.listAdmins = void 0;
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
var adminUsers_1 = require("./adminUsers");
Object.defineProperty(exports, "listAdmins", { enumerable: true, get: function () { return adminUsers_1.listAdmins; } });
var inviteAdmin_1 = require("./inviteAdmin");
Object.defineProperty(exports, "inviteAdmin", { enumerable: true, get: function () { return inviteAdmin_1.inviteAdmin; } });
var removeAdmin_1 = require("./removeAdmin");
Object.defineProperty(exports, "removeAdmin", { enumerable: true, get: function () { return removeAdmin_1.removeAdmin; } });
var updateAdminRole_1 = require("./updateAdminRole");
Object.defineProperty(exports, "updateAdminRole", { enumerable: true, get: function () { return updateAdminRole_1.updateAdminRole; } });
// -------------------- Proxies / Helpers --------------------
var proxyListAdmins_1 = require("./proxyListAdmins");
Object.defineProperty(exports, "proxyListAdmins", { enumerable: true, get: function () { return proxyListAdmins_1.proxyListAdmins; } });
var proxyListRequests_1 = require("./proxyListRequests");
Object.defineProperty(exports, "proxyListRequests", { enumerable: true, get: function () { return proxyListRequests_1.proxyListRequests; } });
// -------------------- Requests --------------------
var listRequests_1 = require("./listRequests");
Object.defineProperty(exports, "listRequests", { enumerable: true, get: function () { return listRequests_1.listRequests; } });
var getRequestAdmin_1 = require("./getRequestAdmin");
Object.defineProperty(exports, "getRequestAdmin", { enumerable: true, get: function () { return getRequestAdmin_1.getRequestAdmin; } });
var getStatus_1 = require("./getStatus");
Object.defineProperty(exports, "getStatus", { enumerable: true, get: function () { return getStatus_1.getStatus; } });
var updateStatus_1 = require("./updateStatus");
Object.defineProperty(exports, "updateStatus", { enumerable: true, get: function () { return updateStatus_1.updateStatus; } });
// -------------------- Logs --------------------
var listLogs_1 = require("./listLogs");
Object.defineProperty(exports, "listLogs", { enumerable: true, get: function () { return listLogs_1.listLogs; } });
var deleteLogs_1 = require("./deleteLogs");
Object.defineProperty(exports, "deleteLogs", { enumerable: true, get: function () { return deleteLogs_1.deleteLogs; } });
var logAuth_1 = require("./logAuth");
Object.defineProperty(exports, "logAuth", { enumerable: true, get: function () { return logAuth_1.logAuth; } });
// -------------------- Firestore Triggers --------------------
var onRequestCreated_1 = require("./onRequestCreated");
Object.defineProperty(exports, "onRequestCreated", { enumerable: true, get: function () { return onRequestCreated_1.onRequestCreated; } });
var onRequestUpdatedNotifyRequester_1 = require("./onRequestUpdatedNotifyRequester");
Object.defineProperty(exports, "onRequestUpdatedNotifyRequester", { enumerable: true, get: function () { return onRequestUpdatedNotifyRequester_1.onRequestUpdatedNotifyRequester; } });
var beforeSignIn_1 = require("./auth/beforeSignIn");
Object.defineProperty(exports, "applyRolesOnSignIn", { enumerable: true, get: function () { return beforeSignIn_1.applyRolesOnSignIn; } });
// NOTE: มีไฟล์ onRequestCreatedNotifyApprovers.ts ด้วย
// ถ้าเปิดใช้งานพร้อมกันกับ onRequestCreated อาจทำให้ "ส่งเมลซ้ำ 2 ฉบับ"
// เดี๋ยวไปจัดการในขั้นถัดไปให้เหลือตัวเดียว/ควบคุมเงื่อนไขให้ชัดเจน
// export { onRequestCreatedNotifyApprovers } from "./onRequestCreatedNotifyApprovers";
