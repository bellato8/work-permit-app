// ======================================================================
// File: web/src/lib/hasCap.ts
// เวอร์ชัน: 2025-09-17 23:00 (Asia/Bangkok)
// หน้าที่: รวมฟังก์ชันตรวจสิทธิ์ (capabilities) ให้ใช้ได้กับหลายรูปแบบข้อมูล
// เชื่อม auth ผ่าน "อะแดปเตอร์": ./lib/auth (ถ้ามี) — ไฟล์นี้ไม่ผูกกับแหล่งข้อมูลโดยตรง
// หมายเหตุ: ใช้ได้กับ caps แบบ Array<string> / Set<string> / Record<string, boolean>
// ======================================================================

export type CapInput =
  | string[]
  | Set<string>
  | Record<string, boolean>
  | null
  | undefined;

function normalizeRole(role?: string | null): string {
  return (role ?? "").toLowerCase().trim();
}

export function isSuperadmin(role?: string | null): boolean {
  return normalizeRole(role) === "superadmin";
}

function toSet(caps: CapInput): Set<string> {
  if (!caps) return new Set<string>();
  if (Array.isArray(caps)) {
    return new Set(caps.map((c) => c.toLowerCase().trim()).filter(Boolean));
  }
  if (caps instanceof Set) {
    return new Set([...caps].map((c) => String(c).toLowerCase().trim()).filter(Boolean));
  }
  // Record<string, boolean>
  const out = new Set<string>();
  for (const [k, v] of Object.entries(caps)) {
    if (v) out.add(k.toLowerCase().trim());
  }
  return out;
}

/**
 * hasCap: ตรวจว่ามีสิทธิ์ cap เดียวไหม (superadmin ผ่านทุกกรณี)
 */
export function hasCap(caps: CapInput, cap: string, role?: string | null): boolean {
  if (!cap) return false;
  if (isSuperadmin(role)) return true;
  const set = toSet(caps);
  return set.has(cap.toLowerCase().trim());
}

/**
 * hasAnyCap: มีสิทธิ์สักหนึ่งอย่างในรายการไหม
 */
export function hasAnyCap(
  caps: CapInput,
  list: string[] | null | undefined,
  role?: string | null
): boolean {
  if (isSuperadmin(role)) return true;
  if (!list || list.length === 0) return false;
  const set = toSet(caps);
  return list.some((c) => !!c && set.has(c.toLowerCase().trim()));
}

/**
 * hasAllCaps: มีสิทธิ์ครบทุกอย่างในรายการไหม
 */
export function hasAllCaps(
  caps: CapInput,
  list: string[] | null | undefined,
  role?: string | null
): boolean {
  if (isSuperadmin(role)) return true;
  if (!list || list.length === 0) return false;
  const set = toSet(caps);
  return list.every((c) => !!c && set.has(c.toLowerCase().trim()));
}

/** โครงหน้า authz ที่พบเจอบ่อย */
export type AuthzLike = {
  role?: string | null;
  caps?: CapInput;
};

/** ช็อตคัต: ตรวจสิทธิ์จากอ็อบเจ็กต์ authz เดียว */
export const can = (authz: AuthzLike | null | undefined, cap: string) =>
  hasCap(authz?.caps, cap, authz?.role);

export const canAny = (authz: AuthzLike | null | undefined, list: string[]) =>
  hasAnyCap(authz?.caps, list, authz?.role);

export const canAll = (authz: AuthzLike | null | undefined, list: string[]) =>
  hasAllCaps(authz?.caps, list, authz?.role);
