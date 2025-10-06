// ======================================================================
// File: functions/src/listLogs.ts
// เวอร์ชัน: 2025-10-06 (Asia/Bangkok)
// หน้าที่: รวม/ดึง System Logs (Admin › Logs) จาก auditLogs (ใหม่) + audit_logs (เก่า)
// การยืนยันตัวตน: ใช้ Authorization: Bearer <ID_TOKEN> ทางเดียว (ไม่ใช้ x-api-key แล้ว)
// หมายเหตุ:
//  - เติมเวลาแบบสำรองจาก metadata ของเอกสาร: createTime / updateTime
//  - รวมฟิลด์ “ผู้ทำ” จากหลายชื่อ (by/actor/user/requester/...)
//  - คง CORS เดิม (อนุญาตเฉพาะ Authorization, x-requester-email) + กรอง/เรียงเวลา ฝั่งเซิร์ฟเวอร์
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

// CORS (คอร์ส = ข้ามโดเมน)
const ALLOWED_ORIGINS = new Set<string>([
  "https://imperialworld.asia",
  "https://staging.imperialworld.asia",
  "http://localhost:5173",
  "https://work-permit-app-1e9f0.web.app",
  "https://work-permit-app-1e9f0.firebaseapp.com",
]);
function setCors(req: any, res: any) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    // ไม่ต้องอนุญาต x-api-key แล้ว
    "Content-Type, Authorization, x-requester-email"
  );
  res.setHeader("Access-Control-Max-Age", "3600");
}

// ---------- เวลา: รองรับหลายรูปแบบ + สตริงแบบ "UTC+7" ----------
function normalizeDateString(s: string): string {
  let t = String(s || "").trim();
  if (/ at /i.test(t)) t = t.replace(/ at /i, " ");
  const m = t.match(/UTC([+-]\d{1,2})/i);
  if (m) {
    const n = parseInt(m[1], 10);
    const sign = n >= 0 ? "+" : "-";
    const hh = String(Math.abs(n)).padStart(2, "0");
    t = t.replace(/UTC[+-]\d{1,2}/i, `${sign}${hh}:00`);
  }
  return t;
}
function toMillis(v: any): number | null {
  if (v == null) return null;

  // Firestore Timestamp (seconds/nanoseconds) หรือ object ใกล้เคียง
  if (typeof v === "object" && (typeof (v as any).seconds === "number" || typeof (v as any)._seconds === "number")) {
    const s = ((v as any).seconds ?? (v as any)._seconds) as number;
    const ns = ((v as any).nanoseconds ?? (v as any)._nanoseconds ?? 0) as number;
    return s * 1000 + Math.floor(ns / 1e6);
  }

  if (typeof (v as any)?.toMillis === "function") {
    try { return (v as any).toMillis(); } catch { /* ignore */ }
  }
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;

  if (typeof v === "number") return v < 1e12 ? Math.round(v * 1000) : Math.round(v);

  if (typeof v === "string") {
    const p = Date.parse(normalizeDateString(v));
    return Number.isNaN(p) ? null : p;
  }
  return null;
}

// ---------- สิทธิ์: รับเฉพาะผู้ดูแลที่ล็อกอินจริง ----------
type DecodedLike = { email?: string | null; uid?: string };
const ALLOWED_ROLES = new Set(["admin", "approver", "superadmin"]);

async function findAdminByEmail(email: string): Promise<{ role?: string; enabled?: boolean } | null> {
  const cols = ["admins", "adminUsers"];
  for (const col of cols) {
    const snap = await db.collection(col).where("email", "==", email).limit(1).get();
    if (!snap.empty) {
      const d = snap.docs[0]?.data() || {};
      return { role: d.role, enabled: d.enabled !== false };
    }
  }
  return null;
}

function readBearer(req: any): string | null {
  const authz = String(req.headers?.authorization || req.headers?.Authorization || "").trim();
  if (!authz) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authz);
  return m?.[1]?.trim() || null;
}

// ---------- ดึง IP / Target แบบยืดหยุ่น ----------
function normalizeIp(x: any): string | undefined {
  return x?.ip ?? x?.clientIp ?? x?.remoteIp ?? x?.request_ip ?? x?.extra?.ip ?? undefined;
}
function renderTarget(x: any): string | undefined {
  if (!x) return undefined;
  if (typeof x === "string") return x;
  const type = x.type || x.targetType;
  const rid = x.rid;
  const id = x.id || x.targetId || x.documentId;
  if (type && (rid || id)) return `${type}:${rid || id}`;
  return rid || id || type;
}

// ---------- รวมฟิลด์ผู้กระทำเป็นสตริงเดียว ----------
function actorToString(by: any): string {
  if (!by) return "unknown";
  if (typeof by === "string") return by || "unknown";

  const email =
    by.email || by.byEmail || by.adminEmail || by.userEmail || by.requesterEmail ||
    by.requester || by.user || by.actor || by.ownerEmail;
  const name =
    by.name || by.byName || by.userName || by.ownerName;

  return (email && String(email)) || (name && String(name)) || "unknown";
}

// ---------- แปลงเอกสาร (new/old) พร้อม fallback เวลา metadata ----------
type DocLike = { id: string; data(): any; createTime?: any; updateTime?: any };
function pickAtWithMeta(data: any, doc: DocLike) {
  const raw =
    data.at ?? data.atMillis ?? data.createdAt ?? data.timestamp ?? data.time ?? data.date;
  const ms =
    toMillis(raw) ??
    toMillis(doc.createTime) ?? // เติมเวลาจาก metadata
    toMillis(doc.updateTime) ?? null;
  return { rawAt: raw, atMillis: ms ?? undefined };
}

function normalizeRowFromNew(doc: DocLike, data: any) {
  const { atMillis, rawAt } = pickAtWithMeta(data, doc);
  const byObj =
    data.by ?? data.actor ?? data.user ?? data.requester ??
    (data.adminEmail ? { email: data.adminEmail } : null) ??
    (data.email ? { email: data.email } : null) ??
    (data.userEmail ? { email: data.userEmail } : null) ??
    (data.requesterEmail ? { email: data.requesterEmail } : null);

  return {
    id: doc.id,
    at: rawAt,
    atMillis,
    by: actorToString(byObj),
    action: data.action ?? data.event ?? data.type ?? "-",
    target: renderTarget(data.target) ?? data.rid ?? data.requestId ?? data.id ?? "-",
    note: data.note ?? data.reason ?? data.message ?? "",
    ip: normalizeIp(data),
    ua: data.ua ?? data.userAgent ?? data.details?.ua ?? data.extra?.ua ?? undefined,
    method: data.method ?? data.httpMethod ?? data.details?.method ?? data.extra?.method ?? undefined,
    raw: { ...data, id: doc.id },
  };
}

function normalizeRowFromOld(doc: DocLike, data: any) {
  const { atMillis, rawAt } = pickAtWithMeta(
    { at: data.timestamp ?? data.createdAt ?? data.at }, // รูปแบบเก่า
    doc
  );

  const byObj =
    data.by ?? data.actor ?? data.user ?? data.requester ??
    (data.adminEmail ? { email: data.adminEmail } : null) ??
    (data.email ? { email: data.email } : null) ??
    (data.userEmail ? { email: data.userEmail } : null) ??
    (data.requesterEmail ? { email: data.requesterEmail } : null);

  return {
    id: doc.id,
    at: rawAt,
    atMillis,
    by: actorToString(byObj),
    action: data.action ?? data.event ?? data.type ?? "-",
    target: data.target ?? data.requestId ?? data.rid ?? renderTarget(data.target) ?? "-",
    note: data.note ?? data.reason ?? data.message ?? "",
    ip: normalizeIp(data),
    ua: data.ua ?? data.userAgent ?? undefined,
    method: data.method ?? undefined,
    raw: { ...data, id: doc.id },
  };
}

// ---------- main function ----------
export const listLogs = onRequest(
  {
    region: "asia-southeast1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      // ===== 1) ตรวจบัตรผ่านจาก Authorization: Bearer <ID_TOKEN> =====
      const bearer = readBearer(req);
      if (!bearer) {
        res.status(401).json({ ok: false, error: "missing_authorization" });
        return;
      }

      let decoded: DecodedLike | null = null;
      try {
        decoded = await getAuth().verifyIdToken(bearer);
      } catch (e) {
        res.status(401).json({ ok: false, error: "invalid_authorization" });
        return;
      }

      const email = (decoded?.email || "").trim();
      if (!email) {
        res.status(403).json({ ok: false, error: "forbidden" });
        return;
      }

      // ===== 2) ตรวจสิทธิ์จากตารางผู้ดูแล (admins | adminUsers) =====
      const admin = await findAdminByEmail(email);
      if (!admin || admin.enabled === false || (admin.role && !ALLOWED_ROLES.has(String(admin.role)))) {
        res.status(403).json({ ok: false, error: "forbidden" });
        return;
      }

      // ===== 3) รับพารามิเตอร์กรอง =====
      const q = String(req.query.q ?? "").trim().toLowerCase();
      const actionFilter = String(req.query.action ?? "").trim().toLowerCase();
      const limit = Math.min(parseInt(String(req.query.limit ?? "300"), 10) || 300, 1000);

      const fromMs = req.query.from ? Date.parse(String(req.query.from)) : Number.NEGATIVE_INFINITY;
      const toMs = req.query.to ? Date.parse(String(req.query.to)) : Number.POSITIVE_INFINITY;

      // ===== 4) ดึงข้อมูล =====
      // หมายเหตุ: orderBy('at') จะตัดเอกสารที่ไม่มีฟิลด์ 'at' ออกตามพฤติกรรม Firestore เอง
      const newSnap = await db.collection("auditLogs").orderBy("at", "desc").limit(limit).get();
      const newItems = newSnap.docs.map((d: any) => normalizeRowFromNew(d, d.data()));

      const oldSnap = await db.collection("audit_logs").limit(limit).get();
      const oldItems = oldSnap.docs.map((d: any) => normalizeRowFromOld(d, d.data()));

      const all = [...newItems, ...oldItems];

      // ===== 5) กรอง =====
      const filtered = all.filter((r) => {
        const ms = r.atMillis ?? toMillis(r.at) ?? 0;
        if (!(ms >= fromMs && ms <= toMs)) return false;
        if (actionFilter && String(r.action || "").toLowerCase() !== actionFilter) return false;

        if (q) {
          const hay = [
            r.by || "",
            r.action || "",
            r.target || "",
            r.note || "",
            r.ip || "",
            r.ua || "",
          ]
            .join(" | ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      // ===== 6) เรียงล่าสุดก่อน แล้วตัดตาม limit =====
      filtered.sort((a, b) => (b.atMillis ?? 0) - (a.atMillis ?? 0));

      res.status(200).json({
        ok: true,
        data: { items: filtered.slice(0, limit), count: filtered.length },
      });
    } catch (e: any) {
      await db.collection("_errors").add({
        at: FieldValue.serverTimestamp(),
        where: "listLogs",
        message: String(e?.message || e),
      });
      res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
  }
);
