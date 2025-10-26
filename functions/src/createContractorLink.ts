// ======================================================================
// File: functions/src/createContractorLink.ts
// เวอร์ชัน: 26/10/2025 23:35 (Asia/Bangkok)
// หน้าที่: Cloud Function (callable, v2) สำหรับ LP Admin เพื่อ "อนุมัติเบื้องต้น"
//          - สร้าง RID รูปแบบ INT-YYYY-#### (Transaction + Counter)
//          - อัปเดต internal_requests: linkedPermitRID + สถานะ 'LP รับทราบ (รอผู้รับเหมา)'
//          - คืน URL จำลองสำหรับ Module 3 ตามสัญญา
// เชื่อม auth ผ่าน "อะแดปเตอร์": Firebase Auth (Custom Claims) + Firestore (Admin SDK)
// เปลี่ยนแปลงรอบนี้:
//   • ปรับเป็น v2 API (onCall(request), HttpsError, CallableRequest)
//   • ตัด import AuthData (v2 ไม่ export) และใช้ CallableRequest['auth'] แทน
//   • อ่าน region จาก ENV: FUNCTIONS_REGION (fallback 'us-central1')
//   • ค้นหาเอกสารด้วย documentId() == requestId ให้ชัดเจน
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 26/10/2025 23:35
// ======================================================================

import * as admin from 'firebase-admin';
import {
  onCall,
  CallableRequest,
  HttpsError,
} from 'firebase-functions/v2/https';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

type InternalStatus =
  | 'รอดำเนินการ'
  | 'LP รับทราบ (รอผู้รับเหมา)'
  | 'รอ LP ตรวจสอบ'
  | 'อนุมัติเข้าทำงาน'
  | 'ไม่อนุมัติ';

interface CreateLinkInput {
  internalRequestPath?: string; // แนะนำให้ส่งมาเสมอ
  requestId?: string;           // สำรอง (ไม่แนะนำ ใช้งานยากในการค้นหา)
}

// ตรวจสิทธิ์ LP Admin จาก custom claims
function assertLpRole(auth: CallableRequest<unknown>['auth']) {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบก่อน');
  }
  const claims = (auth.token || {}) as Record<string, any>;
  const role = (claims.role || '') as string;

  const ok =
    claims.superadmin === true ||
    claims.lpAdmin === true ||
    role === 'lp_admin' ||
    role === 'admin' ||
    role === 'superadmin';

  if (!ok) {
    throw new HttpsError('permission-denied', 'สิทธิ์ไม่เพียงพอ (ต้องเป็น LP Admin)');
  }
}

function pad4(n: number) {
  return String(n).padStart(4, '0');
}

function extractAppIdFromPath(internalRequestPath: string): string {
  // คาดรูปแบบ: artifacts/{appId}/users/{uid}/internal_requests/{docId}
  const m = internalRequestPath.match(/^artifacts\/([^/]+)\/users\/[^/]+\/internal_requests\/[^/]+$/);
  if (m && m[1]) return m[1];
  // สำรอง: ใช้ projectId
  return process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'demo-app';
}

export const createContractorLink = onCall(
  { region: process.env.FUNCTIONS_REGION || 'us-central1' },
  async (request: CallableRequest<CreateLinkInput>) => {
    // 1) ตรวจสิทธิ์
    assertLpRole(request.auth);

    // 2) รับข้อมูล
    const internalRequestPath = (request.data?.internalRequestPath || '').trim();
    const requestId = (request.data?.requestId || '').trim();

    if (!internalRequestPath && !requestId) {
      throw new HttpsError(
        'invalid-argument',
        'ต้องระบุ internalRequestPath (แนะนำ) หรือ requestId อย่างน้อยหนึ่งค่า'
      );
    }

    // 3) หาเอกสารคำขอ
    let reqRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> | null = null;

    if (internalRequestPath) {
      reqRef = db.doc(internalRequestPath);
    } else {
      // หาโดย documentId == requestId (ไม่แนะนำ แต่รองรับ)
      const snap = await db
        .collectionGroup('internal_requests')
        .where(admin.firestore.FieldPath.documentId(), '==', requestId)
        .limit(1)
        .get();
      if (!snap.empty) {
        reqRef = snap.docs[0].ref;
      }
    }

    if (!reqRef) {
      throw new HttpsError('not-found', 'ไม่พบเอกสารคำขอที่ระบุ');
    }

    // 4) เตรียม counter RID
    const appId = extractAppIdFromPath(reqRef.path);
    const year = new Date().getFullYear();
    const counterDocPath = `artifacts/${appId}/private/system/counters/rid_internal_${year}`;
    const counterRef = db.doc(counterDocPath);

    // 5) Transaction: สร้าง RID + อัปเดตสถานะ
    const result = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef!);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'ไม่พบเอกสารคำขอที่ระบุ');
      }

      const req = reqSnap.data() as { status?: InternalStatus; linkedPermitRID?: string | null } | undefined;
      const currentStatus = (req?.status || 'รอดำเนินการ') as InternalStatus;

      if (currentStatus !== 'รอดำเนินการ') {
        throw new HttpsError(
          'failed-precondition',
          `สถานะปัจจุบันคือ "${currentStatus}" — อนุมัติเบื้องต้นได้เฉพาะสถานะ "รอดำเนินการ"`
        );
      }

      // อ่าน/เพิ่ม counter
      const counterSnap = await tx.get(counterRef);
      let seq = 0;
      if (!counterSnap.exists) {
        tx.set(
          counterRef,
          { seq: 0, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      } else {
        const d = counterSnap.data() as { seq?: number };
        seq = Number(d?.seq || 0);
      }
      seq += 1;
      tx.update(counterRef, { seq, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      // สร้าง RID
      const rid = `INT-${year}-${pad4(seq)}`;

      // อัปเดตคำขอ
      tx.update(reqRef!, {
        linkedPermitRID: rid,
        status: 'LP รับทราบ (รอผู้รับเหมา)',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { rid };
    });

    // 6) สร้างลิงก์สำหรับผู้รับเหมา (mock)
    const BASE = process.env.CONTRACTOR_FORM_BASE_URL || 'https://your-domain/contractor/form';
    const url = `${BASE}?ref=${encodeURIComponent(result.rid)}&int=${encodeURIComponent(reqRef.path)}`;

    // 7) ส่งคืนให้ UI
    return {
      ok: true,
      rid: result.rid,
      url,
      internalRequestPath: reqRef.path,
    };
  }
);
