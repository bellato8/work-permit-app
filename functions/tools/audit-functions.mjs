// functions/tools/audit-functions.mjs
// สแกนรายชื่อฟังก์ชันใน src เทียบกับ lib/index.js แล้วสรุปว่าอะไรใช้/ไม่ใช้

import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const functionsRoot = path.resolve(__dirname, "..");           // .../functions
const srcDir       = path.join(functionsRoot, "src");
const libIndexJs   = path.join(functionsRoot, "lib", "index.js");

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}
function listFilesRecursive(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}
function isBackupOrJunk(file) {
  const name = path.basename(file).toLowerCase();
  return (
    name.endsWith(".bak") ||
    name.includes(" copy") ||
    name.includes("copy.ts") ||
    name.includes(".swp") ||
    name.startsWith(".") ||
    name === "index.ts" // index.ts มักแค่ re-export ไม่ใช่ตัวประกาศจริง
  );
}
function parseExportedNamesFromTs(source) {
  const names = new Set();

  // export const myFn = onRequest(...
  for (const m of source.matchAll(/\bexport\s+const\s+([A-Za-z0-9_]+)\s*=\s*onRequest\b/g)) {
    names.add(m[1]);
  }

  // เผื่อบางไฟล์ export const X = ... (ไม่ใช่ onRequest)
  for (const m of source.matchAll(/\bexport\s+const\s+([A-Za-z0-9_]+)\s*=/g)) {
    names.add(m[1]);
  }

  // export function myFn ( ... )
  for (const m of source.matchAll(/\bexport\s+function\s+([A-Za-z0-9_]+)\s*\(/g)) {
    names.add(m[1]);
  }

  // export { a, b as c } from "./x"
  for (const m of source.matchAll(/\bexport\s*\{\s*([^}]+)\s*\}\s*from\s*['"][^'"]+['"]/g)) {
    const inside = m[1];
    inside.split(",").forEach(seg => {
      const n = seg.split(/\s+as\s+/i)[1]?.trim() || seg.trim();
      if (n) names.add(n);
    });
  }

  return names;
}

function getDeclaredFromSrc() {
  const files = listFilesRecursive(srcDir)
    .filter(f => f.endsWith(".ts"))
    .filter(f => !isBackupOrJunk(f));

  const byFile = new Map();
  const all = new Set();

  for (const f of files) {
    const code = readFileSafe(f);
    const names = parseExportedNamesFromTs(code);
    if (names.size) {
      byFile.set(f, [...names].sort());
      for (const n of names) all.add(n);
    }
  }
  return { byFile, all };
}

function getExportedFromLibIndex() {
  // ใช้ require แบบ CJS กับ lib/index.js ที่คอมไพล์แล้ว (CommonJS)
  // หาก error แปลว่า build ยังไม่เสร็จ ให้รัน npm run build ก่อน
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(path.resolve(libIndexJs));
  return new Set(Object.keys(mod || {}));
}

function main() {
  if (!fs.existsSync(libIndexJs)) {
    console.error(`❌ ไม่พบ ${libIndexJs} — รัน "npm run build" ที่โฟลเดอร์ functions ก่อน`);
    process.exit(1);
  }

  const { byFile, all: declared } = getDeclaredFromSrc();
  const exported = getExportedFromLibIndex();

  const declaredNotExported = [...declared].filter(n => !exported.has(n)).sort();
  const exportedButNoSource = [...exported].filter(n => !declared.has(n)).sort();

  console.log("📦 lib/index.js (จะถูก deploy) มี exports ทั้งหมด:", exported.size);
  console.log("📝 src/*.ts (ที่ประกาศจริง) มีชื่อฟังก์ชันทั้งหมด:", declared.size);
  console.log("");

  console.log("== รายชื่อไฟล์ต้นทางและชื่อที่ export ภายในไฟล์ ==");
  for (const [file, names] of [...byFile.entries()].sort()) {
    console.log(" •", path.relative(functionsRoot, file));
    console.log("    →", names.join(", "));
  }
  console.log("");

  console.log("== รายการ ‘ประกาศไว้ แต่ไม่ถูก export’ (น่าจะไม่ถูก deploy/อาจเป็นของซ้ำ) ==");
  if (declaredNotExported.length) {
    for (const n of declaredNotExported) console.log(" -", n);
  } else {
    console.log(" (ว่าง) ✅");
  }
  console.log("");

  console.log("== รายการ ‘ถูก export แต่หาไฟล์ต้นทาง (src) ไม่เจอ’ ==");
  if (exportedButNoSource.length) {
    for (const n of exportedButNoSource) console.log(" -", n);
  } else {
    console.log(" (ว่าง) ✅");
  }
  console.log("");

  // แถม: คำสั่ง deploy เฉพาะสิ่งที่ถูก export จริง
  const only = [...exported].sort().map(n => `functions:${n}`).join(",");
  console.log("👉 คำสั่ง deploy จากของที่ export จริง:");
  console.log(`firebase deploy --only ${only}`);
  console.log("");

  // แถม: สรุป 4 ตัวหลักสำหรับหน้า Users (ถ้ามี)
  const likely = ["proxyListAdmins", "updateAdminRole", "removeAdmin", "inviteAdmin"]
    .filter(n => exported.has(n));
  if (likely.length) {
    console.log("✨ ชุดที่หน้า Users ใช้บ่อย:");
    console.log("firebase deploy --only " + likely.map(n => `functions:${n}`).join(","));
  }
}

main();
