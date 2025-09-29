// ======================================================================
// File: web/src/lib/validateEnv.ts
// เวอร์ชัน: 28/09/2025 16:27 (Asia/Bangkok)
// หน้าที่: ตรวจความพร้อมของค่า .env (URL/KEY) + มี fallback ไปอ่าน Local Storage
//           พร้อมคืนค่าแบบใช้งานง่าย และข้อความช่วยผู้ใช้เป็นภาษาไทย
// เชื่อม auth ผ่าน "อะแดปเตอร์": โค้ดนี้ไม่ยุ่งกับ token โดยตรง ใช้ได้ก่อนยิง API
// หมายเหตุ:
//  - ใช้ในหน้า Approvals/Permits/Logs ก่อนเริ่ม fetch
//  - ถ้า .env ว่าง ให้ลองอ่าน Local Storage: approver_key, list_url (เท่าที่ระบุไว้)
//  - ป้องกัน "ค่า placeholder" เช่น https://<cloud-run-url>/list ด้วยตัวตรวจ isPlaceholder()
// วิธีใช้ (อย่างย่อ):
//   import { validateAdminEnv } from '@/lib/validateEnv';
//   const check = validateAdminEnv();
//   if (!check.ok) return <YourAlertComponent messages={check.messages} />;
//   // แล้วใช้ check.env.<NAME> ในการยิง API
// ======================================================================

export type EnvCheck = {
  ok: boolean;
  errors: string[];
  messages: string[]; // สำหรับโชว์ผู้ใช้ (ภาษาไทย)
  env: Record<string, string>;
};

const REQUIRED_VARS = [
  'VITE_GET_REQUEST_ADMIN_URL',
  'VITE_LIST_REQUESTS_URL',
  'VITE_LIST_LOGS_URL',
  'VITE_UPDATE_STATUS_URL',
  'VITE_DECISION_PORTAL_URL',
  'VITE_LIST_ADMINS_URL',
  'VITE_ADD_ADMIN_URL',
  'VITE_UPDATE_ADMIN_ROLE_URL',
  'VITE_REMOVE_ADMIN_URL',
  'VITE_INVITE_ADMIN_URL',
];

const OPTIONAL_VARS = [
  'VITE_APPROVER_KEY',
  'VITE_APPROVER_EMAIL',
];

const LS_MAP: Record<string, string> = {
  // กำหนดเฉพาะคีย์ที่เราอนุญาตให้ fallback
  VITE_APPROVER_KEY: 'approver_key',
  VITE_LIST_REQUESTS_URL: 'list_url',
};

function readEnv(name: string): string | undefined {
  // Note: import.meta.env เป็น object แบบสแตติกตอน build
  const v = (import.meta as any).env?.[name] as string | undefined;
  if (v && !isPlaceholder(v)) return v.trim() || undefined;

  // fallback → Local Storage (เฉพาะคีย์ที่ระบุไว้ใน LS_MAP)
  const lsKey = LS_MAP[name];
  if (lsKey) {
    try {
      const ls = globalThis.localStorage?.getItem(lsKey);
      if (ls && !isPlaceholder(ls)) return ls.trim() || undefined;
    } catch {
      /* SSR/บางเบราว์เซอร์ที่บล็อก storage */
    }
  }
  return undefined;
}

function isPlaceholder(s?: string): boolean {
  if (!s) return true;
  const lower = s.toLowerCase();
  // จับเคสค่าตัวอย่างที่ชอบเผลอปล่อยขึ้นโปรดักชัน
  return (
    /<.+>/.test(s) ||
    lower.includes('example.com') ||
    lower.includes('<cloud-run-url>') ||
    /\[(url|key)\]/.test(lower)
  );
}

function isValidUrl(u?: string): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return !!url.protocol && !!url.host;
  } catch {
    return false;
  }
}

export function validateAdminEnv(): EnvCheck {
  const env: Record<string, string> = {};
  const errors: string[] = [];
  const messages: string[] = [];

  // ตรวจ REQUIRED
  for (const key of REQUIRED_VARS) {
    const val = readEnv(key);
    if (!val || !isValidUrl(val)) {
      errors.push(key);
    } else {
      env[key] = val;
    }
  }

  // ตรวจ OPTIONAL
  for (const key of OPTIONAL_VARS) {
    const val = readEnv(key);
    if (val) env[key] = val;
  }

  // ทำข้อความช่วย
  if (errors.length) {
    messages.push('⚠️ ระบบยังตั้งค่า URL/KEY ไม่ครบหรือไม่ถูกต้อง:');
    for (const e of errors) messages.push(`• ${e} — กรุณาใส่ในไฟล์ .env หรือ Local Storage`);

    messages.push('');
    messages.push('วิธีแก้แบบเร็ว (สำหรับทดสอบชั่วคราวในเบราว์เซอร์):');
    messages.push(`1) เปิด DevTools → Console แล้วพิมพ์`);
    messages.push(`   localStorage.setItem('approver_key', 'apl-2025')`);
    messages.push(`   localStorage.setItem('list_url', 'https://listrequests-xxxx.run.app')`);
    messages.push('2) รีเฟรชหน้าแล้วลองใหม่');
    messages.push('');
    messages.push('วิธีแก้ถาวร: เพิ่มค่าในไฟล์ web/.env.production แล้ว build/deploy ใหม่');
  }

  return {
    ok: errors.length === 0,
    errors,
    messages,
    env,
  };
}
