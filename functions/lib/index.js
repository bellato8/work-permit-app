"use strict";
// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 2025-10-24 (เพิ่ม export functions ที่หายไป)
// หน้าที่: Export Cloud Functions (เฉพาะที่มีจริงและทำงานได้)
// หมายเหตุ: การ "ส่งออก" ฟังก์ชันจากไฟล์นี้เป็นขั้นที่จำเป็น
// เพื่อให้ Firebase รวมและเปิดเป็น HTTP endpoint หลัง deploy
// อ้างอิง: ใช้ไฟล์ index.ts เป็นศูนย์รวมการ export ตามแนวทาง Firebase
// https://firebase.google.com/docs/functions/typescript
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatus = exports.ensureCreatedAt = exports.onRequestUpdatedNotifyRequester = exports.onRequestCreatedNotifyApprovers = exports.onRequestCreated = exports.applyRolesOnSignIn = exports.inviteAdmin = exports.logAuth = exports.cleanupDeleteLogs = exports.deleteRequestCascade = exports.deleteLogs = exports.listLogs = exports.proxyListRequests = exports.proxyListAdmins = exports.updateStatus = exports.listRequests = exports.getRequestAdmin = exports.getCalendarView = exports.checkOutRequest = exports.checkInRequest = exports.getDailyWorkByDate = exports.updateAdminPermissions = exports.updateAdminRole = exports.removeadmin = exports.addadmin = exports.listadmins = void 0;
// ==================== Admin Management ====================
var adminUsers_1 = require("./adminUsers");
Object.defineProperty(exports, "listadmins", { enumerable: true, get: function () { return adminUsers_1.listadmins; } });
Object.defineProperty(exports, "addadmin", { enumerable: true, get: function () { return adminUsers_1.addAdmin; } });
Object.defineProperty(exports, "removeadmin", { enumerable: true, get: function () { return adminUsers_1.removeAdmin; } });
var updateAdminRole_1 = require("./updateAdminRole");
Object.defineProperty(exports, "updateAdminRole", { enumerable: true, get: function () { return updateAdminRole_1.updateAdminRole; } });
var updateAdminPermissions_1 = require("./updateAdminPermissions");
Object.defineProperty(exports, "updateAdminPermissions", { enumerable: true, get: function () { return updateAdminPermissions_1.updateAdminPermissions; } });
// ==================== Daily Operations ====================
var getDailyWorkByDate_1 = require("./getDailyWorkByDate");
Object.defineProperty(exports, "getDailyWorkByDate", { enumerable: true, get: function () { return getDailyWorkByDate_1.getDailyWorkByDate; } });
var checkInRequest_1 = require("./checkInRequest");
Object.defineProperty(exports, "checkInRequest", { enumerable: true, get: function () { return checkInRequest_1.checkInRequest; } });
var checkOutRequest_1 = require("./checkOutRequest");
Object.defineProperty(exports, "checkOutRequest", { enumerable: true, get: function () { return checkOutRequest_1.checkOutRequest; } });
var getCalendarView_1 = require("./getCalendarView");
Object.defineProperty(exports, "getCalendarView", { enumerable: true, get: function () { return getCalendarView_1.getCalendarView; } });
// ==================== Request Management ====================
var getRequestAdmin_1 = require("./getRequestAdmin");
Object.defineProperty(exports, "getRequestAdmin", { enumerable: true, get: function () { return getRequestAdmin_1.getRequestAdmin; } });
var listRequests_1 = require("./listRequests");
Object.defineProperty(exports, "listRequests", { enumerable: true, get: function () { return listRequests_1.listRequests; } });
var updateStatus_1 = require("./updateStatus");
Object.defineProperty(exports, "updateStatus", { enumerable: true, get: function () { return updateStatus_1.updateStatus; } });
// ==================== Proxy Functions ====================
var proxyListAdmins_1 = require("./proxyListAdmins");
Object.defineProperty(exports, "proxyListAdmins", { enumerable: true, get: function () { return proxyListAdmins_1.proxyListAdmins; } });
var proxyListRequests_1 = require("./proxyListRequests");
Object.defineProperty(exports, "proxyListRequests", { enumerable: true, get: function () { return proxyListRequests_1.proxyListRequests; } });
// ==================== Logs ====================
var listLogs_1 = require("./listLogs");
Object.defineProperty(exports, "listLogs", { enumerable: true, get: function () { return listLogs_1.listLogs; } });
var deleteLogs_1 = require("./deleteLogs");
Object.defineProperty(exports, "deleteLogs", { enumerable: true, get: function () { return deleteLogs_1.deleteLogs; } });
// ==================== Cleanup (Superadmin Only) ====================
var cleanup_1 = require("./cleanup");
Object.defineProperty(exports, "deleteRequestCascade", { enumerable: true, get: function () { return cleanup_1.deleteRequestCascade; } });
Object.defineProperty(exports, "cleanupDeleteLogs", { enumerable: true, get: function () { return cleanup_1.cleanupDeleteLogs; } });
// ==================== Auth ====================
var logAuth_1 = require("./logAuth");
Object.defineProperty(exports, "logAuth", { enumerable: true, get: function () { return logAuth_1.logAuth; } });
var inviteAdmin_1 = require("./inviteAdmin");
Object.defineProperty(exports, "inviteAdmin", { enumerable: true, get: function () { return inviteAdmin_1.inviteAdmin; } });
var beforeSignIn_1 = require("./auth/beforeSignIn");
Object.defineProperty(exports, "applyRolesOnSignIn", { enumerable: true, get: function () { return beforeSignIn_1.applyRolesOnSignIn; } });
// ==================== Triggers ====================
var onRequestCreated_1 = require("./onRequestCreated");
Object.defineProperty(exports, "onRequestCreated", { enumerable: true, get: function () { return onRequestCreated_1.onRequestCreated; } });
var onRequestCreatedNotifyApprovers_1 = require("./onRequestCreatedNotifyApprovers");
Object.defineProperty(exports, "onRequestCreatedNotifyApprovers", { enumerable: true, get: function () { return onRequestCreatedNotifyApprovers_1.onRequestCreatedNotifyApprovers; } });
var onRequestUpdatedNotifyRequester_1 = require("./onRequestUpdatedNotifyRequester");
Object.defineProperty(exports, "onRequestUpdatedNotifyRequester", { enumerable: true, get: function () { return onRequestUpdatedNotifyRequester_1.onRequestUpdatedNotifyRequester; } });
// ==================== Utilities ====================
var ensureCreatedAt_1 = require("./ensureCreatedAt");
Object.defineProperty(exports, "ensureCreatedAt", { enumerable: true, get: function () { return ensureCreatedAt_1.ensureCreatedAt; } });
var getStatus_1 = require("./getStatus");
Object.defineProperty(exports, "getStatus", { enumerable: true, get: function () { return getStatus_1.getStatus; } });
