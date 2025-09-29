// ======================================================================
// ไฟล์: src/lib/locations.ts
// เวอร์ชัน: 2025-09-01
// จุดประสงค์: โหลดข้อมูลจังหวัด/อำเภอ/ตำบลจากไฟล์ JSON สาธารณะ
//              และ "รองรับทั้ง 2 รูปแบบการใช้งาน":
//              (A) แบบเก่า: รับ map เป็นอาร์กิวเมนต์
//              (B) แบบใหม่: ไม่ส่ง map -> ใช้ cache ภายใน
// ศัพท์:
// - fetch (เฟตช์) = ดึงไฟล์จากเซิร์ฟเวอร์
// - cache (แคช) = เก็บข้อมูลไว้ชั่วคราวกันดึงซ้ำ
// ======================================================================

export type ThaiLocations = Record<string, Record<string, string[]>>; 
// โครงสร้าง: { จังหวัด: { อำเภอ: [ตำบล, ...] } }

let cache: ThaiLocations | null = null;
let loading: Promise<ThaiLocations> | null = null;

/** โหลดข้อมูลจาก /thai-locations.min.json เพียงครั้งเดียวแล้วแคชไว้ */
export async function loadThaiLocations(): Promise<ThaiLocations> {
  if (cache) return cache;
  if (!loading) {
    loading = fetch("/thai-locations.min.json", { cache: "force-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("โหลดข้อมูลจังหวัดล้มเหลว");
        return r.json();
      })
      .then((data: unknown) => {
        // ตรวจรูปแบบคร่าว ๆ
        if (!data || typeof data !== "object") {
          throw new Error("รูปแบบข้อมูลจังหวัดไม่ถูกต้อง");
        }
        cache = data as ThaiLocations;
        return cache!;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

// --------------------------- ตัวช่วยแบบ "ไม่ต้องส่ง map" (สไตล์ใหม่) ---------------------------

/** รายชื่อจังหวัด (ดึงจาก cache ภายใน) */
export function listProvinces(): string[];
/** รายชื่อจังหวัด (รูปแบบเก่า: ส่ง map เข้ามา) */
export function listProvinces(map: ThaiLocations): string[];
export function listProvinces(arg1?: ThaiLocations): string[] {
  const m = arg1 ?? cache;
  return m ? Object.keys(m) : [];
}

/** รายชื่ออำเภอ
 *  - เรียกแบบใหม่: listDistricts("กรุงเทพมหานคร")
 *  - เรียกแบบเก่า: listDistricts(map, "กรุงเทพมหานคร")
 */
export function listDistricts(province: string): string[];
export function listDistricts(map: ThaiLocations, province?: string): string[];
export function listDistricts(arg1?: ThaiLocations | string, arg2?: string): string[] {
  let m: ThaiLocations | null;
  let province: string | undefined;
  if (typeof arg1 === "string") {
    m = cache;
    province = arg1;
  } else {
    m = arg1 ?? cache;
    province = arg2;
  }
  if (!m || !province || !m[province]) return [];
  return Object.keys(m[province]);
}

/** รายชื่อตำบล
 *  - แบบใหม่: listSubdistricts("กรุงเทพมหานคร","คลองเตย")
 *  - แบบเก่า: listSubdistricts(map, "กรุงเทพมหานคร","คลองเตย")
 */
export function listSubdistricts(province: string, district: string): string[];
export function listSubdistricts(map: ThaiLocations, province?: string, district?: string): string[];
export function listSubdistricts(
  arg1?: ThaiLocations | string,
  arg2?: string,
  arg3?: string
): string[] {
  let m: ThaiLocations | null;
  let province: string | undefined;
  let district: string | undefined;

  if (typeof arg1 === "string") {
    m = cache;
    province = arg1;
    district = arg2;
  } else {
    m = arg1 ?? cache;
    province = arg2;
    district = arg3;
  }
  if (!m || !province || !district || !m[province] || !m[province][district]) return [];
  return m[province][district];
}

/** ใช้ในกรณีทดสอบ/รีโหลดใหม่ */
export function _resetThaiLocationCache() {
  cache = null;
  loading = null;
}
