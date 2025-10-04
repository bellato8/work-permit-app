// ======================================================================
// File: functions/src/listRequests.ts
// เวอร์ชัน: 2025-10-04
// หน้าที่: ลิสต์คำขอจาก Firestore เรียงใหม่→เก่า พร้อมเพจจิ้งนิ่ง (คอร์เซอร์)
// เชื่อม auth ผ่าน: Firebase Admin SDK (verifyIdToken) - ใช้เฉพาะ ID Token
// หมายเหตุ:
//   - เลิกใช้ API key ในไฟล์นี้
//   - อนุญาต roles: viewer / approver / admin / superadmin (เมื่อ enabled = true)
//   - ใช้ orderBy(createdAt desc) + orderBy(__name__ desc) + startAfter(...) ให้เพจจิ้งนิ่ง
//   - CORS คุมโดเมนเอง
// ======================================================================

import { onRequest } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
// ✅ import แบบที่เอกสารแนะนำ: ดึงฟังก์ชัน log เป็นรายตัวจากซับแพ็กเกจ
import { info, warn, error } from "firebase-functions/logger";

if (!getApps().length) initializeApp();
const db = getFirestore();

// ---------- CORS ----------
function setCorsHeaders(req: any, res: any) {
  const allowedOrigins = [
    "https://imperialworld.asia",
    "https://staging.imperialworld.asia",
    "http://localhost:5173",
    "https://work-permit-app-1e9f0.web.app",
    "https://work-permit-app-1e9f0.firebaseapp.com",
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "3600");
}

// ---------- Utils ----------
function b64encode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}
function b64decode<T = any>(b64: string): T | null {
  try {
    return JSON.parse(Buffer.from(String(b64), "base64").toString("utf8")) as T;
  } catch {
    return null;
  }
}
function toMillis(anyVal: any): number | undefined {
  if (anyVal == null) return undefined;
  if (typeof anyVal?.toMillis === "function") {
    try { return (anyVal as any).toMillis(); } catch {}
  }
  if (typeof anyVal === "number" && isFinite(anyVal)) {
    const abs = Math.abs(anyVal);
    if (abs < 1e11) return anyVal * 1000;          // sec -> ms
    if (abs < 1e13) return anyVal;                 // ms
    if (abs < 1e16) return Math.floor(anyVal / 1e3); // µs -> ms
    return Math.floor(anyVal / 1e6);               // ns -> ms
  }
  if (typeof anyVal === "string") {
    const t = Date.parse(anyVal);
    if (!Number.isNaN(t)) return t;
    const n = Number(anyVal);
    if (Number.isFinite(n)) return toMillis(n);
  }
  const sec = (anyVal as any)?.seconds ?? (anyVal as any)?._seconds;
  const nsec = (anyVal as any)?.nanoseconds ?? (anyVal as any)?._nanoseconds ?? 0;
  if (typeof sec === "number") return sec * 1000 + Math.round(nsec / 1e6);
  return undefined;
}

// ---------- Main ----------
export const listRequests = onRequest(
  {
    region: "asia-southeast1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }

    // -------- AuthN/AuthZ: ใช้เฉพาะ ID Token --------
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ ok: false, error: "Missing Bearer token" });
      return;
    }

    let email: string | undefined;
    try {
      const idToken = authHeader.slice("Bearer ".length);
      const decoded = await getAuth().verifyIdToken(idToken);
      email = decoded.email?.toLowerCase();
    } catch (e) {
      warn("listRequests: verifyIdToken failed", { error: String(e) });
      res.status(401).json({ ok: false, error: "Invalid token" });
      return;
    }

    if (!email) {
      res.status(403).json({ ok: false, error: "No email in token" });
      return;
    }

    const allowedRoles = new Set(["viewer", "approver", "admin", "superadmin"]);
    const adminSnap = await db.collection("admins").where("email", "==", email).limit(1).get();
    if (adminSnap.empty) { res.status(403).json({ ok: false, error: "Not authorized" }); return; }
    const admin = adminSnap.docs[0].data() as any;
    if (!admin?.enabled || !allowedRoles.has(String(admin?.role))) {
      res.status(403).json({ ok: false, error: "Not authorized" });
      return;
    }

    // -------- Query params --------
    const limitParam = Math.max(1, Math.min(Number(req.query.limit ?? 100), 1000));
    const pageToken = (req.query.pageToken as string) || "";

    // -------- Build query: สั่งเรียงนิ่ง (tie-break ด้วย doc id) --------
    let q = db
      .collection("requests")
      .orderBy("createdAt", "desc")
      .orderBy("__name__", "desc");

    if (pageToken) {
      const parsed = b64decode<{ createdAtMillis: number; id: string }>(pageToken);
      if (parsed?.createdAtMillis && parsed?.id) {
        q = q.startAfter(Timestamp.fromMillis(parsed.createdAtMillis), parsed.id);
      }
    }

    try {
      const snap = await q.limit(limitParam).get();

      const items = snap.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          rid: doc.id,
          id: doc.id,
          status: data.status ?? "pending",
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
          approvedAt: data.decision?.at ?? data.approvedAt ?? null,
          rejectedAt: data.decision?.at ?? data.rejectedAt ?? null,
          contractorName: data.requester?.fullname || data.requester?.name || "",
          requesterName: data.requester?.fullname || data.requester?.name || "",
          contractorCompany: data.requester?.company || "",
          workType: data.work?.type || "",
          jobType: data.work?.category || data.work?.type || "",
          permitType: data.work?.type || "",
          requester: data.requester,
          work: data.work,
          ...data,
        };
      });

      let nextPageToken: string | undefined;
      if (snap.size === limitParam) {
        const last = snap.docs[snap.docs.length - 1];
        const lastMs = toMillis(last.get("createdAt"));
        if (lastMs) nextPageToken = b64encode({ createdAtMillis: lastMs, id: last.id });
      }

      res.status(200).json({ ok: true, data: { items, count: items.length, nextPageToken } });
      return;
    } catch (err: any) {
      error("listRequests: query failed", { error: String(err) });
      res.status(500).json({ ok: false, error: "Internal Server Error" });
      return;
    }
  }
);
