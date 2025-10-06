"use strict";
// ======================================================================
// File: functions/src/index.ts
// Version: 2025-10-06 (Asia/Bangkok)
// หน้าที่: รวม "ฟังก์ชันที่จะดีพลอยจริง" เท่านั้น โดยคงชื่อเดิมบนระบบ (ตัวเล็ก)
// หมายเหตุ: คงชื่อเดิมเพื่ออัปเดตบริการเดิม ไม่ต้องไล่แก้ที่เรียกใช้
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCreatedAt = exports.proxyListAdmins = exports.proxyListRequests = exports.logAuth = exports.onRequestUpdatedNotifyRequester = exports.onRequestCreatedNotifyApprovers = exports.onRequestCreated = exports.deleteRequestCascade = exports.cleanupDeleteLogs = exports.deleteLogs = exports.listLogs = exports.getStatus = exports.updateStatus = exports.getRequestAdmin = exports.listRequests = exports.removeadmin = exports.inviteAdmin = exports.updateAdminRole = exports.addadmin = exports.listadmins = void 0;
// -------------------- Admin / Users --------------------
// คงชื่อเดิมบนระบบ: listadmins / addadmin / removeadmin
var adminUsers_1 = require("./adminUsers");
Object.defineProperty(exports, "listadmins", { enumerable: true, get: function () { return adminUsers_1.listadmins; } });
var adminUsers_2 = require("./adminUsers");
Object.defineProperty(exports, "addadmin", { enumerable: true, get: function () { return adminUsers_2.addAdmin; } });
var updateAdminRole_1 = require("./updateAdminRole");
Object.defineProperty(exports, "updateAdminRole", { enumerable: true, get: function () { return updateAdminRole_1.updateAdminRole; } });
var inviteAdmin_1 = require("./inviteAdmin");
Object.defineProperty(exports, "inviteAdmin", { enumerable: true, get: function () { return inviteAdmin_1.inviteAdmin; } });
var removeAdmin_1 = require("./removeAdmin");
Object.defineProperty(exports, "removeadmin", { enumerable: true, get: function () { return removeAdmin_1.removeAdmin; } });
// -------------------- Requests / Status --------------------
var listRequests_1 = require("./listRequests");
Object.defineProperty(exports, "listRequests", { enumerable: true, get: function () { return listRequests_1.listRequests; } });
var getRequestAdmin_1 = require("./getRequestAdmin");
Object.defineProperty(exports, "getRequestAdmin", { enumerable: true, get: function () { return getRequestAdmin_1.getRequestAdmin; } });
var updateStatus_1 = require("./updateStatus");
Object.defineProperty(exports, "updateStatus", { enumerable: true, get: function () { return updateStatus_1.updateStatus; } });
var getStatus_1 = require("./getStatus");
Object.defineProperty(exports, "getStatus", { enumerable: true, get: function () { return getStatus_1.getStatus; } });
// -------------------- Logs & Cleanup --------------------
var listLogs_1 = require("./listLogs");
Object.defineProperty(exports, "listLogs", { enumerable: true, get: function () { return listLogs_1.listLogs; } });
var deleteLogs_1 = require("./deleteLogs");
Object.defineProperty(exports, "deleteLogs", { enumerable: true, get: function () { return deleteLogs_1.deleteLogs; } });
var cleanup_1 = require("./cleanup");
Object.defineProperty(exports, "cleanupDeleteLogs", { enumerable: true, get: function () { return cleanup_1.cleanupDeleteLogs; } });
Object.defineProperty(exports, "deleteRequestCascade", { enumerable: true, get: function () { return cleanup_1.deleteRequestCascade; } });
// -------------------- Triggers / Notifications --------------------
var onRequestCreated_1 = require("./onRequestCreated");
Object.defineProperty(exports, "onRequestCreated", { enumerable: true, get: function () { return onRequestCreated_1.onRequestCreated; } });
// ถ้าพบว่ามีการแจ้งซ้ำ ให้คอมเมนต์ตัวใดตัวหนึ่ง แล้วค่อยจัดเงื่อนไข
var onRequestCreatedNotifyApprovers_1 = require("./onRequestCreatedNotifyApprovers");
Object.defineProperty(exports, "onRequestCreatedNotifyApprovers", { enumerable: true, get: function () { return onRequestCreatedNotifyApprovers_1.onRequestCreatedNotifyApprovers; } });
var onRequestUpdatedNotifyRequester_1 = require("./onRequestUpdatedNotifyRequester");
Object.defineProperty(exports, "onRequestUpdatedNotifyRequester", { enumerable: true, get: function () { return onRequestUpdatedNotifyRequester_1.onRequestUpdatedNotifyRequester; } });
// -------------------- Auth / Security Logs --------------------
// (ยังไม่เปิด beforeSignIn เพื่อเลี่ยงปัญหาคอมไพล์/สิทธิ์ระหว่างทาง)
var logAuth_1 = require("./logAuth");
Object.defineProperty(exports, "logAuth", { enumerable: true, get: function () { return logAuth_1.logAuth; } });
// -------------------- Proxies --------------------
var proxyListRequests_1 = require("./proxyListRequests");
Object.defineProperty(exports, "proxyListRequests", { enumerable: true, get: function () { return proxyListRequests_1.proxyListRequests; } });
var proxyListAdmins_1 = require("./proxyListAdmins");
Object.defineProperty(exports, "proxyListAdmins", { enumerable: true, get: function () { return proxyListAdmins_1.proxyListAdmins; } });
// -------------------- Data Integrity --------------------
var ensureCreatedAt_1 = require("./ensureCreatedAt");
Object.defineProperty(exports, "ensureCreatedAt", { enumerable: true, get: function () { return ensureCreatedAt_1.ensureCreatedAt; } });
// อย่า export: withCors, corsOrigins, serverAuthz, authz, lib/*, tools/*, types/*
// ======================================================================
