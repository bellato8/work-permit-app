"use strict";
// ======================================================================
// File: functions/src/proxyListAdmins.ts
// เวอร์ชัน: 2025-09-25 00:55 (Asia/Bangkok)
// หน้าที่: Proxy → Cloud Run listAdmins โดยอ่านปลายทางจาก Secret (v2)
// เชื่อม auth: forward Authorization: Bearer <ID_TOKEN> + x-requester-email
// หมายเหตุ: ครอบ CORS ด้วย withCors; รองรับ GET/POST/PUT/PATCH/DELETE/OPTIONS
// ======================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyListAdmins = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const withCors_1 = require("./withCors");
const LIST_ADMINS_TARGET = (0, params_1.defineSecret)("LIST_ADMINS_TARGET");
// ต่อ query string เดิมไปปลายทาง (ไม่พา path ต้นทาง)
function buildTargetUrl(targetBase, originalUrl) {
    const qIndex = originalUrl.indexOf("?");
    const qs = qIndex >= 0 ? originalUrl.substring(qIndex) : "";
    return targetBase + qs;
}
// กรอง header ที่ไม่ควร forward
function filterHeaders(h) {
    const banned = new Set([
        "host",
        "connection",
        "content-length",
        "accept-encoding",
        "x-forwarded-for",
        "x-forwarded-host",
        "x-forwarded-proto",
        "x-cloud-trace-context",
    ]);
    const out = {};
    for (const [k, v] of Object.entries(h)) {
        if (!banned.has(k.toLowerCase()) && typeof v === "string")
            out[k] = v;
    }
    return out;
}
exports.proxyListAdmins = (0, https_1.onRequest)({
    region: "asia-southeast1",
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: [LIST_ADMINS_TARGET],
}, (0, withCors_1.withCors)(async (req, res) => {
    try {
        const targetBase = process.env.LIST_ADMINS_TARGET;
        if (!targetBase) {
            res.status(500).json({ ok: false, error: "Missing LIST_ADMINS_TARGET" });
            return;
        }
        const url = buildTargetUrl(targetBase, req.url);
        const method = (req.method || "GET").toUpperCase();
        const incoming = filterHeaders(req.headers);
        const idToken = incoming["authorization"] || incoming["Authorization"];
        const requesterEmail = incoming["x-requester-email"] || incoming["X-Requester-Email"];
        const outHeaders = {
            "content-type": req.headers["content-type"] || "application/json",
        };
        if (idToken)
            outHeaders["authorization"] = String(idToken);
        if (requesterEmail)
            outHeaders["x-requester-email"] = String(requesterEmail);
        let body = undefined;
        if (!["GET", "HEAD"].includes(method)) {
            body = req.rawBody?.length ? req.rawBody : undefined;
        }
        const r = await fetch(url, { method, headers: outHeaders, body });
        const buf = Buffer.from(await r.arrayBuffer());
        res.status(r.status);
        const ct = r.headers.get("content-type");
        if (ct)
            res.setHeader("content-type", ct);
        res.send(buf);
    }
    catch (err) {
        res.status(502).json({ ok: false, error: String(err?.message || err) });
    }
}));
