"use strict";
// ======================================================================
// File: functions/src/listLogs.ts
// เวอร์ชัน: 2025-09-21 23:40
// หน้าที่: รวม/ดึง System Logs (Admin › Logs) ทั้งคอลเลกชันใหม่ auditLogs และเก่า audit_logs
// เชื่อม auth ผ่าน "อะแดปเตอร์": Firebase Admin (ตรวจ Bearer / x-api-key)
// หมายเหตุ:
//  - เติมเวลาแบบสำรองจาก metadata ของเอกสาร: createTime / updateTime
//    (ด็อคคิวเมนต์-สแนปช็อต: createTime = เวลาเอกสารถูกสร้าง, updateTime = เวลาแก้ไขล่าสุด)
//  - รวมฟิลด์ “ผู้ทำ” จากหลายชื่อ (by/actor/user/requester/...)
//  - คง CORS เดิม + กรอง/ค้น + เรียงเวลา ฝั่งเซิร์ฟเวอร์
// วันที่/เวลาแก้ล่าสุด: 21-09-2025 23:40
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLogs = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const APPROVER_KEY = (0, params_1.defineSecret)("APPROVER_KEY");
// CORS (คอร์ส = ข้ามโดเมน)
const ALLOWED_ORIGINS = new Set([
    "https://imperialworld.asia",
    "https://staging.imperialworld.asia",
    "http://localhost:5173",
    "https://work-permit-app-1e9f0.web.app",
    "https://work-permit-app-1e9f0.firebaseapp.com",
]);
function setCors(req, res) {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, x-requester-email");
    res.setHeader("Access-Control-Max-Age", "3600");
}
// ---------- เวลา: รองรับหลายรูปแบบ + สตริงแบบ "UTC+7" ----------
function normalizeDateString(s) {
    let t = String(s || "").trim();
    if (/ at /i.test(t))
        t = t.replace(/ at /i, " ");
    const m = t.match(/UTC([+-]\d{1,2})/i);
    if (m) {
        const n = parseInt(m[1], 10);
        const sign = n >= 0 ? "+" : "-";
        const hh = String(Math.abs(n)).padStart(2, "0");
        t = t.replace(/UTC[+-]\d{1,2}/i, `${sign}${hh}:00`);
    }
    return t;
}
function toMillis(v) {
    if (v == null)
        return null;
    // Firestore Timestamp (seconds/nanoseconds) หรือ object ใกล้เคียง
    if (typeof v === "object" && (typeof v.seconds === "number" || typeof v._seconds === "number")) {
        const s = (v.seconds ?? v._seconds);
        const ns = (v.nanoseconds ?? v._nanoseconds ?? 0);
        return s * 1000 + Math.floor(ns / 1e6);
    }
    if (typeof v?.toMillis === "function") {
        try {
            return v.toMillis();
        }
        catch { /* ignore */ }
    }
    if (v instanceof Date)
        return Number.isFinite(v.getTime()) ? v.getTime() : null;
    if (typeof v === "number")
        return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
    if (typeof v === "string") {
        const p = Date.parse(normalizeDateString(v));
        return Number.isNaN(p) ? null : p;
    }
    return null;
}
// ---------- ตรวจสิทธิ์ (Bearer token หรือ x-api-key) ----------
async function isAuthorized(req) {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length);
        try {
            const decoded = await (0, auth_1.getAuth)().verifyIdToken(token);
            const email = decoded.email;
            if (email) {
                const snap = await db.collection("admins").where("email", "==", email).limit(1).get();
                if (!snap.empty) {
                    const admin = snap.docs[0].data();
                    if (admin.enabled && ["admin", "approver", "superadmin"].includes(admin.role)) {
                        return true;
                    }
                }
            }
        }
        catch {
            // ตกลงมาลองวิธี key ต่อไป
        }
    }
    const key = req.headers["x-api-key"] || req.query?.key || req.body?.key;
    if (key && key === APPROVER_KEY.value())
        return true;
    return false;
}
// ---------- ดึง IP / Target แบบยืดหยุ่น ----------
function normalizeIp(x) {
    return x?.ip ?? x?.clientIp ?? x?.remoteIp ?? x?.request_ip ?? x?.extra?.ip ?? undefined;
}
function renderTarget(x) {
    if (!x)
        return undefined;
    if (typeof x === "string")
        return x;
    const type = x.type || x.targetType;
    const rid = x.rid;
    const id = x.id || x.targetId || x.documentId;
    if (type && (rid || id))
        return `${type}:${rid || id}`;
    return rid || id || type;
}
// ---------- รวมฟิลด์ผู้กระทำเป็นสตริงเดียว ----------
function actorToString(by) {
    if (!by)
        return "unknown";
    if (typeof by === "string")
        return by || "unknown";
    const email = by.email || by.byEmail || by.adminEmail || by.userEmail || by.requesterEmail ||
        by.requester || by.user || by.actor || by.ownerEmail;
    const name = by.name || by.byName || by.userName || by.ownerName;
    return (email && String(email)) || (name && String(name)) || "unknown";
}
function pickAtWithMeta(data, doc) {
    const raw = data.at ?? data.atMillis ?? data.createdAt ?? data.timestamp ?? data.time ?? data.date;
    const ms = toMillis(raw) ??
        toMillis(doc.createTime) ?? // สำคัญ: เติมเวลาจาก metadata
        toMillis(doc.updateTime) ?? null;
    return { rawAt: raw, atMillis: ms ?? undefined };
}
function normalizeRowFromNew(doc, data) {
    const { atMillis, rawAt } = pickAtWithMeta(data, doc);
    const byObj = data.by ?? data.actor ?? data.user ?? data.requester ??
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
function normalizeRowFromOld(doc, data) {
    const { atMillis, rawAt } = pickAtWithMeta({ at: data.timestamp ?? data.createdAt ?? data.at }, // รูปแบบเก่า
    doc);
    const byObj = data.by ?? data.actor ?? data.user ?? data.requester ??
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
exports.listLogs = (0, https_1.onRequest)({
    region: "asia-southeast1",
    secrets: [APPROVER_KEY],
    timeoutSeconds: 60,
    memory: "256MiB",
}, async (req, res) => {
    setCors(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    try {
        const ok = await isAuthorized(req);
        if (!ok) {
            res.status(403).json({ ok: false, error: "Forbidden" });
            return;
        }
        // รับพารามิเตอร์กรอง
        const q = String(req.query.q ?? "").trim().toLowerCase();
        const actionFilter = String(req.query.action ?? "").trim().toLowerCase();
        const limit = Math.min(parseInt(String(req.query.limit ?? "300"), 10) || 300, 1000);
        const fromMs = req.query.from ? Date.parse(String(req.query.from)) : Number.NEGATIVE_INFINITY;
        const toMs = req.query.to ? Date.parse(String(req.query.to)) : Number.POSITIVE_INFINITY;
        // ดึงคอลเลกชันใหม่ (มี field at/atMillis เป็นหลัก)
        const newSnap = await db.collection("auditLogs").orderBy("at", "desc").limit(limit).get();
        const newItems = newSnap.docs.map((d) => normalizeRowFromNew(d, d.data()));
        // ดึงคอลเลกชันเก่า (โครงสร้างหลากหลาย)
        const oldSnap = await db.collection("audit_logs").limit(limit).get();
        const oldItems = oldSnap.docs.map((d) => normalizeRowFromOld(d, d.data()));
        const all = [...newItems, ...oldItems];
        // กรองข้อมูล
        const filtered = all.filter((r) => {
            const ms = r.atMillis ?? toMillis(r.at) ?? 0;
            if (!(ms >= fromMs && ms <= toMs))
                return false;
            if (actionFilter && String(r.action || "").toLowerCase() !== actionFilter)
                return false;
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
                if (!hay.includes(q))
                    return false;
            }
            return true;
        });
        // เรียงเวลาล่าสุดก่อน (ใช้ millis ที่คำนวณเอง)
        filtered.sort((a, b) => (b.atMillis ?? 0) - (a.atMillis ?? 0));
        res.status(200).json({
            ok: true,
            data: { items: filtered.slice(0, limit), count: filtered.length },
        });
    }
    catch (e) {
        await db.collection("_errors").add({
            at: firestore_1.FieldValue.serverTimestamp(),
            where: "listLogs",
            message: String(e?.message || e),
        });
        res.status(500).json({ ok: false, error: "Internal Server Error" });
    }
});
