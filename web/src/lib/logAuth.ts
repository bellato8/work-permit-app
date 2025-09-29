/* ============================================================================
 * ไฟล์: web/src/lib/logAuth.ts
 * เวอร์ชัน: 2025-09-16
 * บทบาทไฟล์ (role): ตัวช่วย (helper) ฝั่งเว็บสำหรับบันทึกล็อกการยืนยันตัวตน
 * เปลี่ยนแปลงรอบนี้:
 *   • เพิ่มฟังก์ชัน logAuth(...) เรียก Cloud Run URL จาก ENV
 * คำสำคัญ (English → Thai/phonetic/meaning):
 *   • Helper (เฮลเปอร์) = โค้ดตัวช่วยที่เรียกใช้ซ้ำ
 *   • ENV (เอนฟ์) = ตัวแปรสภาพแวดล้อมที่ตั้งไว้ใน .env.local
 *   • Fetch (เฟทช์) = คำสั่งดึง/ส่งข้อมูลกับเว็บ API
 *   • Payload (เพย์โหลด) = ข้อมูล JSON ที่ส่งไปยัง API
 * หมายเหตุความปลอดภัย: ดึง URL จาก ENV เท่านั้น ห้ามฮาร์ดโค้ดคีย์จริง
 * ผู้เขียน: AI ผู้ช่วย (โหมดจับมือทำ)
 * ========================================================================== */

export type AuthLogKind = "login" | "logout" | "manual";

export interface AuthLogBody {
  kind: AuthLogKind;     // ประเภทเหตุการณ์ เช่น login/logout
  email?: string;        // อีเมลผู้ใช้ (ถ้ามี)
  uid?: string;          // Firebase UID (ถ้ามี)
  name?: string;         // ชื่อที่แสดง (ถ้ามี)
  note?: string;         // บันทึกเพิ่มเติม (ถ้ามี)
  at?: string;           // เวลา ISO (ถ้าไม่ส่ง จะเติมให้)
  ua?: string;           // User-Agent (ถ้าไม่ส่ง จะเติมให้)
}

export async function logAuth(
  body: AuthLogBody
): Promise<{ ok: boolean; status: number; error?: string }> {
  const url = (import.meta as any).env?.VITE_LOG_AUTH_URL as string | undefined;

  if (!url) {
    console.warn("[logAuth] missing VITE_LOG_AUTH_URL in .env.local");
    return { ok: false, status: 0, error: "VITE_LOG_AUTH_URL not set" };
  }

  const at = body.at ?? new Date().toISOString();
  const ua = body.ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "unknown");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // รวมค่าเวลาปัจจุบัน (at) และ user-agent (ua) ให้อัตโนมัติ
      body: JSON.stringify({ ...body, at, ua }),
      mode: "cors",
      credentials: "omit",
    });

    const status = res.status;

    if (!res.ok) {
      // อ่านข้อความผิดพลาดถ้ามี
      let msg = "";
      try {
        msg = await res.text();
      } catch {
        // ignore
      }
      return { ok: false, status, error: msg || `HTTP ${status}` };
    }

    // บางครั้ง backend อาจตอบเป็น JSON หรือเปล่า ๆ ก็ได้
    try {
      await res.json();
    } catch {
      // ไม่มี JSON ก็ไม่เป็นไร
    }

    return { ok: true, status };
  } catch (err: any) {
    return { ok: false, status: 0, error: String(err?.message ?? err) };
  }
}
