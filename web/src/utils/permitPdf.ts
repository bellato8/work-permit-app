// ======================================================================
// File: web/src/utils/permitPdf.ts
// วันที่/เวลา: 2025-09-13 10:15
// ผู้เขียน: AI + สุทธิรักษ์ วิเชียรศรี
// หน้าที่: สร้าง PDF ใบอนุญาตเข้าทำงาน (Work Permit) จาก payload API
// หมายเหตุ (รุ่นนี้):
//   • แก้ "วันที่:" ให้ดึงได้จริง ด้วย pickNonBlank() + fallback หลายแหล่ง
//       1) dateFrom/dateTo
//       2) work.from/work.to หรือ location.from/location.to (ISO/Timestamp)
//       3) ตีความจาก RID รูปแบบ WP-YYYYMMDD-XXXX
//       4) ถ้ายังไม่พบ ใช้ updatedAt เป็นตัวสุดท้าย
//   • ปรับกล่องลายเซ็น: คำนวณความกว้างจากขอบซ้ายของ QR โดยตรง
//       - รับประกันไม่ชน QR (rightEdge <= rightLimitX)
//       - กล่อง "เวลาเข้า-ออก" มีขั้นต่ำ ~220pt และกว้างกว่ากล่องอื่น
//   • แสดง "อุปกรณ์นำเข้า-ออก" ตาม payload จริง (ไม่ซ่อน)
//   • คงนโยบาย: "ที่ตั้งงาน" ไม่แสดงใน PDF (ตามคำสั่งก่อนหน้า)
// ======================================================================

import { jsPDF } from "jspdf";
import QRCode from "qrcode";

import NotoRegularUrl from "../assets/fonts/NotoSansThai-Regular.ttf?url";
import NotoBoldUrl    from "../assets/fonts/NotoSansThai-Bold.ttf?url";
import SarabunRegularUrl from "../assets/fonts/Sarabun-Regular.ttf?url";
import SarabunBoldUrl    from "../assets/fonts/Sarabun-Bold.ttf?url";

export const PERMIT_PDF_VERSION = "2025-09-13-date-fallback+no-QR-overlap+r1";

// ---------------- สวิตช์นโยบาย ----------------
const REMOVE_SITE_ADDRESS_FIELD = true; // ซ่อน "ที่ตั้งงาน"

// ---------------- ฟอนต์ไทย ----------------
const FONT_NAME = "NotoSansThai";
const FALLBACK_FONT_NAME = "Sarabun";
let CURRENT_FONT = FONT_NAME;

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`โหลดฟอนต์ไม่สำเร็จ: ${url}`);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(bin);
}
async function tryLoadFont(doc: jsPDF, regularUrl: string, boldUrl: string, familyName: string) {
  try {
    const [regB64, boldB64] = await Promise.all([
      fetchFontBase64(regularUrl),
      fetchFontBase64(boldUrl),
    ]);
    doc.addFileToVFS(`${familyName}-Regular.ttf`, regB64);
    doc.addFileToVFS(`${familyName}-Bold.ttf`, boldB64);
    doc.addFont(`${familyName}-Regular.ttf`, familyName, "normal");
    doc.addFont(`${familyName}-Bold.ttf`, familyName, "bold");
    CURRENT_FONT = familyName;
    doc.setFont(CURRENT_FONT, "normal");
    return true;
  } catch { return false; }
}
async function ensureThaiFonts(doc: jsPDF) {
  if (await tryLoadFont(doc, NotoRegularUrl, NotoBoldUrl, FONT_NAME)) return;
  if (await tryLoadFont(doc, SarabunRegularUrl, SarabunBoldUrl, FALLBACK_FONT_NAME)) return;
  alert("โหลดฟอนต์ไทยไม่สำเร็จ: ตรวจไฟล์ฟอนต์ใน web/src/assets/fonts/");
}

// ---------------- layout helpers ----------------
const MARGIN_L = 40, MARGIN_R = 40, LINE_H = 16, AFTER_SECTION_GAP = 14;
const QR_SIDE = 110, QR_GAP_LEFT = 20; // ระยะกันชนซ้ายของ QR
const MIN_TIME_BOX_W = 220;            // ขั้นต่ำช่อง "เวลาเข้า-ออก"

const pageW = (doc: jsPDF) => (doc.internal as any).pageSize.getWidth();
const pageH = (doc: jsPDF) => (doc.internal as any).pageSize.getHeight();

function ensureSpace(doc: jsPDF, y: number, need: number) {
  const bottom = pageH(doc) - 170;
  if (y + need > bottom) { doc.addPage(); return 60; }
  return y;
}
function sectionHeading(doc: jsPDF, y: number, text: string) {
  y = ensureSpace(doc, y, LINE_H + AFTER_SECTION_GAP + 6);
  doc.setFont(CURRENT_FONT, "bold"); doc.setFontSize(13);
  doc.text(text, MARGIN_L, y);
  doc.setDrawColor(220); doc.setLineWidth(0.8);
  doc.line(MARGIN_L, y + 4, pageW(doc) - MARGIN_R, y + 4);
  doc.setFont(CURRENT_FONT, "normal"); doc.setFontSize(12);
  return y + AFTER_SECTION_GAP + LINE_H;
}
function rowKV(doc: jsPDF, y: number, key: string, val: string) {
  const labelX = MARGIN_L;
  doc.setFont(CURRENT_FONT, "normal"); doc.setFontSize(12);
  const measured = doc.getTextWidth(key) + 8;
  const minLabelW = 120;
  const maxLabelW = Math.min(pageW(doc) - MARGIN_R - labelX - 160, 260);
  const labelW = Math.min(Math.max(minLabelW, measured), maxLabelW);
  const valueX = labelX + labelW;

  const maxW = pageW(doc) - MARGIN_R - valueX;
  const text = (val ?? "").toString().trim() || "-";
  const lines = doc.splitTextToSize(text, maxW) as string[];
  const need = Math.max(LINE_H, lines.length * LINE_H);

  y = ensureSpace(doc, y, need + 6);
  doc.setTextColor(60);  doc.text(key, labelX, y);
  doc.setTextColor(0);   doc.text(lines, valueX, y);
  return y + need + 6;
}
const rowMultiline = rowKV;

function drawDiagonalStamp(doc: jsPDF, text = "อนุมัติแล้ว") {
  const w = pageW(doc), h = pageH(doc);
  (doc as any).saveGraphicsState?.();
  doc.setTextColor(220, 38, 38);
  doc.setFont(CURRENT_FONT, "bold"); doc.setFontSize(48);
  if ((doc as any).GState) doc.setGState(new (doc as any).GState({ opacity: 0.22 }));
  doc.text(text, w / 2, h / 2, { align: "center", angle: 45 });
  (doc as any).restoreGraphicsState?.();
}

/** วาดกล่องลายเซ็น 3 ช่อง โดยรับขอบขวาสูงสุด (rightLimitX) เพื่อกันชน QR */
function drawSignatureBoxes(doc: jsPDF, y: number, rightLimitX: number) {
  const minY = pageH(doc) - 130;
  y = Math.max(y + 16, minY);

  const gap = 12, boxH = 32;
  // พื้นที่ใช้งานจริงจากซ้ายถึง "ขอบซ้ายของ QR - กันชน"
  const usableW = rightLimitX - MARGIN_L;

  // แบ่งสัดส่วน: ช่อง 1 ~28%, ช่อง 2 ~28%, ช่อง 3 = ที่เหลือ (>= MIN_TIME_BOX_W)
  const baseW = usableW - 2 * gap;
  let boxW1 = Math.max(120, Math.floor(baseW * 0.28));
  let boxW2 = Math.max(120, Math.floor(baseW * 0.28));
  let boxW3 = Math.max(MIN_TIME_BOX_W, baseW - boxW1 - boxW2);

  // ถ้า boxW3 โตไปชนขอบ ให้ถอยตามพื้นที่จริง
  const total = boxW1 + gap + boxW2 + gap + boxW3;
  if (total > usableW) {
    const overflow = total - usableW;
    // ลดจากกล่อง 1 และ 2 ก่อน (เท่า ๆ กัน)
    const cut12 = Math.min(overflow, (boxW1 - 120) + (boxW2 - 120));
    const cut1 = Math.min(boxW1 - 120, Math.floor(cut12 / 2));
    const cut2 = Math.min(boxW2 - 120, cut12 - cut1);
    boxW1 -= cut1; boxW2 -= cut2;
    // ถ้ายังล้น ให้ลดกล่อง 3 แต่ไม่ต่ำกว่า MIN_TIME_BOX_W
    const remain = (boxW1 + gap + boxW2 + gap + boxW3) - usableW;
    if (remain > 0) boxW3 = Math.max(MIN_TIME_BOX_W, boxW3 - remain);
  }

  const x1 = MARGIN_L;
  const x2 = x1 + boxW1 + gap;
  const x3 = x2 + boxW2 + gap;

  doc.setDrawColor(160); doc.setLineWidth(0.5);
  doc.setFont(CURRENT_FONT, "normal"); doc.setFontSize(11);
  doc.text("ผู้อนุมัติ", x1 + 2, y - 4);
  doc.text("รปภ.",     x2 + 2, y - 4);
  doc.text("เวลาเข้า-ออก", x3 + 2, y - 4);

  doc.rect(x1, y, boxW1, boxH);
  doc.rect(x2, y, boxW2, boxH);
  doc.rect(x3, y, boxW3, boxH);

  return y + boxH + 16;
}

// ---------------- utils ----------------
const ensureArray = (x: any): any[] => (Array.isArray(x) ? x : (x ? [x] : []));
const isBlank = (v: any) => v == null || (typeof v === "string" && v.trim() === "");
const pickNonBlank = (...vals: any[]) => {
  for (const v of vals) { if (!isBlank(v)) return v; }
  return undefined;
};
const listToText = (list: any, sep = ", ") => {
  if (Array.isArray(list)) return list.filter(Boolean).map(String).join(sep) || "-";
  if (list == null) return "-";
  return String(list);
};
function hotWorkText(v: any): string {
  const s = String(v ?? "").trim();
  if (!s) return "-";
  if (["มี","yes","true","1","hot","hotwork"].includes(s.toLowerCase())) return "มี";
  if (["ไม่มี","no","false","0"].includes(s.toLowerCase())) return "ไม่มี";
  return s;
}
function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}
function toDateObj(v: any): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  // Firestore Timestamp JSON {_seconds,_nanoseconds} หรือ {seconds,nanoseconds}
  const sec = v?._seconds ?? v?.seconds;
  if (typeof sec === "number") {
    const d = new Date(sec * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  // epoch ms number
  if (typeof v === "number" && isFinite(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  // string: ISO / YYYY-MM-DD / YYYY-MM-DDThh:mm
  if (typeof v === "string") {
    const m = v.match(/\d{4}-\d{2}-\d{2}/);
    if (m) {
      const d = new Date(m[0]);
      return isNaN(d.getTime()) ? null : d;
    }
    const d2 = new Date(v);
    return isNaN(d2.getTime()) ? null : d2;
  }
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}
function toDateText(v: any): string {
  const d = toDateObj(v);
  return d ? fmtDate(d) : "-";
}
function dateFromRid(rid: string): Date | null {
  const m = String(rid || "").match(/(\d{8})/); // ดึง YYYYMMDD
  if (!m) return null;
  const y = Number(m[1].slice(0,4));
  const mo = Number(m[1].slice(4,6)) - 1;
  const d = Number(m[1].slice(6,8));
  const date = new Date(y, mo, d);
  return isNaN(date.getTime()) ? null : date;
}
function toTimeText(v: any): string {
  if (!v && v !== 0) return "-";
  if (typeof v === "string") {
    const m = v.match(/(\d{2}):(\d{2})/);
    if (m) return m[0];
  }
  const sec = v?._seconds ?? v?.seconds;
  if (typeof sec === "number") {
    const d = new Date(sec * 1000);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  try { return String(v); } catch { return "-"; }
}

// ---- อุปกรณ์: รองรับหลายรูปแบบ และเรนเดอร์ให้เป็นข้อความอ่านง่าย ----
function renderEquipmentItem(obj: any): string {
  if (obj == null) return "";
  if (typeof obj === "string") return obj.trim();
  const name = obj.name ?? obj.title ?? obj.label ?? obj.item ?? "";
  const qty  = obj.qty ?? obj.quantity ?? obj.amount ?? obj.count ?? "";
  const unit = obj.unit ?? obj.uom ?? "";
  const note = obj.note ?? obj.details ?? obj.remark ?? obj.desc ?? "";
  const namePart = String(name || "").trim();
  const qtyPart  = (qty !== "" && qty != null) ? ` x${qty}` : "";
  const unitPart = unit ? ` ${unit}` : "";
  const notePart = note ? ` (${String(note)})` : "";
  const out = `${namePart}${qtyPart}${unitPart}${notePart}`.trim();
  return out || "";
}
function renderEquipmentList(value: any): string {
  if (value == null) return "-";
  if (typeof value === "string") return value.trim() || "-";
  if (Array.isArray(value)) {
    const parts = value.map((it) => renderEquipmentItem(it)).filter(Boolean);
    return parts.length ? parts.join(", ") : "-";
  }
  const items = ensureArray(value.items).map(renderEquipmentItem).filter(Boolean);
  const details = value.details ? String(value.details) : "";
  const joined = [details, items.join(", ")].filter(Boolean).join(" • ");
  return joined || "-";
}
function getEquipmentText(d: any): string {
  const candidates = [
    d.equipmentList,
    d.work?.equipmentList,
    d.equipmentItems,
    d.work?.equipmentItems,
    d.equipments,
    d.work?.equipments,
  ];
  for (const c of candidates) {
    const s = renderEquipmentList(c);
    if (s !== "-") return s;
  }
  const eq = d.equipments || d.work?.equipments;
  if (eq?.has === false || String(eq?.has).trim() === "ไม่มี") return "ไม่มี";
  return "-";
}

/** คืนรายชื่อทีมงานเป็นข้อความหลายบรรทัด + จำนวนทีมงาน */
function buildTeamInfo(d: any): { lines: string; count: number } {
  let names: string[] = Array.isArray(d.teamNames) ? d.teamNames.filter(Boolean) : [];
  const workersFromWork = ensureArray(d.work?.workers);
  const workersFromRoot = ensureArray(d.workers);
  const teamLegacy      = ensureArray(d.team);

  if (!names.length && workersFromWork.length) {
    names = workersFromWork.map((w: any) => (w?.name || "-") + (w?.isSupervisor ? " (ผู้ควบคุมงาน)" : "")).filter(Boolean);
  }
  if (!names.length && workersFromRoot.length) {
    names = workersFromRoot.map((w: any) => (w?.name || "-") + (w?.isSupervisor ? " (ผู้ควบคุมงาน)" : "")).filter(Boolean);
  }
  if (!names.length && teamLegacy.length) {
    names = teamLegacy.map((m: any) => (m?.name || "-") + (m?.isSupervisor ? " (ผู้ควบคุมงาน)" : "")).filter(Boolean);
  }

  const count =
    typeof d.teamCount === "number" && Number.isFinite(d.teamCount)
      ? d.teamCount
      : (Array.isArray(d.teamNames) && d.teamNames.length)
      ? d.teamNames.length
      : workersFromWork.length || workersFromRoot.length || teamLegacy.length || 0;

  const lines = names.length ? names.map((n, i) => `• ${i + 1}. ${n}`).join("\n") : "-";
  return { lines, count };
}

// ---------------- core: สร้าง PDF ----------------
export async function generatePermitPDF(apiPayload: any) {
  console.info("[permitPdf] version =", PERMIT_PDF_VERSION);
  const d = apiPayload?.data ?? apiPayload ?? {};

  // id & status
  const rid: string = d.rid || d.requestId || "-";
  const status: string = d.status || "-";

  // ผู้ยื่น
  const requester = d.requester || {};
  const title = requester.title || d.contractorTitle || "";
  const fullname = requester.fullname || d.contractorName || d.requesterName || "-";
  const company = d.company || requester.company || "-";
  const requesterPhone = d.phone || requester.phone || d.contactPhone || "-";
  const requesterEmail = d.email || requester.email || d.contactEmail || "-";
  const citizenMasked = requester.citizenIdMasked || d.citizenIdMasked || "-";

  // งาน/สถานที่/เวลา
  const area  = d.area || d.location?.area || d.work?.area || "-";
  const floor = d.floorLabel || d.floor || d.location?.floor || d.work?.floor || "-";
  const jobType = d.jobType || d.workType || d.work?.type || d.location?.type || "-";

  // วันที่ + เวลา (ใช้ pickNonBlank เพื่อข้ามค่าว่าง "")
  const rawDateFrom = pickNonBlank(d.dateFrom, d.work?.dateFrom, d.work?.from, d.location?.from, d.from);
  const rawDateTo   = pickNonBlank(d.dateTo,   d.work?.dateTo,   d.work?.to,   d.location?.to,   d.to);

  // ถ้าไม่มีวันเลย ลองเดาจาก RID ก่อน แล้วค่อย updatedAt
  const ridDate = dateFromRid(rid);
  const fallbackDate = ridDate || toDateObj(d.updatedAt);

  const dateFrom = toDateText(rawDateFrom ?? fallbackDate);
  const dateTo   = toDateText(rawDateTo   ?? fallbackDate);

  // เวลา (ยังคงใช้รูปแบบเดิมที่รองรับ string/Firestore timestamp)
  const timeFrom = d.timeFrom || toTimeText(d.timeStart) || toTimeText(d.work?.from);
  const timeTo   = d.timeTo   || toTimeText(d.timeEnd)   || toTimeText(d.location?.to) || toTimeText(d.work?.to);

  // ที่อยู่สถานที่ทำงาน (เก็บไว้ แต่ไม่แสดงถ้า REMOVE_SITE_ADDRESS_FIELD = true)
  const loc = d.location || d.work?.location || {};
  const siteAddressLine =
    loc.addressLine ||
    d.address ||
    [loc.detail, loc.subdistrict, loc.district, loc.province].filter(Boolean).join(" • ") ||
    "-";

  // ที่อยู่ผู้ยื่น (fallback ไปที่ site address หากว่าง)
  const requesterAddress =
    requester.addressLine ||
    requester.address ||
    d.requesterAddress ||
    d.address ||
    siteAddressLine;

  // ระบบอาคาร + HOT WORK
  const hotwork = hotWorkText(d.hotWork ?? d.isHotWork ?? d.work?.hotWork);

  const bs = d.buildingSystems || d.work?.buildingSystems || {};
  const sysLabelFromFlags = Object.keys(bs)
    .filter((k) => !["labels","amp"].includes(k) && (bs as any)[k])
    .map((k) =>
      (k === "electric" && (bs as any).amp
        ? `ไฟฟ้า (${String((bs as any).amp)})`
        : ({electric:"ไฟฟ้า",plumbing:"ประปา",lighting:"แสงสว่าง",hvac:"แอร์",water:"น้ำ",gas:"แก๊ส"} as any)[k] || k)
    );
  const sysFromLabels = Array.isArray((bs as any).labels) ? (bs as any).labels : [];
  const sysFromNew =
    Array.isArray(d.buildingSystemWork)
      ? d.buildingSystemWork
      : d.buildingSystemWork
      ? [d.buildingSystemWork]
      : [];
  const buildingSystemsText = listToText([...sysLabelFromFlags, ...sysFromLabels, ...sysFromNew], ", ");

  // อุปกรณ์ (แสดงตามจริง)
  const equipmentText = getEquipmentText(d);

  // เริ่มเอกสาร
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  await ensureThaiFonts(doc);

  // หัวเรื่อง
  doc.setFont(CURRENT_FONT, "bold"); doc.setFontSize(20);
  doc.text("ใบอนุญาตเข้าทำงาน (Work Permit)", MARGIN_L, 60);
  doc.setDrawColor(220); doc.setLineWidth(1);
  doc.line(MARGIN_L, 70, pageW(doc) - MARGIN_R, 70);

  // เนื้อหา
  doc.setFont(CURRENT_FONT, "normal"); doc.setFontSize(12);
  let y = 96;

  // 1) ผู้ยื่น
  y = sectionHeading(doc, y, "ข้อมูลผู้ยื่น");
  y = rowKV(doc, y, "รหัสคำขอ (RID):", rid);
  y = rowKV(doc, y, "ผู้ยื่น:", [title, fullname].filter(Boolean).join(" "));
  y = rowKV(doc, y, "บริษัท:", company);
  y = rowKV(doc, y, "เลขบัตรประชาชน(มาสก์):", citizenMasked);
  y = rowKV(doc, y, "เบอร์โทร:", String(requesterPhone || "-"));
  y = rowKV(doc, y, "อีเมล:", String(requesterEmail || "-"));
  y = rowMultiline(doc, y, "ที่อยู่ผู้ยื่น:", requesterAddress);

  // 2) ทีมงาน
  const teamInfo = buildTeamInfo(d);
  y = sectionHeading(doc, y, "ทีมงาน");
  y = rowKV(doc, y, "ผู้ร่วมงาน (รวมผู้ควบคุมงาน):", `${teamInfo.count} คน`);
  y = rowMultiline(doc, y, "รายชื่อ:", teamInfo.lines);

  // 3) ลักษณะงาน
  y = sectionHeading(doc, y, "ลักษณะงาน");
  y = rowKV(doc, y, "HOT WORK:", hotwork);
  y = rowMultiline(doc, y, "งานเกี่ยวกับระบบอาคาร:", buildingSystemsText);
  y = rowMultiline(doc, y, "อุปกรณ์นำเข้า-ออก:", equipmentText);

  // 4) สถานที่/เวลา
  y = sectionHeading(doc, y, "สถานที่/เวลา");
  y = rowKV(doc, y, "พื้นที่:", area);
  y = rowKV(doc, y, "ชั้น:", String(floor));
  y = rowKV(doc, y, "ประเภทงาน:", jobType);
  y = rowKV(doc, y, "วันที่:", `${dateFrom} ถึง ${dateTo}`);
  y = rowKV(doc, y, "ช่วงเวลา:", `${timeFrom} ถึง ${timeTo}`);
  if (!REMOVE_SITE_ADDRESS_FIELD) {
    y = rowMultiline(doc, y, "ที่ตั้งงาน:", siteAddressLine);
  }

  // ตราประทับเมื่ออนุมัติ
  if (String(status).toLowerCase().includes("approve") || status === "อนุมัติแล้ว") {
    drawDiagonalStamp(doc, "อนุมัติแล้ว");
  }

  // QR ไปหน้า Status
  const origin = (typeof window !== "undefined" && window.location?.origin)
    ? window.location.origin
    : "https://imperialworld.asia";
  const statusLink = `${origin}/status?rid=${encodeURIComponent(rid)}`;
  const qrX = pageW(doc) - MARGIN_R - QR_SIDE;
  const qrY = pageH(doc) - 160;
  try {
    const qrDataUrl = await QRCode.toDataURL(statusLink, { width: QR_SIDE, margin: 0 });
    doc.setFont(CURRENT_FONT, "normal"); doc.setFontSize(10);
    doc.text("สแกนเพื่อตรวจสอบสถานะ", qrX, qrY - 10);
    doc.addImage(qrDataUrl, "PNG", qrX, qrY, QR_SIDE, QR_SIDE);
  } catch {}

  // กล่องลายเซ็น — ใช้ขอบซ้ายของ QR เป็นขีดจำกัด
  const rightLimitX = qrX - QR_GAP_LEFT; // กันชนชัดเจน
  y = drawSignatureBoxes(doc, y, rightLimitX);

  doc.save(`permit-${rid}.pdf`);
}

// สำหรับหน้า /status
export async function printPermitFromGetStatus(rid: string, last4: string, baseUrl?: string) {
  const base =
    baseUrl ||
    (import.meta as any).env?.VITE_GET_STATUS_URL ||
    "https://getstatus-aa5gfxjdmq-as.a.run.app";
  const u = new URL(base);
  u.searchParams.set("rid", rid);
  u.searchParams.set("pdf", "1");
  if (last4) u.searchParams.set("last4", last4);
  const payload = await fetch(u.toString(), { headers: { Accept: "application/json" } }).then(r => r.json());
  await generatePermitPDF(payload);
}
