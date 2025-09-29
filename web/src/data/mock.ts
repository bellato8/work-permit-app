// ============================================================
// ไฟล์: src/data/mock.ts
// หน้าที่: เก็บข้อมูล mock กลางให้ทุกหน้าใช้งานร่วมกัน
// ============================================================

/** ===== Permits ===== */
export type PermitStatus = "pending" | "approved" | "rejected" | "returned";

export type Permit = {
  rid: string;
  applicant: string;
  type: string;
  location: string;
  date: string; // YYYY-MM-DD
  status: PermitStatus;
};

export const PERMITS_MOCK: Permit[] = [
  { rid: "WP-20250828-ABCD", applicant: "สมชาย ใจดี",   type: "งานที่สูง",   location: "โซน A", date: "2025-08-28", status: "pending"  },
  { rid: "WP-20250827-EFGH", applicant: "สลิลทิพย์ วีระ", type: "งานไฟฟ้า",   location: "โซน B", date: "2025-08-27", status: "approved" },
  { rid: "WP-20250827-IJKL", applicant: "เฉลิมพล ไทยแท้", type: "เชื่อม/ตัด", location: "โซน C", date: "2025-08-27", status: "rejected" },
  { rid: "WP-20250826-MNOP", applicant: "วาสนา กล้าหาญ",  type: "ที่อับอากาศ", location: "โซน D", date: "2025-08-26", status: "returned" },
];

/** ===== Users ===== */
export type Role = "admin" | "manager" | "employee";
export type User = {
  uid: string;
  name: string;
  email: string;
  title?: string;
  dept?: string;
  role: Role;
  active: boolean;
};

export const USERS_MOCK: User[] = [
  { uid: "U001", name: "ณัฐพล ผ่องใส",  email: "nut@example.com",    title: "ช่างซ่อมบำรุง", dept: "ซ่อมบำรุง", role: "employee", active: true },
  { uid: "U002", name: "วาสนา กล้าหาญ", email: "wasana@example.com", title: "หัวหน้าแผนก",  dept: "ซ่อมบำรุง", role: "manager",  active: true },
  { uid: "U003", name: "อชิระ พิพัฒน์", email: "achi@example.com",   title: "วิศวกรความปลอดภัย", dept: "Safety", role: "admin", active: true },
  { uid: "U004", name: "สลิลทิพย์ วีระ", email: "salin@example.com", title: "เจ้าหน้าที่",   dept: "คลังสินค้า", role: "employee", active: false },
];

/** ===== Audit Logs ===== */
export type LogRow = {
  at: string; // ISO
  action: string; // LOGIN / PERMIT_* / USER_* / DEPT_* / LOC_* / TYPE_*
  by: { name: string; role: Role };
  target: string; // rid หรือ uid หรือ id อะไรก็ได้
  note?: string;
  ip?: string;
};

export const LOGS_MOCK: LogRow[] = [
  { at: "2025-08-28T07:30:00Z", action: "LOGIN",          by: { name: "อชิระ", role: "admin"   }, target: "-",                 ip: "local" },
  { at: "2025-08-28T08:05:00Z", action: "PERMIT_APPROVE", by: { name: "อชิระ", role: "admin"   }, target: "WP-20250827-EFGH", note: "ok" },
  { at: "2025-08-28T08:22:00Z", action: "PERMIT_REJECT",  by: { name: "วาสนา", role: "manager" }, target: "WP-20250827-IJKL", note: "เอกสารไม่ครบ" },
];

/** ===== Master Data: Departments ===== */
export type Department = { id: string; name: string };

export const DEPARTMENTS_MOCK: Department[] = [
  { id: "D001", name: "ซ่อมบำรุง" },
  { id: "D002", name: "คลังสินค้า" },
  { id: "D003", name: "ผลิต" },
  { id: "D004", name: "Safety" },
  { id: "D005", name: "HR" },
];

/** ===== Master Data: Locations ===== */
export type Location = { id: string; name: string };

export const LOCATIONS_MOCK: Location[] = [
  { id: "L001", name: "โซน A" },
  { id: "L002", name: "โซน B" },
  { id: "L003", name: "โซน C" },
  { id: "L004", name: "โซน D" },
  { id: "L005", name: "ดาดฟ้าโรงงาน" },
];

/** ===== Master Data: Work Permit Types ===== */
export type WorkType = { id: string; name: string };

export const WORKTYPES_MOCK: WorkType[] = [
  { id: "T001", name: "งานที่สูง" },
  { id: "T002", name: "งานไฟฟ้า" },
  { id: "T003", name: "เชื่อม/ตัด" },
  { id: "T004", name: "ที่อับอากาศ" },
];
