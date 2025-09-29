// ======================================================================
// File: web/src/lib/apiClient.ts
// เวอร์ชัน: 25/09/2025 (Asia/Bangkok)
// หน้าที่: ตัวกลางเรียก API แบบรวมศูนย์
//          - แนบหัวข้อกลาง (Authorization, x-api-key, x-requester-email)
//          - รองรับ URL ตรง (absolute) และฐาน FUNCTIONS_BASE
//          - มี timeout/ยกเลิกคำขอ กันค้าง
// ปรับปรุง:
//   (1) เติม x-requester-email อัตโนมัติจากผู้ใช้ที่ล็อกอิน ถ้ายังไม่มี
//   (2) เพิ่ม options.requireFreshToken เพื่อบังคับรีเฟรช ID Token รอบล่าสุด
// หมายเหตุ: Firebase จะรีเฟรชโทเค็นให้อยู่แล้วเมื่อจำเป็น
// ======================================================================

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getApproverHeaders } from "./approverHeaders";

// ฐาน URL เรียกฟังก์ชัน (ถ้า path ไม่ใช่ http จะต่อท้าย BASE นี้)
const FUNCTIONS_BASE =
  (import.meta as any).env?.VITE_FUNCTIONS_BASE ??
  "https://asia-southeast1-work-permit-app-1e9f0.cloudfunctions.net";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, any>;
  body?: any;                // ถ้าเป็น FormData จะไม่ตั้ง Content-Type
  json?: any;                // ช่วยส่ง JSON ง่าย ๆ โดยไม่ต้องแปลงเอง
  requireAuth?: boolean;     // ค่าเริ่มต้น: true → ต้องมีโทเค็น
  requireFreshToken?: boolean; // ใหม่: true เพื่อบังคับรีเฟรชโทเค็นรอบล่าสุด
  timeoutMs?: number;        // ดีฟอลต์ 60000ms
  signal?: AbortSignal;      // ใช้ยกเลิกคำขอ
};

const DEFAULT_TIMEOUT_MS = 60_000;

// ----------------------------------------------------------------------
// รอผู้ใช้ล็อกอิน แล้วขอ ID Token ปัจจุบัน (SDK จะรีเฟรชอัตโนมัติเมื่อจำเป็น)
// [WHY] กันเคส requireAuth แต่ยังไม่ได้โทเค็น (หน้าเพิ่งโหลด/เพิ่งล็อกอิน)
// ----------------------------------------------------------------------
async function getIdTokenOrWait(timeoutMs = 10_000, forceRefresh = false): Promise<string> {
  const auth = getAuth();
  if (auth.currentUser) return auth.currentUser.getIdToken(forceRefresh);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("no_user"));
    }, timeoutMs);

    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        if (!u) return;
        clearTimeout(timer);
        unsub();
        try {
          const t = await u.getIdToken(forceRefresh);
          resolve(t);
        } catch (e) {
          reject(e);
        }
      },
      (err) => {
        clearTimeout(timer);
        unsub();
        reject(err);
      }
    );
  });
}

// คืนอีเมลผู้ใช้ (พิมพ์เล็ก) — ใช้เป็น fallback ให้ x-requester-email
function getSelfEmail(): string {
  const auth = getAuth();
  const direct = auth.currentUser?.email;
  const ls =
    (typeof localStorage !== "undefined" && (
      localStorage.getItem("admin_requester_email") ||
      localStorage.getItem("approver_email")
    )) || "";
  const envEmail = (import.meta as any).env?.VITE_APPROVER_EMAIL || "";
  return String(direct || ls || envEmail || "").toLowerCase();
}

// สร้าง URL: รองรับทั้ง path ภายใต้ BASE และ absolute URL (ขึ้นต้น http)
function buildUrl(path: string, query?: Record<string, any>) {
  const usp = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) {
        v.forEach((item) => usp.append(k, String(item)));
      } else {
        usp.append(k, String(v));
      }
    }
  }
  const q = usp.toString();
  if (/^https?:\/\//i.test(path)) return `${path}${q ? `?${q}` : ""}`;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${FUNCTIONS_BASE}${p}${q ? `?${q}` : ""}`;
}

// ----------------------------------------------------------------------
// ตัวเรียกหลัก: แนบเฮดเดอร์กลาง, คุมเวลา, แยก JSON/Text, โยน error อ่านง่าย
// ----------------------------------------------------------------------
export async function request<T>(
  pathOrUrl: string,
  options: ApiOptions = {}
): Promise<T> {
  const {
    method,
    headers = {},
    query,
    body,
    json,
    requireAuth = true,
    requireFreshToken = false, // ใหม่
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;

  const url = buildUrl(pathOrUrl, query);

  // 1) ส่วนหัวกลางจากอะแดปเตอร์ (Authorization, x-api-key, x-requester-email)
  let finalHeaders: Record<string, string> = { ...(await getApproverHeaders()) };

  // 1.1) ถ้ายังไม่มี x-requester-email ให้เติมจากผู้ใช้ที่ล็อกอิน (ลด unknown)
  if (!finalHeaders["x-requester-email"]) {
    const me = getSelfEmail();
    if (me) finalHeaders["x-requester-email"] = me;
  }

  // 2) ถ้าบังคับใช้สิทธิ์ และอยากได้โทเค็น “สดใหม่” ให้รีเฟรชก่อนยิง
  if (requireAuth) {
    // ถ้า caller ส่ง Authorization มาเอง จะไม่ทับ
    if (!("Authorization" in finalHeaders)) {
      const token = await getIdTokenOrWait(10_000, requireFreshToken);
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  // รวมส่วนหัวที่ส่งมาเพิ่มเติม (ผู้เรียกสามารถ override ได้เอง)
  finalHeaders = { ...finalHeaders, ...headers };

  // 3) จัดรูปแบบ body/Content-Type
  const init: RequestInit = {
    method: method ?? (json !== undefined || body !== undefined ? "POST" : "GET"),
    mode: "cors",
    credentials: "omit",
    headers: finalHeaders,
    signal,
  };

  if (json !== undefined) {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] ?? "application/json";
    init.body = typeof json === "string" ? json : JSON.stringify(json);
  } else if (body !== undefined && body !== null) {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    if (isFormData) {
      init.body = body; // อย่าตั้ง Content-Type เอง ให้ browser ใส่ boundary
    } else {
      finalHeaders["Content-Type"] = finalHeaders["Content-Type"] ?? "application/json";
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
  }

  // 4) คุมเวลา/ยกเลิก (กันค้าง)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (!init.signal) init.signal = controller.signal;

  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const text = await res.text();
    const data = isJson ? safeJson(text) : text;

    if (!res.ok || (isJson && data && (data as any).ok === false)) {
      const status = res.status;
      const msg =
        (isJson && (data as any)?.error) ||
        (isJson && (data as any)?.message) ||
        res.statusText ||
        "unknown_error";

      const err = new Error(`[${status}] ${msg}`);
      (err as any).status = status;
      (err as any).server = isJson ? data : { raw: text };
      throw err;
    }

    return (isJson ? (data as T) : (text as unknown as T));
  } finally {
    clearTimeout(timeout);
  }
}

function safeJson(s: string) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return { ok: false, error: "invalid_json", raw: s };
  }
}

// -------------------- รูปแบบข้อมูล (บางส่วน) --------------------

export interface RequestItem {
  rid: string;
  status: string;
  createdAt?: number | any;
  updatedAt?: any;
  contractorName?: string;
}

export interface ListRequestsResp {
  ok: true;
  data: { items: RequestItem[] };
}

// -------------------- API เฉพาะงาน (คงชื่อเดิม) --------------------

/** ดึงรายการคำขอ (ตัวอย่าง) */
export async function apiListRequests(params: { status?: string; limit?: number } = {}) {
  return request<ListRequestsResp>("/listRequests", {
    query: { status: params.status ?? "", limit: params.limit ?? 25 },
  });
}

/** ดึงรายละเอียดคำขอฝั่งแอดมิน */
export async function apiGetRequestAdmin(rid: string) {
  return request<any>("/getRequestAdmin", { query: { rid } });
}

/**
 * อัปเดตสถานะคำขอ — ให้ตรงกับ backend: { rid, status: 'approved'|'rejected', note? }
 * - รองรับส่งไปยัง absolute URL ผ่าน options.endpoint (เช่น VITE_UPDATE_STATUS_URL จาก Cloud Run)
 */
export async function apiUpdateStatus(opts: {
  rid: string;
  status: "approved" | "rejected";
  note?: string;
  endpoint?: string; // ถ้าระบุ จะเรียก URL นี้โดยตรง (ต้องรองรับ CORS เหมือนกัน)
  fresh?: boolean;   // ถ้าตั้ง true จะรีเฟรชโทเค็นก่อนยิง (กรณีเพิ่งอัปเดตสิทธิ์)
}) {
  const body = { rid: opts.rid, status: opts.status, note: opts.note };
  const pathOrUrl = opts.endpoint || "/updateStatus";
  return request<any>(pathOrUrl, { method: "POST", json: body, requireFreshToken: !!opts.fresh });
}

// -------------------- ตัวช่วยเพิ่มเติม (ทางเลือก; ไม่บังคับใช้) --------------------

export function getJson<T = any>(url: string, opts: Omit<ApiOptions, "method" | "body" | "json"> = {}) {
  return request<T>(url, { ...opts, method: "GET" });
}

export function postJson<T = any>(
  url: string,
  payload?: any,
  opts: Omit<ApiOptions, "method" | "body" | "json"> = {}
) {
  return request<T>(url, { ...opts, method: "POST", json: payload });
}

export function createApiClient(baseUrl = "") {
  const join = (path: string) =>
    baseUrl && !/^https?:\/\//i.test(path)
      ? `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
      : path;

  return {
    get: <T = any>(path: string, opts?: Omit<ApiOptions, "method" | "body" | "json">) =>
      getJson<T>(join(path), opts),
    post: <T = any>(path: string, payload?: any, opts?: Omit<ApiOptions, "method" | "body" | "json">) =>
      postJson<T>(join(path), payload, opts),
    fetch: <T = any>(path: string, opts?: ApiOptions) => request<T>(join(path), opts),
  };
}
