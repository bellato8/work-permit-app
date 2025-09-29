// ============================================================
// ไฟล์: web/src/utils/updateStatus.ts
// เวอร์ชัน: 2025-09-25
// เปลี่ยนแปลงหลัก:
//  - เดิมยิง fetch + แนบ header เอง  →  มาใช้ตัวกลาง request() จาก lib/apiClient
//  - ส่วนหัวมาตรฐาน (Authorization/x-api-key/x-requester-email) ให้ "อะแดปเตอร์" ดูแล
//  - คง toFriendlyMessage เดิม และหุ้ม error ของ request() ให้เป็นภาษาไทย
// ============================================================

import { request } from "../lib/apiClient"; // ✅ ตัวกลางเรียก API แบบรวมศูนย์

// ชนิดข้อมูล payload ที่ backend คาดหวัง
export type UpdatePayload = {
  rid: string;
  status: "approved" | "rejected";
  reason?: string; // ส่งเมื่อปฏิเสธ
};

// ปลายทางดีฟอลต์: ใช้ env ถ้ามี ไม่งั้นใช้ path ซึ่งจะถูกร้อยกับ FUNCTIONS_BASE โดย apiClient
const DEFAULT_ENDPOINT: string =
  (import.meta as any).env?.VITE_UPDATE_STATUS_URL || "/updateStatus";

/**
 * แปลงข้อความ error จาก server เป็นภาษาไทยที่อ่านง่าย
 * - รักษา logic เดิม
 */
function toFriendlyMessage(status: number, rawText: string): string {
  const t = (rawText || "").toLowerCase();

  // สิทธิ์/บทบาท
  if (status === 403 || t.includes("forbidden")) return "คุณไม่มีสิทธิ์อนุมัติคำขอนี้";
  if (t.includes("missing_required_caps")) return "บัญชีนี้ไม่มีสิทธิ์อนุมัติ/ไม่อนุมัติ";
  if (t.includes("not_approver")) return "คุณไม่ได้รับการแต่งตั้งเป็นผู้อนุมัติ";

  // การเข้าสู่ระบบ/โทเค็น
  if (status === 401) return "กรุณาเข้าสู่ระบบก่อนทำรายการ";
  if (t.includes("token expired")) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";

  // ความถูกต้องของข้อมูล
  if (status === 400 && t.includes("missing rid")) return "ขาดรหัสคำขอ (RID)";
  if (status === 400 && (t.includes("missing decision") || t.includes("status must be")))
    return "กรุณาเลือกผลการอนุมัติให้ถูกต้อง";
  if (status === 400 && t.includes("reason required")) return "กรุณาระบุเหตุผลในการไม่อนุมัติ";
  if (status === 400) return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่";

  // ไม่พบรายการ
  if (status === 404 || t.includes("not found")) return "ไม่พบคำขอที่ต้องการ";
  if (t.includes("request_id_invalid")) return "รหัสคำขอไม่ถูกต้อง";

  // สถานะที่ถูกดำเนินการไปแล้ว
  if (t.includes("already approved")) return "คำขอนี้ได้รับการอนุมัติไปแล้ว";
  if (t.includes("already rejected")) return "คำขอนี้ถูกปฏิเสธไปแล้ว";
  if (t.includes("already processed")) return "คำขอนี้ดำเนินการไปแล้ว";

  // ระบบล้มเหลว/ชั่วคราว
  if (status === 503) return "ระบบไม่พร้อมให้บริการชั่วคราว";
  if (status >= 500) return "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง";

  // เครือข่ายช้า/ค้าง
  if (t.includes("timeout")) return "ใช้เวลานานเกินไป กรุณาลองใหม่";

  // ดีฟอลต์
  return `ไม่สามารถทำรายการได้ (รหัส ${status})`;
}

/**
 * รวมข้อความดิบจาก error ของตัวกลาง request() เพื่อส่งเข้า toFriendlyMessage
 * - request() จะโยน Error ที่แนบ { status, server } มาให้
 */
function extractServerText(err: any): { status: number; text: string } {
  const status = Number(err?.status ?? 0);

  // โครงที่ request() เซ็ตไว้: server = JSON | { raw: string }
  const s = err?.server;
  if (!s) {
    // บางกรณีอาจมี message เดียว ๆ
    return { status: status || 500, text: String(err?.message ?? "") };
  }

  if (typeof s === "string") return { status: status || 500, text: s };

  // พยายามหยิบฟิลด์ที่สื่อความหมายจาก JSON error ที่ backend ส่งมา
  const text =
    (s?.error && String(s.error)) ||
    (s?.message && String(s.message)) ||
    (s?.raw && String(s.raw)) ||
    "";

  return { status: status || 500, text };
}

/**
 * เรียกอนุมัติ/ไม่อนุมัติ
 * - ใช้ตัวกลาง request() เพื่อให้ส่วนหัวมาตรฐานถูกแนบให้อัตโนมัติ
 * - ถ้าอยากชี้ปลายทางเฉพาะกิจ ให้ส่ง opts.endpoint (absolute URL ก็ได้)
 */
export async function updateStatusApi(
  payload: UpdatePayload,
  opts: { endpoint?: string } = {}
) {
  const endpoint = opts.endpoint || DEFAULT_ENDPOINT;

  try {
    // ใช้ method: POST + json: payload
    // หมายเหตุ: request() จะเติม Content-Type ให้อัตโนมัติถ้าใช้ json
    // และถ้า requireAuth (default: true) จะดูแลเรื่อง ID Token ให้เอง
    const resp = await request<any>(endpoint, {
      method: "POST",
      json: payload,
    });
    return resp; // JSON ที่ backend ส่งกลับ
  } catch (err: any) {
    // แปลงรายละเอียด error → ภาษาไทย
    const { status, text } = extractServerText(err);
    throw new Error(toFriendlyMessage(status, text));
  }
}
