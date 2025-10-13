// ======================================================================
// File: web/src/types/dailywork.types.ts
// Purpose: Type Definitions เฉพาะสำหรับ Daily Work Operations
// Created: 2025-10-11 (Task 10: Integration Testing)
// ======================================================================

import type { DailyWorkItem, CalendarDayData, ApiResponse } from "./index";

// ========== Daily View Component Props ==========

export interface DailyViewProps {
  date: Date;
  onCheckIn?: (rid: string) => void;
  onCheckOut?: (rid: string) => void;
}

// ========== Calendar View Component Props ==========

export interface CalendarViewProps {
  onDateClick?: (date: Date) => void;
}

// ========== Check-In Modal Props ==========

export interface CheckInModalProps {
  open: boolean;
  work: DailyWorkItem | null;
  onClose: () => void;
  onConfirm: (rid: string, notes: string) => Promise<void>;
}

// ========== Check-Out Modal Props ==========

export interface CheckOutModalProps {
  open: boolean;
  work: DailyWorkItem | null;
  onClose: () => void;
  onConfirm: (rid: string, notes: string) => Promise<void>;
}

// ========== API Request/Response Types ==========

export interface GetDailyWorkRequest {
  date: string; // "YYYY-MM-DD"
}

export interface GetDailyWorkResponse extends ApiResponse {
  data: {
    date: string;
    works: DailyWorkItem[];
  };
}

export interface CheckInRequest {
  rid: string;
  notes?: string;
  timestamp?: string; // ISO format (optional, server will use current time if not provided)
  actualWorkers?: number;
}

export interface CheckInResponse extends ApiResponse {
  data: {
    rid: string;
    checkedInAt: string;
    message: string;
  };
}

export interface CheckOutRequest {
  rid: string;
  notes?: string;
  timestamp?: string; // ISO format (optional)
}

export interface CheckOutResponse extends ApiResponse {
  data: {
    rid: string;
    checkedOutAt: string;
    message: string;
  };
}

export interface GetCalendarViewRequest {
  year: number;
  month: number; // 1-12
}

export interface GetCalendarViewResponse extends ApiResponse {
  data: {
    year: number;
    month: number;
    days: CalendarDayData[];
  };
}

// ========== UI State Types ==========

export type ViewMode = "daily" | "calendar";

export interface DailyOperationsState {
  viewMode: ViewMode;
  selectedDate: Date;
  loading: boolean;
  error: string | null;
}

// ========== Column Data for Kanban View ==========

export interface KanbanColumnData {
  title: string;
  color: string;
  count: number;
  items: DailyWorkItem[];
  actionLabel: string | null;
}

// ========== Utility Types ==========

export type DailyWorkStatus = "scheduled" | "checked-in" | "checked-out";

// Helper type for filtering works by status
export type WorksByStatus = {
  [K in DailyWorkStatus]: DailyWorkItem[];
};

// ========== Export All ==========
export type {
  DailyViewProps,
  CalendarViewProps,
  CheckInModalProps,
  CheckOutModalProps,
  GetDailyWorkRequest,
  GetDailyWorkResponse,
  CheckInRequest,
  CheckInResponse,
  CheckOutRequest,
  CheckOutResponse,
  GetCalendarViewRequest,
  GetCalendarViewResponse,
  DailyOperationsState,
  KanbanColumnData,
  DailyWorkStatus,
  WorksByStatus,
  ViewMode,
};
