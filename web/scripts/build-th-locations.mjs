import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const inPath = path.resolve("./data/TH_LOC.ods");
if (!fs.existsSync(inPath)) {
  console.error("ไม่พบไฟล์", inPath, "กรุณาวาง TH_LOC.ods ในโฟลเดอร์ web/data/");
  process.exit(1);
}

const wb = xlsx.readFile(inPath);      // อ่านไฟล์ ODS
const sh = wb.Sheets[wb.SheetNames[0]];

// แปลงเป็น JSON: สมมติคอลัมน์เป็น Province / District / Subdistrict
const rows = xlsx.utils.sheet_to_json(sh, {
  header: ["Province", "District", "Subdistrict"],
  range: 1,           // ข้ามแถวหัวตาราง 1 แถว
  blankrows: false
});

// สร้างโครงสร้าง {จังหวัด:{อำเภอ:[ตำบล,...]}}
const map = {};
for (const r of rows) {
  const p = String(r.Province ?? "").trim();
  const d = String(r.District ?? "").trim();
  const s = String(r.Subdistrict ?? "").trim();
  if (!p || !d || !s) continue;
  map[p] ??= {};
  map[p][d] ??= [];
  if (!map[p][d].includes(s)) map[p][d].push(s);
}

// เขียนไฟล์ให้อยู่ใน public เพื่อให้เว็บโหลดได้
fs.mkdirSync("./public", { recursive: true });
const outPath = path.resolve("./public/thai-locations.min.json");
fs.writeFileSync(outPath, JSON.stringify(map), "utf8");

console.log("✅ สร้างไฟล์สำเร็จ:", outPath, "จำนวนจังหวัด:", Object.keys(map).length);
