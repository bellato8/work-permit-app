// ======================================================================
// File: functions/src/cleanup.ts
// เวอร์ชัน: 2025-09-18 23:10 (Asia/Bangkok)
// หน้าที่: ฟังก์ชันล้างงานตาม RID และลบ logs (จำกัดเฉพาะ superadmin)
// เชื่อม auth ผ่าน Firebase Admin SDK (initializeApp อยู่ใน index.ts แล้ว)
// หมายเหตุ:
// - ยกระดับตรวจสิทธิ์: รับทั้ง custom claims และ Firestore (adminUsers / admins)
// - ล็อกดีบักไว้ให้ วิเคราะห์ได้ถ้ามีเคส token ค้าง
// ======================================================================

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// ใช้ instance เดียวที่ถูก initialize ที่ index.ts
const db = admin.firestore();
const bucket = admin.storage().bucket();

/** ตรวจ superadmin จาก custom claims */
function isSuperAdminFromClaims(token: any): boolean {
  return !!(
    token?.role === "superadmin" ||      // เคสใหม่ ใช้สตริง role
    token?.superadmin === true ||        // เคสที่ตั้งธง boolean
    token?.roles?.superadmin === true    // เคสเก็บแบบ object roles
  );
}

/** ตรวจ superadmin จาก Firestore (fallback เมื่อ token ยังไม่รีเฟรช) */
async function isSuperAdminFromDb(uid?: string, email?: string) {
  const collections = ["adminUsers", "admins"]; // รองรับได้ทั้งสองชื่อ
  for (const col of collections) {
    // 1) ด้วย uid ก่อน
    if (uid) {
      const snap = await db.collection(col).doc(uid).get();
      if (snap.exists) {
        const d = snap.data() || {};
        if (d.role === "superadmin" || d.superadmin === true || d?.roles?.superadmin) return true;
      }
    }
    // 2) ด้วย email (รองลงมา)
    if (email) {
      const qs = await db.collection(col).where("email", "==", email).limit(1).get();
      if (!qs.empty) {
        const d = qs.docs[0].data() || {};
        if (d.role === "superadmin" || d.superadmin === true || d?.roles?.superadmin) return true;
      }
    }
  }
  return false;
}

/** ตรวจ superadmin จากทั้งสองทาง */
async function assertSuperadminOrThrow(auth: any) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "ต้องล็อกอินก่อน");
  }

  const token = auth.token || {};
  const uid = auth.uid as string | undefined;
  const email = token?.email as string | undefined;

  const byClaims = isSuperAdminFromClaims(token);
  if (byClaims) return; // ผ่านตั้งแต่ชั้น claims

  // ยังไม่ผ่าน → ลองเช็กที่ DB (กันเคส token ค้าง)
  const byDb = await isSuperAdminFromDb(uid, email);
  if (byDb) return;

  // ไม่ผ่านทั้งสองชั้น
  console.warn("[cleanup] deny: not superadmin", {
    uid, email, tokenRole: token?.role, tokenKeys: Object.keys(token || {}),
  });
  throw new HttpsError("permission-denied", "เฉพาะ superadmin เท่านั้น");
}

// ====== 1) ลบคำขอทั้งชุดตาม RID ======
export const deleteRequestCascade = onCall(
  {
    region: "asia-southeast1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (req) => {
    const { data, auth } = req;
    await assertSuperadminOrThrow(auth);

    const rid = String(data?.rid ?? "").trim();
    if (!rid) throw new HttpsError("invalid-argument", "ต้องระบุ rid");

    const RID_OK = /^[A-Z0-9-]{6,60}$/i;
    if (!RID_OK.test(rid)) throw new HttpsError("invalid-argument", "รูปแบบ rid ไม่ถูกต้อง");

    const docRef = db.doc(`requests/${rid}`);

    // ลบ Firestore (รวม subcollections)
    await admin.firestore().recursiveDelete(docRef);

    // ลบไฟล์ Storage ใต้ prefix เดียวกัน
    const prefix = `requests/${rid}/`;
    const [files] = await bucket.getFiles({ prefix });
    if (files.length) {
      await bucket.deleteFiles({ prefix });
    }

    console.log("[cleanup] cascade deleted", { rid, files: files.length });
    return { ok: true, rid, deleted: { firestore: true, storageFiles: files.length } };
  }
);

// ====== 2) ลบ Logs ======
export const deleteLogs = onCall(
  {
    region: "asia-southeast1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (req) => {
    const { data, auth } = req;
    await assertSuperadminOrThrow(auth);

    const collectionPath = String(data?.collectionPath || "logs");
    const mode = String(data?.mode || "all");

    let q = db.collection(collectionPath) as FirebaseFirestore.Query;

    if (mode === "byRid") {
      const rid = String(data?.rid ?? "").trim();
      if (!rid) throw new HttpsError("invalid-argument", "ต้องระบุ rid");
      q = q.where("rid", "==", rid);
    } else if (mode === "before") {
      const ts = data?.ts;
      let d: Date;
      if (typeof ts === "number") d = new Date(ts);
      else if (typeof ts === "string") d = new Date(ts);
      else throw new HttpsError("invalid-argument", "ต้องระบุ ts");
      q = q.where("createdAt", "<=", d);
    } else if (mode !== "all") {
      throw new HttpsError("invalid-argument", "โหมดไม่ถูกต้อง");
    }

    const BATCH = 400;
    let total = 0;
    while (true) {
      const snap = await q.limit(BATCH).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      total += snap.size;
      if (snap.size < BATCH) break;
    }

    console.log("[cleanup] logs deleted", { mode, collectionPath, total });
    return { ok: true, collectionPath, mode, deleted: total };
  }
);
