// ======================================================================
// File: web/src/types.ts
// วันที่/เวลา: 2025-09-12 18:50
// ผู้เขียน: AI + สุทธิรักษ์ วิเชียรศรี
// หน้าที่: รวม TypeScript types กลางของระบบ (Superset)
// หมายเหตุ:
//  - รวม “ชุดเดิมของหน้า /status” (DecisionBrief, StatusPublicData, GetStatusApi*)
//  - เพิ่ม “โดเมนไทป์ทั้งแอป” (Requester/Work/Worker/Decision/RequestRecord)
//  - ทำให้ RequestFormPage.tsx ใช้ RequestRecord ได้ และหน้า /status ยังใช้ของเดิมได้
// ======================================================================

/* ======================= ชุดโดเมนไทป์ทั้งแอป (ใหม่) ======================= */

export interface Requester {
  title?: string;
  fullname?: string;
  email?: string;
  phone?: string;
  citizenId?: string;
  address?: string;
  addressLine?: string;
  company?: string;
  citizenIdMasked?: string;
}

export interface WorkLocation {
  detail?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  floor?: string;
  type?: string;
  addressLine?: string;
  to?: string; // บางที่เก็บเวลาเลิกงานไว้ที่ location.to
}

export interface BuildingSystems {
  electric?: boolean;
  plumbing?: boolean;
  lighting?: boolean;
  hvac?: boolean;
  water?: boolean;
  gas?: boolean;
  amp?: string | number;
  labels?: string[];
  [k: string]: any;
}

export interface Equipments {
  has?: boolean | string;
  details?: string;
  items?: string[];
  [k: string]: any;
}

export interface Worker {
  name?: string;
  citizenId?: string;
  phoneLast4?: string;
  isSupervisor?: boolean;
  rejectedAt?: any;
  rejectedBy?: string;
  rejectedByEmail?: string;
  rejectionReason?: string;
  [k: string]: any;
}

export interface Work {
  type?: string;
  area?: string;
  floor?: string;
  from?: string | { seconds?: number; _seconds?: number } | Date;
  to?: string | { seconds?: number; _seconds?: number } | Date;
  location?: WorkLocation;
  hotWork?: boolean | string;
  buildingSystems?: BuildingSystems;
  equipments?: Equipments;
  workers?: Worker[];
  company?: string;
  [k: string]: any;
}

export interface Decision {
  action?: "approve" | "reject" | string | null;
  status?: string | null;
  byEmail?: string;
  byName?: string;
  decidedBy?: string;
  decidedByEmail?: string;
  at?: number | null;
  time?: number | null;
  ts?: number | { seconds?: number } | null;
  timestamp?: number | { seconds?: number } | null;
  reason?: string | null;
  note?: string | null;
  message?: string | null;
  [k: string]: any;
}

export type RequestRecord = {
  rid?: string;
  requestId?: string;
  status?: string;

  requester?: Requester;
  work?: Work;

  workers?: Worker[];
  team?: Array<{ name?: string; isSupervisor?: boolean }>;
  teamNames?: string[];
  equipmentList?: string[];

  images?: Record<string, any>;

  decision?: Decision | null;
  rejectionReason?: string;

  createdAt?: any;
  updatedAt?: any;
  audit?: Record<string, any>;

  [k: string]: any;
};

/* ======================= ชุดหน้า /status (ของเดิม) ======================== */

export type DecisionAction = "approve" | "reject" | null;

export type DecisionBrief = {
  action: DecisionAction;
  at: number | string | null;   // ms หรือ string (compat)
  reason?: string | null;
};

export type StatusPublicData = {
  rid: string;
  status: string;
  maskedPhone?: string;
  maskedEmail?: string;
  requireLast4?: boolean;
  updatedAt?: { _seconds?: number; _nanoseconds?: number } | string | null;

  contractorName?: string;
  company?: string;
  address?: string;
  area?: string;
  floor?: string | number;
  jobType?: string;
  timeFrom?: any;
  timeTo?: any;
  timeStart?: any;
  timeEnd?: any;
  hotWork?: any;
  buildingSystemWork?: string[] | null;
  equipmentList?: string[];

  decision?: DecisionBrief | null;
  rejectionReason?: string;

  [key: string]: any;
};

export type GetStatusApiSuccess = { ok: true; data: StatusPublicData };
export type GetStatusApiError   = { ok: false; error: string };
export type GetStatusApiResponse = GetStatusApiSuccess | GetStatusApiError;

export function msToDate(ms: number | null): Date | null {
  return typeof ms === "number" && Number.isFinite(ms) ? new Date(ms) : null;
}

/* ======================= Department Admin Types ======================== */

export interface DepartmentAdmin {
  id: string;
  email: string;
  fullName: string;
  departmentId: string;
  enabled?: boolean;
  createdAt?: any;
  updatedAt?: any;
  [k: string]: any;
}

export interface DepartmentMember {
  id: string;
  departmentId: string;
  fullName: string;
  email: string;
  enabled: boolean;
  createdAt?: any;
  updatedAt?: any;
  [k: string]: any;
}

export interface InternalRequest {
  id: string;
  requesterEmail: string;
  locationId: string;
  shopName: string;
  floor: string;
  workDetails: string;
  workStartDateTime: any;
  workEndDateTime: any;
  contractorName: string;
  contractorContactPhone: string;
  contractorContactName?: string;
  status: string;
  linkedPermitRID?: string | null;
  createdAt?: any;
  updatedAt?: any;
  [k: string]: any;
}
