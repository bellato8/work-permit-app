// ======================================================================
// File: src/hooks/useAuthzLive.tsx  (RBAC-first + Legacy fallback)
// โหมดใหม่: อ่าน role/caps จาก Firebase ID Token (custom claims) ก่อน
// ถ้าไม่มี claims → ลองเรียก listAdmins แบบส่ง Authorization: Bearer
// ถ้ายังไม่ได้อีก → fallback วิธีเก่า x-api-key, x-requester-email (Phase 1)
// ======================================================================

import { useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "../lib/auth";
import { can, canAny, canAll } from "../lib/hasCap";

type AdminRecord = {
  email?: string;
  emailLower?: string;
  role?: string | null;
  enabled?: boolean;
  caps?: string[] | Set<string> | Record<string, boolean> | null;
  [k: string]: any;
};

type State = {
  loading: boolean;
  error?: string | null;
  userEmail?: string | null;
  role?: string | null;
  caps?: Set<string>;
};

const LIST_URL = import.meta.env.VITE_LIST_ADMINS_URL as string | undefined;
const APPROVER_KEY = import.meta.env.VITE_APPROVER_KEY as string | undefined;

// ฟิลด์เมทาดาทาที่ "ไม่ใช่สิทธิ์"
const IGNORES = new Set([
  "email",
  "emailLower",
  "enabled",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
  "uid",
  "source",
  "firstLoginAt",
  "lastLoginAt",
]);

function roleRank(r?: string | null) {
  const s = (r ?? "").toLowerCase().trim();
  if (s === "superadmin") return 3;
  if (s === "admin") return 2;
  if (s === "approver" || s === "reviewer") return 1;
  return 0;
}

function toLower(s?: string | null) {
  return (s ?? "").toLowerCase().trim();
}

// รวม caps จากระเบียนเดี่ยว
function capsFromRecord(rec?: AdminRecord | null): Set<string> {
  const out = new Set<string>();
  if (!rec) return out;

  const caps = rec.caps as any;
  if (Array.isArray(caps)) {
    caps.forEach((c) => c && out.add(String(c).toLowerCase().trim()));
  } else if (caps instanceof Set) {
    Array.from(caps).forEach((c) => c && out.add(String(c).toLowerCase().trim()));
  } else if (caps && typeof caps === "object") {
    for (const [k, v] of Object.entries(caps)) {
      if (v) out.add(k.toLowerCase().trim());
    }
  }

  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === "boolean" && v === true && !IGNORES.has(k)) {
      out.add(k.toLowerCase().trim());
    }
  }

  return out;
}

// เพิ่มชื่อสิทธิ์มาตรฐานจาก "นามแฝง"
function applyAlias(inSet: Set<string>): Set<string> {
  const out = new Set<string>(inSet);
  const has = (k: string) => out.has(k);
  const add = (k: string) => out.add(k);

  // กลุ่ม Approvals
  if (has("approve")) add("approve_requests");
  if (has("reject")) add("review_requests");

  // ผู้ใช้/ผู้ดูแล
  if (has("manageusers")) add("manage_users");

  // Reports / Logs
  if (has("audit_log")) add("view_logs");
  if (has("view_reports")) add("view_reports");

  // Settings
  if (has("settings")) add("manage_settings");
  if (has("system_settings")) add("manage_settings");

  // Permits
  if (has("viewall")) add("view_permits");
  if (has("view_all")) add("view_permits");

  return out;
}

// รวมระเบียนที่เป็นอีเมลเดียวกัน → เลือก role ที่แรงสุด + รวม caps ทั้งหมด
function mergeMyRecords(all: AdminRecord[], myEmailLower: string) {
  const mine = all.filter(
    (r) => toLower(r.emailLower) === myEmailLower || toLower(r.email) === myEmailLower
  );
  if (mine.length === 0) return null;

  let bestRole: string | null = null;
  let bestRank = -1;
  const capUnion = new Set<string>();

  for (const rec of mine) {
    const r = (rec.role ?? "").toLowerCase().trim();
    const rr = roleRank(r);
    if (rr > bestRank) {
      bestRank = rr;
      bestRole = r || null;
    }
    const c = capsFromRecord(rec);
    c.forEach((x) => capUnion.add(x));
  }

  const finalCaps = applyAlias(capUnion);
  return { role: bestRole, caps: finalCaps };
}

// ---------------- New path: อ่านจาก Firebase ID Token (custom claims) ----------------
async function loadFromIdToken(user: any): Promise<{ role: string | null; caps: Set<string> } | null> {
  if (!user) return null;
  // force refresh = true เพื่อให้รับ claims ล่าสุดหลังมีการ set
  const tokenResult = await user.getIdTokenResult(true);
  const claims = (tokenResult?.claims || {}) as any;

  const role = (claims.role as string | undefined) || null;

  const capsSet = new Set<string>();
  const rawCaps = claims.caps as any;
  if (Array.isArray(rawCaps)) {
    rawCaps.forEach((c) => c && capsSet.add(String(c).toLowerCase().trim()));
  } else if (rawCaps && typeof rawCaps === "object") {
    for (const [k, v] of Object.entries(rawCaps)) {
      if (v) capsSet.add(k.toLowerCase().trim());
    }
  }

  const finalCaps = applyAlias(capsSet);

  if (!role && finalCaps.size === 0) return null; // ยังไม่มี claims
  return { role, caps: finalCaps };
}

// ---------------- Fallback #1: เรียก listAdmins ด้วย Authorization: Bearer ----------------
async function fetchAdminsWithAuth(user: any, requesterEmail: string): Promise<AdminRecord[]> {
  if (!LIST_URL) return [];
  const idToken = await user.getIdToken(/*force*/ true);
  const res = await fetch(LIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ requester: requesterEmail }),
  });
  if (!res.ok) throw new Error(String(res.status || "403"));
  const json = await res.json();
  return extractAdminsArray(json);
}

// ---------------- Fallback #2 (Phase 1): วิธีเดิม x-api-key + x-requester-email ----------------
async function fetchAdminsLegacy(requesterEmail: string): Promise<AdminRecord[]> {
  if (!LIST_URL) throw new Error("Missing VITE_LIST_ADMINS_URL");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-requester-email": requesterEmail,
  };
  if (APPROVER_KEY) headers["x-api-key"] = String(APPROVER_KEY);
  const res = await fetch(LIST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ requester: requesterEmail }),
  });
  if (!res.ok) throw new Error(String(res.status || "403"));
  const json = await res.json();
  return extractAdminsArray(json);
}

// แยก array จาก response รูปแบบต่าง ๆ
function extractAdminsArray(json: any): AdminRecord[] {
  const arr =
    (Array.isArray(json) && json) ||
    (Array.isArray(json?.items) && json.items) ||
    (Array.isArray(json?.data?.items) && json.data.items) ||
    (Array.isArray(json?.admins) && json.admins) ||
    (Array.isArray(json?.data) && json.data) ||
    [];
  return arr as AdminRecord[];
}

// ---------------- Main Hook ----------------
export default function useAuthzLive(): State {
  const [st, setSt] = useState<State>({ loading: true });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const user = await getCurrentUser();
        const email = user?.email || null;
        const emailLower = toLower(email);

        if (!email) {
          if (!alive) return;
          setSt({ loading: false, userEmail: null, role: null, caps: new Set() });
          return;
        }

        // 1) ทางหลัก: อ่านจาก ID Token (custom claims)
        let fromToken = await loadFromIdToken(user);

        // 2) ถ้ายังไม่มี claims → fallback เรียกด้วย Authorization: Bearer
        if (!fromToken) {
          try {
            const all = await fetchAdminsWithAuth(user, email);
            const merged = mergeMyRecords(all, emailLower);
            if (merged) fromToken = { role: merged.role ?? null, caps: merged.caps ?? new Set() };
          } catch {
            // 3) ถ้ายังไม่ได้ → fallback แบบ legacy ชั่วคราวช่วงย้ายระบบ
            try {
              const all2 = await fetchAdminsLegacy(email);
              const merged2 = mergeMyRecords(all2, emailLower);
              if (merged2) fromToken = { role: merged2.role ?? null, caps: merged2.caps ?? new Set() };
            } catch {}
          }
        }

        if (!alive) return;
        if (fromToken) {
          setSt({ loading: false, userEmail: email, role: fromToken.role, caps: fromToken.caps });
        } else {
          setSt({ loading: false, userEmail: email, role: null, caps: new Set(), error: "not_admin" });
        }
      } catch (e: any) {
        if (!alive) return;
        setSt({
          loading: false,
          error: String(e?.message || e),
          userEmail: null,
          role: null,
          caps: new Set(),
        });
      }
    })();

    return () => { alive = false; };
  }, []);

  return useMemo(() => st, [st]);
}

// ช็อตคัตสำหรับ component อื่น
export const canUse = (st: State, cap: string) =>
  can({ role: st.role, caps: st.caps }, cap);
export const canUseAny = (st: State, list: string[]) =>
  canAny({ role: st.role, caps: st.caps }, list);
export const canUseAll = (st: State, list: string[]) =>
  canAll({ role: st.role, caps: st.caps }, list);
