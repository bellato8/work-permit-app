// ======================================================================
// File: web/src/guards/RequireAdmin.tsx
// เวอร์ชัน: 2025-09-22 15:35 (Asia/Bangkok)
// หน้าที่: การ์ด/การ์ดตรวจสิทธิ์สำหรับเพจผู้ดูแล (Route Guard)
// เชื่อมสิทธิ์สดจาก: ../hooks/useAuthzLive  (รองรับได้ทั้งรูปแบบเก่า/ใหม่)
// หมายเหตุ:
//  - คงพฤติกรรมไฟล์เดิม: โหลดดิ้ง, หน้าบังคับล็อกอิน, หน้าขาดสิทธิ์ พร้อมรายละเอียด
//  - ไม่ใช้ type Role/Cap จาก hook (เพราะไม่มี export แล้ว) → กำหนดชนิดภายในไฟล์เอง
//  - รองรับทั้ง can(cap) แบบเดิม และ caps[] แบบใหม่ (พร้อมแผนที่ alias ชื่อสิทธิ์)
// ======================================================================

import type { ReactNode } from "react";
import useAuthzLive from "../hooks/useAuthzLive";
import { canAny } from "../lib/hasCap";

type RoleKey = "viewer" | "approver" | "admin" | "superadmin";
type RequireAdminProps = {
  children: ReactNode;
  /** บทบาทต่ำสุดที่อนุญาต (เดิม: "admin") */
  minRole?: Exclude<RoleKey, "viewer">; // "approver" | "admin" | "superadmin"
  /** สิทธิ์เฉพาะที่ต้องการ (ตรวจเพิ่มเติมจาก role) */
  requiredCaps?: string[];
  /** ข้อความกำหนดเองเมื่อไม่ผ่านสิทธิ์ */
  fallbackMessage?: string;
};

// จัดอันดับบทบาท (ห้ามแก้ชื่อ key เพื่อความเข้ากันได้ย้อนหลัง)
const roleHierarchy: Record<RoleKey, number> = {
  viewer: 0,
  approver: 1,
  admin: 2,
  superadmin: 3,
};

// แผนที่ alias สิทธิ์: ให้ค่าที่เคยใช้ชื่อเก่า ยัง “ผ่าน” ได้กับชื่อใหม่
// เช่น "approve" → ["approve_requests","review_requests"]
const CAP_ALIASES: Record<string, string[]> = {
  // เก่าที่เคยใช้ในไฟล์เดิม
  viewAll: ["view_permits", "view_dashboard", "view_reports", "view_logs"],
  approve: ["approve_requests", "review_requests"],
  reject: ["reject_requests", "review_requests"],
  delete: ["manage_settings", "delete_requests"],
  export: ["export_sensitive", "view_reports"],
  manageUsers: ["manage_users"],

  // ชื่อใหม่ให้ map หาตัวเอง (กันกรณีส่งมาเป็นชื่อใหม่ตรง ๆ)
  view_permits: ["view_permits"],
  view_dashboard: ["view_dashboard"],
  view_reports: ["view_reports"],
  view_logs: ["view_logs"],
  approve_requests: ["approve_requests"],
  review_requests: ["review_requests"],
  manage_settings: ["manage_settings"],
  manage_users: ["manage_users"],
  export_sensitive: ["export_sensitive"],
  delete_requests: ["delete_requests"],
};

// แปลงชื่อสิทธิ์ให้เทียบกันได้ (camelCase/underscore/lowercase)
function normalizeCapName(s: string) {
  if (!s) return s;
  // แปลง manageUsers → manage_users
  const withUnderscore = s
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  return withUnderscore;
}

function isSuperadminLike(authz: any): boolean {
  const role = authz?.role;
  const caps: string[] | undefined = authz?.caps;
  return (
    role === "superadmin" ||
    caps?.includes?.("superadmin") === true ||
    authz?.superadmin === true ||
    authz?.roles?.superadmin === true
  );
}

export default function RequireAdmin({
  children,
  minRole = "admin",
  requiredCaps = [],
  fallbackMessage,
}: RequireAdminProps) {
  // อ่านสิทธิ์สดจาก hook (รองรับทั้งโครงเก่า/ใหม่)
  const authz: any = (typeof useAuthzLive === "function" ? useAuthzLive() : {}) ?? {};

  const loading: boolean = authz?.loading === true;
  const email: string | null =
    authz?.email ??
    authz?.user?.email ??
    authz?.profile?.email ??
    authz?.currentUser?.email ??
    null;

  const roleRaw: unknown = authz?.role;
  const roleNorm: RoleKey = ((): RoleKey => {
    const r = String(roleRaw ?? "viewer").toLowerCase() as RoleKey;
    return (["viewer", "approver", "admin", "superadmin"] as RoleKey[]).includes(r) ? r : "viewer";
  })();

  const caps: string[] = Array.isArray(authz?.caps) ? authz.caps : [];

  // Loading (กำลังตรวจสอบสิทธิ์)
  if (loading) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-slate-600">กำลังตรวจสอบสิทธิ์...</span>
        </div>
      </div>
    );
  }

  // ยังไม่ล็อกอิน → ใช้พฤติกรรมเดิม
  if (!email) {
    return (
      <div className="mx-auto max-w-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold text-red-600">🔒 ยังไม่ได้เข้าสู่ระบบ</h1>
        <p className="text-slate-600">กรุณาเข้าสู่ระบบก่อนเข้าใช้งานหน้านี้</p>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
          onClick={() => (window.location.href = "/login")}
        >
          ไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    );
  }

  // ตรวจบทบาทขั้นต่ำ (เทียบระดับจาก roleHierarchy)
  const userLevel = roleHierarchy[roleNorm];
  const requiredLevel = roleHierarchy[minRole];
  const hasRoleAccess = userLevel >= requiredLevel;

  // ตัวช่วยตรวจสิทธิ์ (รองรับทั้งโครงเก่า/ใหม่)
  const canFn: ((cap: string) => boolean) | null =
    typeof authz?.can === "function" ? (authz.can as (c: string) => boolean) : null;

  function hasCapGeneric(capName: string): boolean {
    // 1) ถ้ามีฟังก์ชัน can() (รูปแบบเดิม) — ใช้ก่อน
    if (canFn) return !!canFn(capName);

    // 2) ถ้าไม่มี can(): ใช้ caps[] + alias
    const normalized = normalizeCapName(capName);
    const candidates = Array.from(new Set([normalized, ...(CAP_ALIASES[capName] ?? []), ...(CAP_ALIASES[normalized] ?? [])]))
      .map(normalizeCapName);

    // ใช้ canAny เป็น fallback เพิ่มเติม (เผื่อโครงสร้าง role/caps แบบใหม่)
    const hasByAny = canAny({ role: roleNorm, caps }, candidates);
    if (hasByAny) return true;

    // เช็คโดยตรงใน caps[]
    return candidates.some((c) => caps.map(normalizeCapName).includes(c));
  }

  const hasRequiredCaps = (requiredCaps ?? []).every((c) => hasCapGeneric(c));

  // พิเศษ: superadmin ผ่านเสมอ
  const allowed = isSuperadminLike(authz) || (hasRoleAccess && hasRequiredCaps);

  if (!allowed) {
    const defaultMessage = `ต้องมีบทบาท "${minRole}" ขึ้นไป${
      requiredCaps.length > 0 ? ` และสิทธิ์: ${requiredCaps.join(", ")}` : ""
    }`;

    return (
      <div className="mx-auto max-w-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold text-red-600">🚫 ไม่มีสิทธิ์เข้าถึง</h1>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">{fallbackMessage || defaultMessage}</p>
          <div className="mt-2 text-sm text-red-600">
            <p>
              บทบาทปัจจุบัน: <span className="font-semibold">{roleNorm}</span>
            </p>
            <p>
              อีเมล: <span className="font-mono">{email}</span>
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">ข้อมูลสิทธิ์ปัจจุบัน:</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>✅ ดูข้อมูล: {hasCapGeneric("viewAll") ? "ได้" : "ไม่ได้"}</div>
            <div>✅ อนุมัติ: {hasCapGeneric("approve") ? "ได้" : "ไม่ได้"}</div>
            <div>✅ ปฏิเสธ: {hasCapGeneric("reject") ? "ได้" : "ไม่ได้"}</div>
            <div>✅ ลบข้อมูล: {hasCapGeneric("delete") ? "ได้" : "ไม่ได้"}</div>
            <div>✅ ส่งออกข้อมูล: {hasCapGeneric("export") ? "ได้" : "ไม่ได้"}</div>
            <div>✅ จัดการผู้ใช้: {hasCapGeneric("manageUsers") ? "ได้" : "ไม่ได้"}</div>
          </div>
        </div>

        <button
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          onClick={() => window.history.back()}
        >
          ← กลับหน้าก่อนหน้า
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
