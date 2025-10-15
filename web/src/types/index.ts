// ======================================================================
// File: web/src/types/index.ts
// Purpose: ศูนย์รวม Type ของฝั่งเว็บ + รองรับโครง "สิทธิ์แบบละเอียด (Granular Permissions)"
// Created: 2025-10-11
// Updated: 2025-10-14 (Task 3: export permissions + รองรับ pagePermissions ทั้งที่ AdminCapabilities และ AdminUser)
// Notes:
//   - เปิด re-export จาก './permissions' เพื่อให้ import ชนิดสิทธิ์ใหม่ได้จากจุดเดียว
//   - คงช่อง legacy เดิมทั้งหมดเพื่อไม่ให้โค้ดเก่าพัง (จะค่อยๆ migrate ภายหลัง)
// ======================================================================

export * from "./permissions"; // re-export ชนิดสิทธิ์แบบละเอียด (barrel)
import type { AdminRole, PagePermissions } from "./permissions";

// ========== Admin & User Types ==========

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

// ========== Work Permit Types ==========

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

// ========== Daily Work Types ==========

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

// ========== Calendar View Types ==========

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

// ========== API Response Types ==========

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

// ========== Auth Types ==========

export interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ========== Log Types ==========

export interface SystemLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  details?: any;
  ip?: string;
}

// ========== Utility Types ==========

export type Timestamp = string;   // ISO 8601
export type DateString = string;  // "YYYY-MM-DD"
export type TimeString = string;  // "HH:mm"
