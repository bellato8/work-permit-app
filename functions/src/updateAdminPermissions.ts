// functions/src/updateAdminPermissions.ts
// HTTP v2 function: อัปเดต pagePermissions ให้ผู้ดูแล
// แนวคิด: ตรวจโทเค็นจาก Header, ตรวจรูปแบบ body, แล้ว merge ฟิลด์ pagePermissions ลง Firestore

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ป้องกัน initializeApp ซ้ำ (กรณีมีไฟล์อื่นเรียกไว้แล้ว)
if (!getApps().length) {
  initializeApp();
}

/**
 * โครง body ที่คาดหวัง:
 * {
 *   "email": "someone@example.com",
 *   "pagePermissions": { ... อ็อบเจ็กต์สิทธิ์แบบ nested ... }
 * }
 */
export const updateAdminPermissions = onRequest(
  {
    // เปิด CORS ในตัว (ง่ายและเร็ว)
    cors: true,
    region: "asia-southeast1",
    maxInstances: 10,
  },
  // ชี้ให้ชัดว่า handler คืน Promise<void>
  async (req, res): Promise<void> => {
    try {
      // 1) อนุญาตเฉพาะ POST
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Method Not Allowed" });
        return;
      }

      // 2) ดึงและตรวจ Authorization: Bearer <idToken>
      const authHeader = String(req.headers.authorization || "");
      const idToken =
        authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

      if (!idToken) {
        res.status(401).json({ ok: false, error: "Missing ID token" });
        return;
      }

      // 3) verify โทเค็นด้วย Admin SDK
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      const callerUid = decoded.uid;
      logger.info("updateAdminPermissions called by", { callerUid });

      // 4) ตรวจ body
      const body = req.body || {};
      const email = String(body.email || "").trim().toLowerCase();
      const pagePermissions = body.pagePermissions;

      if (!email || !pagePermissions || typeof pagePermissions !== "object") {
        res.status(400).json({
          ok: false,
          error: "Invalid body: email and pagePermissions are required",
        });
        return;
      }

      // 5) บันทึกลง Firestore (merge ฟิลด์)
      const db = getFirestore();
      const ref = db.collection("admins").doc(email);

      await ref.set(
        {
          pagePermissions,
          updatedAt: new Date(),
          updatedBy: callerUid || null,
        },
        { merge: true }
      );

      res.json({ ok: true });
      return;
    } catch (err: any) {
      logger.error("updateAdminPermissions error", err);
      res.status(500).json({ ok: false, error: err?.message || "Internal Error" });
      return;
    }
  }
);
