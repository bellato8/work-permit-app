// ======================================================================
// File: functions/src/createContractorLink.ts
// เวอร์ชัน: 30/10/2025 (Asia/Bangkok)
// หน้าที่: Cloud Function (callable, v2) สำหรับ LP Admin เพื่อ "อนุมัติเบื้องต้น"
//          - สร้าง RID รูปแบบ INT-YYYYMMDD-XXXXXX (วันที่ + 6 ตัวอักษรสุ่ม)
//          - อัปเดต internal_requests: linkedPermitRID + สถานะ 'LP รับทราบ (รอผู้รับเหมา)'
//          - คืน URL สำหรับผู้รับเหมา: <base-url>/form?rid=<rid>
// เชื่อม auth ผ่าน "อะแดปเตอร์": Firebase Auth (Custom Claims) + Firestore (Admin SDK)
// เปลี่ยนแปลงรอบนี้:
//   • เปลี่ยนรูปแบบ RID จาก INT-YYYY-#### เป็น INT-YYYYMMDD-XXXXXX
//   • ใช้สุ่มตัวอักษรแทนการใช้ counter (ป้องกัน enumeration attacks)
//   • URL ใหม่: /form?rid=<rid> (ไม่มี int parameter)
// ผู้แก้ไข: Claude Code
// อัปเดตล่าสุด: 30/10/2025
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

function generateRandomAlphanumeric(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateLinkedPermitRID(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = generateRandomAlphanumeric(6);
  return `INT-${year}${month}${day}-${random}`;
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

    // 4) สร้าง RID แบบใหม่ (INT-YYYYMMDD-XXXXXX)
    const rid = generateLinkedPermitRID();

    // 5) Transaction: ตรวจสถานะ + อัปเดต
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

      // อัปเดตคำขอด้วย RID ใหม่และเปลี่ยนสถานะ
      tx.update(reqRef!, {
        linkedPermitRID: rid,
        status: 'LP รับทราบ (รอผู้รับเหมา)',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { rid };
    });

    // 6) สร้างลิงก์สำหรับผู้รับเหมา
    const BASE = process.env.CONTRACTOR_FORM_BASE_URL || 'https://your-domain.com';
    const url = `${BASE}/form?rid=${encodeURIComponent(result.rid)}`;

    // 7) ส่งคืนให้ UI
    return {
      rid: result.rid,
      url,
    };
  }
);
