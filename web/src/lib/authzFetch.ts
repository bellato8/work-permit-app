// ======================================================================
// File: web/src/lib/authzFetch.ts
// เวอร์ชัน: 28/09/2025 10:35 (Asia/Bangkok)
// หน้าที่: ตัวช่วย fetch ที่ "แนบ ID Token อัตโนมัติ" + (เลือกได้) แนบ x-api-key / x-requester-email
// เชื่อม auth ผ่าน: (globalThis as any).__auth?.refresh() หรือ Firebase Auth currentUser.getIdToken(true)
// หมายเหตุ:
//  - Authorization = ส่วนหัวสำหรับยืนยันสิทธิ์
//  - Bearer <ID_TOKEN> = โทเค็นแบบผู้ถือสิทธิ์
//  - ID Token = โทเค็นของผู้ใช้จาก Firebase ใช้ฝั่งเซิร์ฟเวอร์ verifyIdToken()
//  - API keys ฝั่งเว็บของ Firebase ไม่ใช่ความลับ ควรใช้ร่วมกับการตรวจโทเค็น/สิทธิ์เสมอ
// ----------------------------------------------------------------------
// การแก้ไข:
//  - เลิก import ชนิด DebugAuthExports (ที่ไฟล์ auth.ts ไม่ได้ export) เพื่อกัน TS2305
//  - ไม่ augment `window` ในไฟล์นี้ เพื่อลดโอกาส TS2717; อ้างผ่าน (globalThis as any) แทน
//  - เปลี่ยนการเรียก refresh() ให้ไม่มีอาร์กิวเมนต์ (รองรับ signature เดิม)
//  - แก้ type ของ body ตอน POST JSON ให้เป็น string ชัดเจนก่อนส่ง
// ======================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAuth } from "firebase/auth";

type AuthzOptions = RequestInit & {
  withApiKey?: boolean;    // แนบ x-api-key จาก VITE_APPROVER_KEY หรือไม่
  withRequester?: boolean; // แนบ x-requester-email จาก user.email/ENV/localStorage หรือไม่
  json?: boolean;          // ถ้า true จะตั้ง Content-Type: application/json ให้อัตโนมัติ
};

// ดึง ID Token ล่าสุด (พยายามใช้ตัวช่วยเดิมก่อน แล้วค่อย fallback ไปที่ Firebase Auth)
async function getFreshIdToken(): Promise<{ token: string | null; email: string | null }> {
  try {
    // 1) ใช้ตัวช่วยเดิมของโปรเจกต์ (ถ้ามี)
    const w = (globalThis as any);
    if (w && w.__auth && typeof w.__auth.refresh === "function") {
      // รองรับ signature เดิมที่ไม่รับอาร์กิวเมนต์
      const t: string | null = await w.__auth.refresh();
      if (t) {
        const user = getAuth().currentUser;
        return { token: t, email: user?.email ?? null };
      }
    }

    // 2) Fallback: ใช้ Firebase Auth โดยตรง
    const auth = getAuth();
    if (auth?.currentUser) {
      const token = await auth.currentUser.getIdToken(true); // true = บังคับรีเฟรช
      return { token, email: auth.currentUser.email ?? null };
    }
  } catch (e) {
    console.warn("[authzFetch] getFreshIdToken error:", e);
  }
  return { token: null, email: null };
}

export async function authzFetch(input: RequestInfo | URL, init: AuthzOptions = {}) {
  const { withApiKey, withRequester, json, ...rest } = init;
  const headers = new Headers(rest.headers || {});

  // แนบ ID Token → Authorization: Bearer <token>
  const { token, email } = await getFreshIdToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // (ตัวเลือก) แนบคีย์ภายใน — อย่าใช้แทนการตรวจโทเค็น
  if (withApiKey) {
    const apiKey =
      (import.meta as any).env?.VITE_APPROVER_KEY ||
      localStorage.getItem("approver_key") ||
      "";
    if (apiKey && !headers.has("x-api-key")) headers.set("x-api-key", apiKey);
  }

  // (ตัวเลือก) แนบอีเมลผู้เรียก เพื่อความสะดวกฝั่ง Log/Audit
  if (withRequester) {
    const requester =
      email ||
      (import.meta as any).env?.VITE_APPROVER_EMAIL ||
      localStorage.getItem("approver_email") ||
      "";
    if (requester && !headers.has("x-requester-email")) {
      headers.set("x-requester-email", requester);
    }
  }

  // รองรับ body แบบ JSON อัตโนมัติเมื่อ json: true
  if (json) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    // ถ้า body เป็น object ให้ stringify (ถ้าเป็น string อยู่แล้วจะไม่ยุ่ง)
    if (rest.body && typeof rest.body === "object") {
      (rest as any).body = JSON.stringify(rest.body);
    }
  }

  return fetch(input, { ...rest, headers });
}

// ช็อตคัต: POST JSON ที่แนบโทเค็นให้เสร็จ
export async function authzPostJson(
  url: string,
  body: unknown,
  options: Omit<AuthzOptions, "method" | "body"> = {}
) {
  // จัด payload ให้เป็น string ชัดเจน + ตั้ง content-type ไว้ก่อน
  const payload = typeof body === "string" ? body : JSON.stringify(body ?? {});
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // ไม่ต้องส่ง { json: true } ซ้ำ เพราะเรา stringify แล้ว
  return authzFetch(url, { ...options, method: "POST", headers, body: payload });
}
