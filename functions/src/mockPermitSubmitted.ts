// ======================================================================
// File: functions/src/mockPermitSubmitted.ts
// เวอร์ชัน: 27/10/2025 02:15 (Asia/Bangkok)
// หน้าที่: Cloud Function (callable, v2) สำหรับทดสอบ/จำลองการที่ผู้รับเหมา
//          กรอกฟอร์ม (Module 3) เสร็จและส่งมา → อัปเดตสถานะเป็น 'รอ LP ตรวจสอบ'
//
// ⚠️ หมายเหตุสำคัญ: ฟังก์ชันนี้เป็น MOCK สำหรับทดสอบเท่านั้น
//    ใน Production จริง Module 3 (Contractor Form) จะเป็นผู้อัปเดตสถานะ
//    ฟังก์ชันนี้ช่วยให้ทดสอบ workflow ได้โดยไม่ต้องรอ Module 3 เสร็จ
//
// Input:
//   - linkedPermitRID: RID ที่สร้างจาก createContractorLink (เช่น INT-2025-0001)
//   หรือ
//   - internalRequestPath: path เต็มของ internal_requests doc
//
// Output:
//   - success: true/false
//   - message: ข้อความผลลัพธ์
//   - internalRequestPath: path ของ doc ที่อัปเดต
//
// เปลี่ยนแปลงรอบนี้:
//   • สร้างใหม่เพื่อจำลองการส่งฟอร์มผู้รับเหมา
//   • อัปเดตสถานะจาก 'LP รับทราบ (รอผู้รับเหมา)' → 'รอ LP ตรวจสอบ'
//   • เพิ่มข้อมูล mock สำหรับผู้รับเหมา (ชื่อ, เบอร์, วันที่ส่ง)
// ผู้สร้าง: เพื่อนคู่คิด
// อัปเดตล่าสุด: 27/10/2025 02:15
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

interface MockPermitInput {
  linkedPermitRID?: string;       // RID เช่น INT-2025-0001 (แนะนำ)
  internalRequestPath?: string;   // หรือส่ง path เต็มมาเลย
}

interface ContractorMockData {
  contractorCompanyName: string;
  contractorContactPerson: string;
  contractorPhone: string;
  contractorSubmittedAt: FirebaseFirestore.FieldValue;
}

/**
 * ฟังก์ชันจำลองการที่ผู้รับเหมากรอกฟอร์มเสร็จและส่งมา
 *
 * ⚠️ MOCK FUNCTION - สำหรับทดสอบเท่านั้น
 * ใน Production จริง Module 3 จะทำหน้าที่นี้
 */
export const mockPermitSubmitted = onCall(
  { region: process.env.FUNCTIONS_REGION || 'us-central1' },
  async (request: CallableRequest<MockPermitInput>) => {
    console.log('🎭 [MOCK] mockPermitSubmitted called with:', request.data);

    // 1) รับข้อมูล
    const linkedPermitRID = (request.data?.linkedPermitRID || '').trim();
    const internalRequestPath = (request.data?.internalRequestPath || '').trim();

    if (!linkedPermitRID && !internalRequestPath) {
      throw new HttpsError(
        'invalid-argument',
        'ต้องระบุ linkedPermitRID (แนะนำ) หรือ internalRequestPath อย่างน้อยหนึ่งค่า'
      );
    }

    // 2) หาเอกสารคำขอ
    let reqRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> | null = null;

    if (internalRequestPath) {
      // ใช้ path ตรงๆ
      reqRef = db.doc(internalRequestPath);
    } else if (linkedPermitRID) {
      // ค้นหาจาก RID ผ่าน collectionGroup
      const snap = await db
        .collectionGroup('internal_requests')
        .where('linkedPermitRID', '==', linkedPermitRID)
        .limit(1)
        .get();

      if (!snap.empty) {
        reqRef = snap.docs[0].ref;
      }
    }

    if (!reqRef) {
      throw new HttpsError(
        'not-found',
        `ไม่พบคำขอที่มี RID = "${linkedPermitRID}" หรือ path = "${internalRequestPath}"`
      );
    }

    // 3) ตรวจสอบเอกสารและสถานะปัจจุบัน
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError('not-found', 'เอกสารคำขอไม่มีอยู่จริง');
    }

    const reqData = reqSnap.data() as {
      status?: InternalStatus;
      linkedPermitRID?: string;
    } | undefined;

    const currentStatus = (reqData?.status || 'รอดำเนินการ') as InternalStatus;

    // ตรวจสอบว่าสถานะถูกต้องหรือไม่
    if (currentStatus !== 'LP รับทราบ (รอผู้รับเหมา)') {
      throw new HttpsError(
        'failed-precondition',
        `สถานะปัจจุบันคือ "${currentStatus}" — ฟังก์ชันนี้ทำงานได้เฉพาะสถานะ "LP รับทราบ (รอผู้รับเหมา)"`
      );
    }

    // 4) สร้างข้อมูล mock สำหรับผู้รับเหมา
    const mockData: ContractorMockData = {
      contractorCompanyName: 'บริษัท ผู้รับเหมาทดสอบ จำกัด',
      contractorContactPerson: 'คุณสมชาย ทดสอบ',
      contractorPhone: '081-234-5678',
      contractorSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 5) อัปเดตสถานะและข้อมูล mock
    await reqRef.update({
      status: 'รอ LP ตรวจสอบ',
      ...mockData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ [MOCK] อัปเดตสำเร็จ: ${reqRef.path}`);
    console.log(`   สถานะ: ${currentStatus} → รอ LP ตรวจสอบ`);

    // 6) คืนค่าผลลัพธ์
    return {
      success: true,
      message: '✅ จำลองการส่งฟอร์มผู้รับเหมาสำเร็จ',
      internalRequestPath: reqRef.path,
      oldStatus: currentStatus,
      newStatus: 'รอ LP ตรวจสอบ',
      mockData,
    };
  }
);
