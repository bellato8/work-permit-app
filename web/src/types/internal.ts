// ======================================================================
// File: web/src/types/internal.ts
// Purpose: ชนิดข้อมูลสำหรับ Module 1 (Internal Portal) และ Module 2 (LP Admin)
// Created: 2025-10-26
// Updated: 2025-10-26 — Initial commit for Internal/LP data types
// Notes:
//   - ออกแบบให้ตรงกับสคีมาที่ตกลง: locations, users_internal, internal_requests
//   - วันที่/เวลา ใช้รูปแบบสตริง ISO เพื่ออ่านง่ายและพกพาง่ายระหว่างหน้า
//   - ชื่อสถานะใช้ “ข้อความไทย” ให้แสดงผลตรงตามหน้าจอได้ทันที
// ======================================================================

// --------- Utility Types (เวลา/วันที่แบบอ่านง่าย) ---------
export type TimestampISO = string;   // เช่น "2025-10-26T09:30:00+07:00"
export type DateString = string;     // เช่น "2025-10-26"
export type TimeString = string;     // เช่น "09:30"

// --------- Locations (Master Data) ---------
// Path: artifacts/{appId}/public/data/locations/{locationId}
export type LocationStatus = "Active" | "Inactive";

export interface LocationDoc {
  id: string;               // doc id ใน Firestore
  locationName: string;     // ชื่อพื้นที่/ร้านค้า
  floor: string;            // ชั้น
  status: LocationStatus;   // Active/Inactive
  // อนาคต: อาจเพิ่ม zone/building ได้โดยไม่กระทบโค้ดส่วนอื่น
}

// --------- Internal Users (พนักงานภายใน) ---------
// Collection: users_internal
export interface InternalUserDoc {
  userId: string;           // uid ของผู้ใช้
  email: string;
  fullName: string;
  department?: string;
  createdAt?: TimestampISO;
  updatedAt?: TimestampISO;
}

// --------- Internal Requests (คำขอภายใน) ---------
// Path: artifacts/{appId}/users/{userId}/internal_requests/{internalRequestId}
export type InternalRequestStatus =
  | "รอดำเนินการ"                 // เริ่มต้นหลังผู้ใช้ส่งคำขอ
  | "LP รับทราบ (รอผู้รับเหมา)"   // LP กดอนุมัติเบื้องต้น สร้างลิงก์ให้ผู้รับเหมาแล้ว
  | "รอ LP ตรวจสอบ"               // ผู้รับเหมา (จำลอง) ส่งฟอร์มแล้ว
  | "อนุมัติเข้าทำงาน"            // LP อนุมัติ
  | "ไม่อนุมัติ";                 // LP ไม่อนุมัติ

export interface InternalRequestDoc {
  // อ้างอิง/ระบบ
  id: string;                       // doc id ของคำขอ (ใต้ผู้สร้าง)
  ownerUserId: string;              // userId เจ้าของคำขอ (กันอ่านข้ามคน)
  createdAt: TimestampISO;
  updatedAt: TimestampISO;

  // ข้อมูลผู้ขอ
  requesterEmail: string;           // อีเมลผู้ยื่น
  requesterName?: string;           // ชื่อผู้ยื่น (ถ้ามี)
  requesterDepartment?: string;     // แผนก (ถ้ามี)

  // สถานที่ (ดึงจาก Master Data)
  locationId: string;               // อ้างอิง doc id ใน locations
  shopName: string;                 // ชื่อร้าน/พื้นที่ (เก็บแบบซ้ำไว้แสดงผลเร็ว)
  floor: string;                    // ชั้น (เก็บซ้ำจาก location)

  // รายละเอียดงาน
  workDetails: string;              // วัตถุประสงค์/รายละเอียดงาน
  workStartDateTime: TimestampISO;  // เวลาเริ่ม (ISO)
  workEndDateTime: TimestampISO;    // เวลาสิ้นสุด (ISO)

  // ผู้รับเหมา
  contractorName: string;           // บริษัทผู้รับเหมา
  contractorContactName?: string;   // ชื่อผู้ประสานผู้รับเหมา (ถ้ามี)
  contractorContactPhone: string;   // เบอร์ผู้ประสาน

  // เอกสาร/ไฟล์ (ถ้ามี)
  attachments?: Array<{
    name: string;                   // ชื่อไฟล์เดิม
    url: string;                    // URL ไฟล์ (Storage) — อาจเป็น signed URL หรือ path
    contentType?: string;
    sizeBytes?: number;
  }>;

  // สถานะและการเชื่อมกับใบอนุญาต
  status: InternalRequestStatus;
  linkedPermitRID?: string | null;  // จะถูกเติมตอน “อนุมัติเบื้องต้น”

  // เบ็ดเตล็ด
  notesByLP?: string;               // หมายเหตุโดย LP
}

// ข้อมูลตอน “สร้างคำขอใหม่” จากหน้า Internal Portal
export interface NewInternalRequestPayload {
  // ต้องมี
  locationId: string;
  workDetails: string;
  workStartDateTime: TimestampISO;
  workEndDateTime: TimestampISO;
  contractorName: string;
  contractorContactPhone: string;

  // เพิ่มความสะดวก
  contractorContactName?: string;
  attachments?: Array<{
    name: string;
    url: string;
    contentType?: string;
    sizeBytes?: number;
  }>;
}

// ค่าคงที่ช่วยแสดงผลสถานะเป็นสี/คำอ่าน (UI สามารถใช้ซ้ำได้)
export const INTERNAL_REQUEST_STATUS_LABEL: Record<InternalRequestStatus, string> = {
  "รอดำเนินการ": "รอดำเนินการ",
  "LP รับทราบ (รอผู้รับเหมา)": "LP รับทราบ (รอผู้รับเหมา)",
  "รอ LP ตรวจสอบ": "รอ LP ตรวจสอบ",
  "อนุมัติเข้าทำงาน": "อนุมัติเข้าทำงาน",
  "ไม่อนุมัติ": "ไม่อนุมัติ",
};
