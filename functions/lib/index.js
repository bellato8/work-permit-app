"use strict";
// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 2025-10-15 (เพิ่ม export ของ updateAdminPermissions)
// หน้าที่: Export Cloud Functions (เฉพาะที่มีจริงและทำงานได้)
// หมายเหตุ: การ "ส่งออก" ฟังก์ชันจากไฟล์นี้เป็นขั้นที่จำเป็น
// เพื่อให้ Firebase รวมและเปิดเป็น HTTP endpoint หลัง deploy
// อ้างอิง: ใช้ไฟล์ index.ts เป็นศูนย์รวมการ export ตามแนวทาง Firebase
// https://firebase.google.com/docs/functions/typescript
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCalendarView = exports.checkOutRequest = exports.checkInRequest = exports.getDailyWorkByDate = exports.updateAdminPermissions = exports.updateAdminRole = exports.removeadmin = exports.addadmin = exports.listadmins = void 0;
// ==================== Admin Management (ไฟล์เดิมที่มี) ====================
var adminUsers_1 = require("./adminUsers");
Object.defineProperty(exports, "listadmins", { enumerable: true, get: function () { return adminUsers_1.listadmins; } });
Object.defineProperty(exports, "addadmin", { enumerable: true, get: function () { return adminUsers_1.addAdmin; } });
Object.defineProperty(exports, "removeadmin", { enumerable: true, get: function () { return adminUsers_1.removeAdmin; } });
var updateAdminRole_1 = require("./updateAdminRole");
Object.defineProperty(exports, "updateAdminRole", { enumerable: true, get: function () { return updateAdminRole_1.updateAdminRole; } });
// ✨ เพิ่มบรรทัดนี้: ประกาศฟังก์ชันแก้ไขสิทธิ์แบบละเอียด
var updateAdminPermissions_1 = require("./updateAdminPermissions");
Object.defineProperty(exports, "updateAdminPermissions", { enumerable: true, get: function () { return updateAdminPermissions_1.updateAdminPermissions; } });
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
