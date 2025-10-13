// ======================================================================
// File: web/src/types/index.ts
// Purpose: Type Definitions สำหรับ Daily Work Management System
// Created: 2025-10-11 (Task 10: Integration Testing)
// ======================================================================

// ========== Admin & User Types ==========

export type AdminRole = 
  | "superadmin"
  | "approver"
  | "viewer"
  | "operator"
  | string;

export interface AdminCapabilities {
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
  
  // ★ NEW: Daily Work Capabilities (จาก Task 01-03)
  viewTodayWork?: boolean;      // ดูงานวันนี้
  viewOtherDaysWork?: boolean;  // ดูงานวันอื่น
  checkInOut?: boolean;         // เช็คอิน/เช็คเอาท์
  
  // Special Permission
  superadmin?: boolean;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
  caps: AdminCapabilities;
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
  workDate: string;               // วันที่ทำงาน (ISO format)
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

// ========== Daily Work Types (จาก Task 05-09) ==========

export type DailyStatus = 
  | "scheduled"    // 🟠 จะเข้า (ยังไม่เช็คอิน)
  | "checked-in"   // 🟢 เข้าแล้ว (เช็คอินแล้ว รอเช็คเอาท์)
  | "checked-out"; // 🔵 ออกแล้ว (เช็คเอาท์แล้ว)

export interface DailyWorkItem extends WorkPermitRequest {
  // ★ เพิ่มฟิลด์สำหรับ Daily Operations
  dailyStatus: DailyStatus;
  
  // Check-in data
  checkedInAt?: string;          // เวลาเช็คอิน (ISO format)
  checkedInBy?: string;          // UID ของผู้เช็คอิน
  checkInNotes?: string;         // หมายเหตุตอนเช็คอิน
  
  // Check-out data
  checkedOutAt?: string;         // เวลาเช็คเอาท์ (ISO format)
  checkedOutBy?: string;         // UID ของผู้เช็คเอาท์
  checkOutNotes?: string;        // หมายเหตุตอนเช็คเอาท์
  
  // Worker count (optional)
  expectedWorkers?: number;
  actualWorkers?: number;
}

// ========== Calendar View Types ==========

export interface CalendarDayData {
  date: string;                  // วันที่ในรูปแบบ "YYYY-MM-DD"
  totalWorks: number;            // จำนวนงานทั้งหมด
  scheduled: number;             // จำนวนงานที่จะเข้า
  checkedIn: number;             // จำนวนงานที่เข้าแล้ว
  checkedOut: number;            // จำนวนงานที่ออกแล้ว
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

export type Timestamp = string; // ISO 8601 format
export type DateString = string; // "YYYY-MM-DD" format
export type TimeString = string; // "HH:mm" format (24-hour)

// ========== Export All ==========
export type {
  AdminRole,
  AdminCapabilities,
  AdminUser,
  PermitStatus,
  PermitType,
  WorkPermitRequest,
  DailyStatus,
  DailyWorkItem,
  CalendarDayData,
  CalendarViewResponse,
  ApiResponse,
  PaginatedResponse,
  AuthState,
  LoginCredentials,
  SystemLog,
  Timestamp,
  DateString,
  TimeString,
};
