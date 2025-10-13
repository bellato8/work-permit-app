// web/src/services/dailyOperationsService.ts
import { getAuth } from "firebase/auth";

// Types
export interface WorkItem {
  rid: string;
  contractorName: string;
  permitType: string;
  area: string;
  startTime: string;
  endTime: string;
  dailyStatus: "scheduled" | "checked-in" | "checked-out";
  lastCheckIn?: {
    _seconds: number;
    _nanoseconds: number;
  } | null;
  lastCheckOut?: {
    _seconds: number;
    _nanoseconds: number;
  } | null;
}

export interface DailyWorkResponse {
  ok: boolean;
  date: string;
  scheduled: WorkItem[];
  checkedIn: WorkItem[];
  checkedOut: WorkItem[];
  total: number;
}

export interface CalendarDayData {
  date: string;
  totalWorks: number;
  scheduled: number;
  checkedIn: number;
  checkedOut: number;
}

export interface CalendarResponse {
  ok: boolean;
  year: number;
  month: number;
  days: CalendarDayData[];
}

export interface CheckInResponse {
  ok: boolean;
  checkInId: string;
  requestId: string;
  timestamp: string;
}

export interface CheckOutResponse {
  ok: boolean;
  checkOutId: string;
  requestId: string;
  checkInId: string | null;
  timestamp: string;
}

// API URLs (from .env.local)
const API_URLS = {
  getDailyWork: import.meta.env.VITE_GET_DAILY_WORK_BY_DATE_URL as string,
  checkIn: import.meta.env.VITE_CHECKIN_URL as string,
  checkOut: import.meta.env.VITE_CHECKOUT_URL as string,
  getCalendar: import.meta.env.VITE_GET_CALENDAR_VIEW_URL as string,
};

// Helper: Get ID Token
async function getIdToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  }
  
  return await user.getIdToken();
}

// Helper: Call API
async function callAPI<T>(
  url: string,
  body: any
): Promise<T> {
  if (!url) {
    throw new Error("API URL is not configured");
  }

  const token = await getIdToken();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.message || data.error || "API request failed");
  }

  return data as T;
}

// =================================================================
// 1. getDailyWorkByDate
// =================================================================
export async function getDailyWorkByDate(
  date: string // "2025-10-10"
): Promise<DailyWorkResponse> {
  return callAPI<DailyWorkResponse>(API_URLS.getDailyWork, { date });
}

// =================================================================
// 2. checkInRequest
// =================================================================
export async function checkInRequest(
  requestId: string,
  notes: string
): Promise<CheckInResponse> {
  return callAPI<CheckInResponse>(API_URLS.checkIn, { requestId, notes });
}

// =================================================================
// 3. checkOutRequest
// =================================================================
export async function checkOutRequest(
  requestId: string,
  notes: string
): Promise<CheckOutResponse> {
  return callAPI<CheckOutResponse>(API_URLS.checkOut, { requestId, notes });
}

// =================================================================
// 4. getCalendarView
// =================================================================
export async function getCalendarView(
  year: number,
  month: number // 1-12
): Promise<CalendarResponse> {
  return callAPI<CalendarResponse>(API_URLS.getCalendar, { year, month });
}

// =================================================================
// Helper: Format Timestamp
// =================================================================
export function formatTimestamp(timestamp: { _seconds: number; _nanoseconds: number } | null | undefined): string {
  if (!timestamp) return "-";
  
  const date = new Date(timestamp._seconds * 1000);
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}