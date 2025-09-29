// ======================================================================
// File: web/src/utils/getStatus.ts
// วันที่/เวลา: 2025-09-11 23:05
// ผู้เขียน: AI + สุทธิรักษ์ วิเชียรศรี
// หน้าที่: ตัวช่วยเรียก Cloud Function getStatus (หน้า /status ใช้ได้)
// หมายเหตุ: ขยาย type ให้รองรับ decision/rejectionReason (คงรูปแบบคืนค่าเดิม: ok/data)
// ======================================================================

import type {
  GetStatusApiResponse,
} from "../types";

function ensureEnvUrl(): string {
  const url = import.meta.env.VITE_GET_STATUS_URL as string | undefined;
  if (!url) {
    throw new Error(
      "ไม่พบค่า VITE_GET_STATUS_URL ในไฟล์ .env.local — โปรดตั้งค่า URL ฟังก์ชัน getStatus ก่อน"
    );
  }
  return url.trim();
}

/**
 * เรียก Cloud Function: getStatus (คืนค่าเป็น { ok, data? | error })
 * @param rid   รหัสคำขอ
 * @param last4 เบอร์โทร 4 ตัวท้าย
 */
export async function getStatusByRidLast4(
  rid: string,
  last4: string
): Promise<GetStatusApiResponse> {
  const base = ensureEnvUrl();
  const qs =
    `?rid=${encodeURIComponent(rid || "")}` +
    `&last4=${encodeURIComponent((last4 || "").replace(/\D/g, "").slice(0, 4))}`;
  const url = base.endsWith("/") ? `${base.slice(0, -1)}${qs}` : `${base}${qs}`;

  try {
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    let body: any = null;
    try { body = await res.json(); } catch { body = null; }

    if (!res.ok || !body) {
      return { ok: false, error: body?.error || `fetch failed with status ${res.status}` };
    }
    return body as GetStatusApiResponse;
  } catch (e: any) {
    return { ok: false, error: e?.message || "network-error" };
  }
}
