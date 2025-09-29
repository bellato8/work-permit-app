// ======================================================================
// ไฟล์: web/src/lib/authz.ts
// วันที่/เวลา: 2025-09-01
// ผู้เขียน: เพื่อน GPT
// หน้าที่ไฟล์: ตัวช่วยอ่าน "บทบาท (role)" และ "สิทธิ์ย่อย (caps)" ของผู้ใช้จาก Firestore
// ใช้ทำอะไร: โหลดเอกสาร admins/{emailLower} แล้วแปลงเป็นรูปแบบ caps แบบอ็อบเจกต์
// ฟังก์ชัน:
//   - capsForRole(role): คืนค่า default caps จากบทบาท
//   - emailKey(email): ทำอีเมลให้เป็นคีย์ (ตัวพิมพ์เล็ก)
//   - loadAuthzForEmail(db, email): โหลด { role, caps } ของอีเมลหนึ่งคน
//   - mergeCaps(role, caps?): รวม default caps ตาม role + caps ที่ส่งมา (ถ้ามี)
//   - createAuthz(db, email): สร้างอ็อบเจกต์ authz สำหรับคนๆ นั้น { role, caps, can(), reload() }
// หมายเหตุ:
//   - ไฟล์นี้ "ไม่" init Firebase เอง ต้องส่ง Firestore instance (db) และอีเมลเข้ามา
//   - ใช้ caps แบบอ็อบเจกต์ { approve:true, delete:false, ... } เพื่ออ่านง่ายและใช้ต่อใน UI สะดวก
// ======================================================================

import type { Firestore } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";

// -------------------- โครงสร้าง/ชนิดข้อมูล --------------------
export type Role = "superadmin" | "admin" | "approver" | "viewer";

export type Caps = {
  approve: boolean;
  reject: boolean;
  delete: boolean;
  export: boolean;
  viewAll: boolean;
  manageUsers: boolean;
  settings: boolean;
};

// -------------------- ค่าเริ่มต้นตามบทบาท --------------------
export function capsForRole(role: string): Caps {
  const r = (role || "").toLowerCase();
  if (r === "superadmin") {
    return {
      approve: true,
      reject: true,
      delete: true,
      export: true,
      viewAll: true,
      manageUsers: true,
      settings: true,
    };
  }
  if (r === "admin") {
    return {
      approve: true,
      reject: true,
      delete: true,
      export: true,
      viewAll: true,
      manageUsers: false,
      settings: false,
    };
  }
  if (r === "approver") {
    return {
      approve: true,
      reject: true,
      delete: false,
      export: false,
      viewAll: false,
      manageUsers: false,
      settings: false,
    };
  }
  // viewer
  return {
    approve: false,
    reject: false,
    delete: false,
    export: false,
    viewAll: true,      // ดูได้กว้าง แต่ "อ่านอย่างเดียว"
    manageUsers: false,
    settings: false,
  };
}

// รวม default caps + caps ที่ส่งมา (เฉพาะคีย์ที่เป็น boolean)
export function mergeCaps(role: Role, caps?: Partial<Caps>): Caps {
  const base = { ...capsForRole(role) };
  if (caps && typeof caps === "object") {
    (Object.keys(base) as (keyof Caps)[]).forEach((k) => {
      if (typeof caps[k] === "boolean") base[k] = caps[k] as boolean;
    });
  }
  return base;
}

// ทำคีย์อีเมลให้เป็นรูปแบบที่ใช้กับ doc id
export function emailKey(email: string): string {
  return (email || "").trim().toLowerCase();
}

// โหลด authz สำหรับอีเมลนี้จาก Firestore (collection: "admins", doc id = emailLower)
export async function loadAuthzForEmail(
  db: Firestore,
  email: string
): Promise<{ role: Role; caps: Caps }> {
  const id = emailKey(email);
  if (!id || !/.+@.+\..+/.test(id)) {
    // ถ้าอีเมลไม่ถูกต้อง คืน viewer (อ่านอย่างเดียว) ไว้ก่อน
    return { role: "viewer", caps: capsForRole("viewer") };
    }
  const ref = doc(db, "admins", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // ถ้าไม่มีในระบบ → จัดเป็น viewer
    return { role: "viewer", caps: capsForRole("viewer") };
  }
  const data = snap.data() as any;

  // role ที่เก็บใน Firestore อาจเป็น "super" หรือ "superadmin" ก็ normalize เป็น "superadmin"
  const rawRole: string =
    (data.role || "").toString().toLowerCase().replace(/^super$/, "superadmin") || "viewer";

  // ถ้าฝั่งฐานข้อมูลเก็บ caps เป็น "อ็อบเจกต์" อยู่แล้วก็ใช้ได้เลย
  const rawCaps = (data.caps && typeof data.caps === "object") ? (data.caps as Partial<Caps>) : undefined;

  const role = (["superadmin", "admin", "approver", "viewer"].includes(rawRole)
    ? (rawRole as Role)
    : "viewer");

  const caps = mergeCaps(role, rawCaps);
  return { role, caps };
}

// ตัวช่วยสร้าง authz object สำหรับผู้ใช้หนึ่งคน
export function createAuthz(db: Firestore, email: string) {
  let currentRole: Role = "viewer";
  let currentCaps: Caps = capsForRole("viewer");

  async function reload() {
    const a = await loadAuthzForEmail(db, email);
    currentRole = a.role;
    currentCaps = a.caps;
    return a;
  }

  function can(cap: keyof Caps): boolean {
    return !!currentCaps[cap];
  }

  // ใช้ครั้งแรกควร await reload() ก่อนเพื่อให้ค่าเป็นปัจจุบัน
  return {
    get role() { return currentRole; },
    get caps() { return currentCaps; },
    can,
    reload,
  };
}
