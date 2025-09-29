// ======================================================================
// File: web/src/lib/logAuthClient.ts
// เวอร์ชัน: 19/09/2025 05:10 (ปรับ de-dup ราย action: login=60s, logout/manual=5s)
// หน้าที่: เรียก Cloud Function logAuth (HTTP POST JSON) จากฝั่งเว็บแบบปลอดภัย
// เชื่อม auth ผ่าน: import.meta.env.VITE_LOG_AUTH_URL (ควรแนบ ?key=... ไว้แล้ว)
// หมายเหตุ:
//   - ใช้ sessionStorage กันยิงซ้ำ (ต่อแท็บ) ตาม Web Storage API
//   - POST JSON ด้วย fetch + Content-Type: application/json (ตาม MDN)
// ======================================================================

export type AuthAction = "login" | "logout" | "manual";

type LogAuthPayload = {
  action: AuthAction;
  requester: string;     // ผู้สั่งบันทึก (แอดมิน/ระบบ)
  email?: string;        // บัญชีที่เกี่ยวข้อง (เช่น account ที่เพิ่งล็อกอิน)
  name?: string;
  rid?: string;
  ip?: string;
  note?: string;
};

const URL = (import.meta.env.VITE_LOG_AUTH_URL as string) || "";
const ENV_REQUESTER =
  (import.meta.env.VITE_APPROVER_EMAIL as string) ||
  (typeof window !== "undefined" ? window.localStorage.getItem("approver_email") || "" : "");

/** อ่าน requester: จาก ENV ก่อน แล้วค่อยสำรอง localStorage */
function getRequester(): string {
  if (ENV_REQUESTER) return ENV_REQUESTER;
  if (typeof window === "undefined") return "";
  return (
    window.localStorage.getItem("requester") ||
    window.localStorage.getItem("admin_email") ||
    ""
  );
}

/** คำนวณ TTL ตาม action (ms) */
function ttlFor(action: AuthAction): number {
  if (action === "login") return 60_000; // 60s กัน spam จาก refresh
  return 5_000; // logout/manual: 5s
}

/** กันยิงซ้ำด้วย sessionStorage (ต่อแท็บ) */
function shouldSkipDuplicate(key: string, ttlMs: number): boolean {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      sessionStorage.setItem(key, String(now));
      return false;
    }
    const last = Number(raw);
    if (Number.isFinite(last) && now - last < ttlMs) {
      return true; // ยังไม่ครบเวลา: ข้าม
    }
    sessionStorage.setItem(key, String(now));
    return false;
  } catch {
    return false;
  }
}

/** ส่ง log ไปยังฟังก์ชัน — เงียบ error เพื่อไม่รบกวน UX */
export async function logAuthClient(payload: LogAuthPayload): Promise<void> {
  if (!URL) return; // ยังไม่ตั้งค่า URL = ไม่ทำอะไร
  const requester = payload.requester?.trim() || getRequester();
  if (!requester) return; // ต้องมี requester เสมอ

  // กุญแจกันซ้ำ: action + email (หรือ unknown)
  const who = payload.email?.trim() || "unknown";
  const key = `authlog:${payload.action}:${who}`;
  if (shouldSkipDuplicate(key, ttlFor(payload.action))) return;

  const body = {
    action: payload.action,
    requester,
    email: payload.email || "",
    name: payload.name || "",
    rid: payload.rid || "",
    ip: payload.ip || "",
    note: payload.note || "",
  };

  try {
    await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // MDN แนะนำระบุชนิดเนื้อหา
      },
      body: JSON.stringify(body),
    });
  } catch {
    // เงียบไว้ (หรือจะ console.debug เฉพาะ dev ก็ได้)
  }
}
