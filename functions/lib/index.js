"use strict";
// ======================================================================
// File: functions/src/index.ts
// เวอร์ชัน: 2025-10-08 (Final Version)
// แก้ไข: กลับมา export ทุกฟังก์ชันเหมือนเดิม
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeadmin = exports.updateAdminRole = exports.addadmin = exports.listadmins = void 0;
const app_1 = require("firebase-admin/app");
// --- Centralized Initialization ---
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
// Export ฟังก์ชันทั้งหมดสำหรับจัดการ Admin
var adminUsers_1 = require("./adminUsers");
Object.defineProperty(exports, "listadmins", { enumerable: true, get: function () { return adminUsers_1.listadmins; } });
Object.defineProperty(exports, "addadmin", { enumerable: true, get: function () { return adminUsers_1.addAdmin; } });
Object.defineProperty(exports, "updateAdminRole", { enumerable: true, get: function () { return adminUsers_1.updateAdminRole; } });
Object.defineProperty(exports, "removeadmin", { enumerable: true, get: function () { return adminUsers_1.removeAdmin; } });
