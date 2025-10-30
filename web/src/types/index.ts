// ======================================================================
// File: web/src/types/index.ts
// Purpose: ศูนย์รวม Type ของฝั่งเว็บ + รองรับโครง "สิทธิ์แบบละเอียด (Granular Permissions)"
// Created: 2025-10-11
// Updated: 2025-10-14 (Task 3: export permissions + รองรับ pagePermissions ทั้งที่ AdminCapabilities และ AdminUser)
// Updated: 2025-10-26 (Task: Add Module 1 & 2 types — Internal Portal + LP Admin; ไม่ลบของเดิม, เพิ่มเฉพาะที่ขาด)
// Notes:
//   - เปิด re-export จาก './permissions' เพื่อให้ import ชนิดสิทธิ์ใหม่ได้จากจุดเดียว
//   - คงช่อง legacy เดิมทั้งหมดเพื่อไม่ให้โค้ดเก่าพัง (จะค่อยๆ migrate ภายหลัง)
//   - เพิ่มชนิดข้อมูลของ Module 1 (Internal Portal) และ Module 2 (LP Admin) ตามสโคปรอบนี้
//   - ใช้คำอธิบายเป็นภาษาอ่านง่าย เพื่อให้คนทำต่อเข้าใจเป้าหมายได้ไว
//   - อัปเดตโดย: เพื่อนคู่คิด (26 ต.ค. 2025)
// ======================================================================

export * from "./permissions"; // re-export ชนิดสิทธิ์แบบละเอียด (barrel)
import type { AdminRole, PagePermissions } from "./permissions";

// ========== Admin & User Types (เดิม) ==========

/**
 * (LEGACY) ความสามารถแบบเดิมที่รวมๆ เป็นก้อนเดียว
 * เก็บไว้เพื่อ backward compatibility ระหว่างย้ายไปใช้ pagePermissions เต็มรูปแบบ
 */
export interface AdminCapabilities {
  // ---------------- Legacy (เดิม) ----------------
  // Dashboard & Reports
  view_dashboard?: boolean;
  view_reports?: boolean;

  // Approval & Review
  approve_requests?: boolean;
  review_requests?: boolean;

  // Permits & Logs
  view_permits?: boolean;
  view_logs?: boolean;

  // User Management
  manage_users?: boolean;

  // Settings & System
  manage_settings?: boolean;

  // Daily Work (ของเดิม)
  viewTodayWork?: boolean;      // ดูงานวันนี้
  viewOtherDaysWork?: boolean;  // ดูงานวันอื่น
  checkInOut?: boolean;         // เช็คอิน/เช็คเอาท์

  // Special
  superadmin?: boolean;

  // ---------------- New (Granular) ----------------
  /**
   * ✨ สิทธิ์แบบละเอียดสำหรับแต่ละหน้า (ใหม่)
   * จะค่อยๆ แทนที่ legacy capabilities ในอนาคต
   */
  pagePermissions?: PagePermissions;
}

/**
 * ผู้ดูแลระบบ (ช่วงเปลี่ยนผ่าน)
 * - role: ใช้จากโครงใหม่ (AdminRole)
 * - pagePermissions: โครงสิทธิ์แบบละเอียด (ใหม่)
 * - caps: สิทธิ์รวมแบบเดิม (legacy)
 */
export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
  enabled?: boolean;
  pagePermissions?: PagePermissions; // ✅ ของใหม่
  caps?: AdminCapabilities;          // ♻️ ของเดิม (ยังรองรับ)
  createdAt?: string;
  updatedAt?: string;
  invitedBy?: string;
}

// ========== Work Permit Types (เดิม) ==========

export type PermitStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export type PermitType =
  | "hot-work"
  | "confined-space"
  | "height-work"
  | "electrical"
  | "excavation"
  | string;

export interface WorkPermitRequest {
  rid: string;                    // Request ID (e.g., "WP-20251010-XRJR")
  contractorName: string;         // ชื่อผู้รับเหมา
  permitType: PermitType;         // ประเภทงาน
  area: string;                   // พื้นที่ทำงาน (e.g., "F1 / T0101")
  startTime: string;              // เวลาเริ่ม (e.g., "08:00")
  endTime: string;                // เวลาสิ้นสุด (e.g., "17:00")
  workDate: string;               // วันที่ทำงาน (ISO)
  status: PermitStatus;           // สถานะใบอนุญาต

  // Additional fields
  description?: string;
  hazards?: string[];
  ppe?: string[];
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ========== Daily Work Types (เดิม) ==========

export type DailyStatus =
  | "scheduled"    // 🟠 จะเข้า (ยังไม่เช็คอิน)
  | "checked-in"   // 🟢 เข้าแล้ว (เช็คอินแล้ว รอเช็คเอาท์)
  | "checked-out"; // 🔵 ออกแล้ว (เช็คเอาท์แล้ว)

export interface DailyWorkItem extends WorkPermitRequest {
  // สำหรับ Daily Operations
  dailyStatus: DailyStatus;

  // Check-in data
  checkedInAt?: string;          // เวลาเช็คอิน (ISO)
  checkedInBy?: string;          // UID ของผู้เช็คอิน
  checkInNotes?: string;         // หมายเหตุตอนเช็คอิน

  // Check-out data
  checkedOutAt?: string;         // เวลาเช็คเอาท์ (ISO)
  checkedOutBy?: string;         // UID ของผู้เช็คเอาท์
  checkOutNotes?: string;        // หมายเหตุตอนเช็คเอาท์

  // Worker count (optional)
  expectedWorkers?: number;
  actualWorkers?: number;
}

// ========== Calendar View Types (เดิม) ==========

export interface CalendarDayData {
  date: string;                  // "YYYY-MM-DD"
  totalWorks: number;
  scheduled: number;
  checkedIn: number;
  checkedOut: number;
}

export interface CalendarViewResponse {
  year: number;
  month: number;
  days: CalendarDayData[];
}

// ========== API Response Types (เดิม) ==========

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ========== Auth Types (เดิม) ==========

export interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ========== Log Types (เดิม) ==========

export interface SystemLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  details?: any;
  ip?: string;
}

// ========== Utility Types (เดิม) ==========

export type Timestamp = string;   // ISO 8601
export type DateString = string;  // "YYYY-MM-DD"
export type TimeString = string;  // "HH:mm"


// ======================================================================
// Module 1 & 2 Types (Internal Portal + LP Admin) — Added 2025-10-26
// เหตุผล: รองรับคำขอภายใน, ข้อมูลพื้นที่/ร้านค้า, และข้อมูลผู้ใช้ภายใน
// แนวทาง: เพิ่มเข้าไปโดยไม่แตะส่วนเดิม เพื่อความปลอดภัยของระบบและการย้ายแบบค่อยเป็นค่อยไป
// ======================================================================

/**
 * สถานะคำขอภายใน (ภาษาไทย) — ใช้ให้ตรงกันทุกหน้า
 * อ้างอิงสเต็ปงาน: รอดำเนินการ → LP รับทราบ (รอผู้รับเหมา) → รอ LP ตรวจสอบ → (อนุมัติเข้าทำงาน | ไม่อนุมัติ)
 */
export type InternalRequestStatus =
  | "รอดำเนินการ"
  | "LP รับทราบ (รอผู้รับเหมา)"
  | "รอ LP ตรวจสอบ"
  | "อนุมัติเข้าทำงาน"
  | "ไม่อนุมัติ";

/**
 * ข้อมูลพื้นที่/ร้านค้า (master data) — ใช้กับหน้า LP Admin > Locations
 * ตรงกับสคีมาที่ตกลง: locationName, floor, status (Active/Inactive)
 */
export interface LocationMaster {
  id: string;
  locationName: string;
  floor: string;
  status: "Active" | "Inactive";
}

/**
 * คำขอภายใน (Internal Request) — ใช้กับ Module 1 (พนักงานภายใน) และตรวจสอบจากฝั่ง LP
 * หมายเหตุ:
 *  - เวลาเก็บเป็น string แบบ ISO เพื่อให้อ่าน/เทียบง่าย (สอดคล้องของเดิมในไฟล์นี้)
 *  - linkedPermitRID จะถูกเติมเมื่อตอน “อนุมัติเบื้องต้น” จากฝั่ง LP
 */
export interface InternalRequest {
  id: string;
  requesterEmail: string;
  locationId: string;              // อ้างอิงเอกสารใน locations
  shopName: string;                // ชื่อพื้นที่/ร้านค้า (คัดลอกมาตอนสร้าง เพื่อแสดงผลเร็ว)
  floor: string;                   // ชั้น (คัดลอกมาตอนสร้าง)
  workDetails: string;             // รายละเอียดงาน
  workStartDateTime: string;       // วันเวลาเริ่ม (ISO)
  workEndDateTime: string;         // วันเวลาสิ้นสุด (ISO)
  contractorName: string;          // บริษัทผู้รับเหมา
  contractorContactPhone: string;  // เบอร์ผู้ประสานงานผู้รับเหมา
  status: InternalRequestStatus;   // สถานะล่าสุดของคำขอ
  linkedPermitRID?: string | null; // RID ที่สร้างโดย LP ตอนอนุมัติเบื้องต้น
  createdAt: string;               // เวลาเริ่มบันทึก (ISO)
  updatedAt: string;               // เวลาแก้ไขล่าสุด (ISO)
}

/**
 * ผู้ใช้ภายใน (สำหรับ Module 1)
 * เก็บข้อมูลพื้นฐานที่ต้องใช้ในหน้า Internal + เผื่อแยกบทบาทง่ายในอนาคต
 */
export interface InternalUser {
  userId: string;
  email: string;
  fullName: string;
  department: string;
  role?: "internal" | "lpAdmin" | "deptAdmin"; // เพิ่ม deptAdmin สำหรับผู้บริหารแผนก
}

// ========== Department Admin Types (เพิ่มใหม่ 30 ต.ค. 2025) ==========

/**
 * ผู้บริหารแผนก (Department Admin)
 * จัดการคนในแผนกและดูงานที่แผนกส่งไป
 */
export interface DepartmentAdmin {
  id: string;                     // Document ID
  uid?: string;                   // Firebase UID (optional, จะมีหลังจากสร้างบัญชี)
  email: string;
  fullName: string;
  department: string;             // แผนกที่รับผิดชอบ
  role: "deptAdmin";
  enabled: boolean;               // สถานะการใช้งาน
  createdAt: string;
  updatedAt: string;
  createdBy?: string;             // UID ของผู้สร้าง
}

/**
 * สมาชิกในแผนก (Department Member)
 * คนในแผนกที่ผู้บริหารแผนกสามารถจัดการได้
 */
export interface DepartmentMember {
  id: string;
  uid?: string;                   // Firebase UID (optional)
  email: string;
  fullName: string;
  department: string;
  position?: string;              // ตำแหน่ง
  phone?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  addedBy?: string;               // UID ของผู้เพิ่ม
}

/**
 * งานของแผนก (Department Work Request)
 * งานที่สมาชิกในแผนกส่งไป - ให้ผู้บริหารแผนกเห็น
 */
export interface DepartmentWorkRequest extends InternalRequest {
  submittedByName: string;        // ชื่อผู้ส่ง
  submittedByEmail: string;       // อีเมลผู้ส่ง
  department: string;             // แผนก
}
