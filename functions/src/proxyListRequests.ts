// ======================================================================
// File: functions/src/proxyListRequests.ts
// เวอร์ชัน: 2025-09-25 00:40 (Asia/Bangkok)
// หน้าที่: Proxy → Cloud Run listRequests โดยอ่านปลายทางจาก Secret
// เชื่อม auth: forward Authorization: Bearer <ID_TOKEN> + x-requester-email
// หมายเหตุ: ครอบ CORS ด้วย withCors; รองรับ GET/POST/PUT/PATCH/DELETE/OPTIONS
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { withCors } from "./withCors";

const LIST_REQUESTS_TARGET = defineSecret("LIST_REQUESTS_TARGET");

// ต่อ query string เดิมไปปลายทาง (ไม่พา path ต้นทาง)
function buildTargetUrl(targetBase: string, originalUrl: string): string {
  const qIndex = originalUrl.indexOf("?");
  const qs = qIndex >= 0 ? originalUrl.substring(qIndex) : "";
  return targetBase + qs;
}

// กรอง header ที่ไม่ควร forward
function filterHeaders(h: Record<string, unknown>) {
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
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (!banned.has(k.toLowerCase()) && typeof v === "string") out[k] = v;
  }
  return out;
}

export const proxyListRequests = onRequest(
  {
    region: "asia-southeast1",
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: [LIST_REQUESTS_TARGET],
  },
  withCors(async (req, res) => {
    try {
      const targetBase = process.env.LIST_REQUESTS_TARGET;
      if (!targetBase) {
        res.status(500).json({ ok: false, error: "Missing LIST_REQUESTS_TARGET" });
        return;
      }

      const url = buildTargetUrl(targetBase, req.url);
      const method = (req.method || "GET").toUpperCase();

      const incoming = filterHeaders(req.headers as any);
      const idToken = incoming["authorization"] || incoming["Authorization"];
      const requesterEmail =
        incoming["x-requester-email"] || incoming["X-Requester-Email"];

      const outHeaders: Record<string, string> = {
        "content-type": (req.headers["content-type"] as string) || "application/json",
      };
      if (idToken) outHeaders["authorization"] = String(idToken);
      if (requesterEmail) outHeaders["x-requester-email"] = String(requesterEmail);

      let body: any = undefined;
      if (!["GET", "HEAD"].includes(method)) {
        body = req.rawBody?.length ? req.rawBody : undefined;
      }

      const r = await fetch(url, { method, headers: outHeaders, body });
      const buf = Buffer.from(await r.arrayBuffer());

      res.status(r.status);
      const ct = r.headers.get("content-type");
      if (ct) res.setHeader("content-type", ct);
      res.send(buf);
    } catch (err: any) {
      res.status(502).json({ ok: false, error: String(err?.message || err) });
    }
  })
);
