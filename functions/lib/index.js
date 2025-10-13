"use strict";
// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 2025-10-13 (Task 16 - เพิ่ม getCalendarView)
// หน้าที่: Export Cloud Functions (เฉพาะที่มีจริงและทำงานได้)
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarView = exports.checkOutRequest = exports.checkInRequest = exports.getDailyWorkByDate = exports.updateAdminRole = exports.removeadmin = exports.addadmin = exports.listadmins = void 0;
// ==================== Admin Management (ไฟล์เดิมที่มี) ====================
var adminUsers_1 = require("./adminUsers");
Object.defineProperty(exports, "listadmins", { enumerable: true, get: function () { return adminUsers_1.listadmins; } });
Object.defineProperty(exports, "addadmin", { enumerable: true, get: function () { return adminUsers_1.addAdmin; } });
Object.defineProperty(exports, "removeadmin", { enumerable: true, get: function () { return adminUsers_1.removeAdmin; } });
var updateAdminRole_1 = require("./updateAdminRole");
Object.defineProperty(exports, "updateAdminRole", { enumerable: true, get: function () { return updateAdminRole_1.updateAdminRole; } });
// ==================== Daily Work by Date (Task 13) ====================
var getDailyWorkByDate_1 = require("./getDailyWorkByDate");
Object.defineProperty(exports, "getDailyWorkByDate", { enumerable: true, get: function () { return getDailyWorkByDate_1.getDailyWorkByDate; } });
// ==================== Check-In Management (Task 14) ====================
var checkInRequest_1 = require("./checkInRequest");
Object.defineProperty(exports, "checkInRequest", { enumerable: true, get: function () { return checkInRequest_1.checkInRequest; } });
// ==================== Check-Out Management (Task 15) ====================
var checkOutRequest_1 = require("./checkOutRequest");
Object.defineProperty(exports, "checkOutRequest", { enumerable: true, get: function () { return checkOutRequest_1.checkOutRequest; } });
// ==================== Calendar View (Task 16) ====================
var getCalendarView_1 = require("./getCalendarView");
Object.defineProperty(exports, "getCalendarView", { enumerable: true, get: function () { return getCalendarView_1.getCalendarView; } });
