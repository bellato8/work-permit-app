// ======================================================================
// File: web/src/utils/formatters.ts
// เวอร์ชัน: 2025-09-21 23:35
// หน้าที่: ยูทิลแปลงวันเวลาและรูปแบบตัวอักษรสำหรับหน้า Logs/รายงาน
// เชื่อม auth ผ่าน "อะแดปเตอร์": ./lib/auth (ถ้าเกี่ยวข้อง)
// หมายเหตุ:
//  - ครอบคลุมรูปแบบเวลา: Firestore Timestamp (_seconds/_nanoseconds),
//    atMillis (number), สตริง "20 September 2025 at 17:45:16 UTC+7", ISO, ฯลฯ
//  - ใส่ พ.ศ. (ปีไทย) อัตโนมัติ
//  - คำอังกฤษ: normalize (นอ-มะ-ไลซ์) = ทำมาตรฐาน, fallback (ฟอล-แบ็ค) = สำรอง
// วันที่/เวลาแก้ล่าสุด: 21-09-2568 23:35
// ======================================================================

/** แปลงทุกอย่างให้เป็น milliseconds (ตัวเลข) เพื่อใช้งานต่อ */
export function toMillis(input: any): number {
  // 1) ถ้าเป็น number อยู่แล้ว (เช่น atMillis)
  if (typeof input === 'number' && isFinite(input)) return input;

  // 2) ถ้าเป็นอ็อบเจ็กต์ Timestamp แบบ Firestore { _seconds, _nanoseconds }
  if (input && typeof input === 'object') {
    if (typeof input._seconds === 'number') {
      const s = input._seconds as number;
      const ns = typeof input._nanoseconds === 'number' ? input._nanoseconds : 0;
      return Math.floor(s * 1000 + ns / 1_000_000);
    }
    // บางที field อยู่ใต้ชื่อ at เช่น { at: {_seconds,...} }
    if (input.at && typeof input.at === 'object' && typeof input.at._seconds === 'number') {
      const s = input.at._seconds as number;
      const ns = typeof input.at._nanoseconds === 'number' ? input.at._nanoseconds : 0;
      return Math.floor(s * 1000 + ns / 1_000_000);
    }
    // ถ้ามี atMillis อยู่ในอ็อบเจ็กต์
    if (typeof input.atMillis === 'number') return input.atMillis;
  }

  // 3) ถ้าเป็นสตริง → พยายาม normalize หลาย pattern
  if (typeof input === 'string') {
    const t = input.trim();

    // 3.1 ISO / Date.parse รองรับ
    const iso = Date.parse(t);
    if (!isNaN(iso)) return iso;

    // 3.2 รูปแบบ “… at HH:mm:ss UTC+7” จาก Firebase console
    //    ตัวอย่าง: "20 September 2025 at 17:45:16 UTC+7"
    const m = t.match(
      /^(\d{1,2}) ([A-Za-z]+) (\d{4}) at (\d{2}):(\d{2}):(\d{2}) UTC([+-]\d{1,2})$/
    );
    if (m) {
      const [, ddStr, monStr, yyyyStr, hhStr, miStr, ssStr, tzStr] = m;
      const day = Number(ddStr);
      const monthNames = [
        'january','february','march','april','may','june',
        'july','august','september','october','november','december'
      ];
      const month = monthNames.indexOf(monStr.toLowerCase());
      const year = Number(yyyyStr);
      const hh = Number(hhStr);
      const mm = Number(miStr);
      const ss = Number(ssStr);
      const tz = Number(tzStr); // เช่น +7

      // สร้างเวลาใน UTC แล้วบวก offset โซน
      const utc = Date.UTC(year, month, day, hh - tz, mm, ss);
      return utc;
    }

    // 3.3 รูปแบบไทยที่มี "UTC+7" แต่สลับคำ
    const m2 = t.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{2}):(\d{2}):(\d{2})(?:\s*UTC([+-]\d{1,2}))?$/
    );
    if (m2) {
      const [, d, mo, y, hh, mi, ss, tzStr2] = m2;
      const tz = tzStr2 ? Number(tzStr2) : 0;
      const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh) - tz, Number(mi), Number(ss));
      return utc;
    }
  }

  // 4) สุดท้าย: ถ้าทุกอย่างพัง ให้คืนเวลาปัจจุบัน (เพื่อกันล่ม) แต่ติดคอมเมนต์ว่า invalid
  //    แนะนำให้ log เตือนในคอนโซลของหน้า Admin
  console.warn('[toMillis] Unrecognized time format:', input);
  return Date.now();
}

/** แปลง millis → สตริงเวลาแบบไทย + พ.ศ. */
export function formatThaiDateTime(millis: number): string {
  const d = new Date(millis);
  // ปีไทย = ค.ศ. + 543
  const thaiYear = d.getFullYear() + 543;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dd = pad(d.getDate());
  const mo = pad(d.getMonth() + 1);
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${dd}/${mo}/${thaiYear} ${hh}:${mi}:${ss}`;
}

/** ตัดสตริงให้สั้นพร้อมจุดไข่ปลา */
export function ellipsis(text: string | undefined, max = 80): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
