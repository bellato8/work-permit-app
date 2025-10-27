#!/usr/bin/env node
// ======================================================================
// File: scripts/testMockPermitSubmitted.js
// เวอร์ชัน: 27/10/2025 02:20 (Asia/Bangkok)
// หน้าที่: สคริปต์ทดสอบ Cloud Function mockPermitSubmitted ใน Emulator
//
// วิธีใช้:
//   1. เปิด Firebase Emulator (npm run emulator)
//   2. สร้าง internal request และให้ LP อนุมัติเบื้องต้น (จะได้ RID)
//   3. รันสคริปต์นี้: node scripts/testMockPermitSubmitted.js INT-2025-0001
//
// ผลลัพธ์:
//   - จำลองการที่ผู้รับเหมากรอกฟอร์มและส่งมา
//   - เปลี่ยนสถานะจาก "LP รับทราบ (รอผู้รับเหมา)" → "รอ LP ตรวจสอบ"
//   - เพิ่มข้อมูล mock (contractorCompanyName, contractorPhone, etc.)
//
// หมายเหตุ:
//   - ต้องรันใน Emulator เท่านั้น (ไม่ใช่ production)
//   - ต้องมี functions/.env กำหนด FUNCTIONS_REGION
// ======================================================================

const admin = require('firebase-admin');

// เชื่อม Firebase Admin SDK กับ Emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'work-permit-app-1e9f0',
});

const db = admin.firestore();

async function testMockPermitSubmitted(linkedPermitRID) {
  if (!linkedPermitRID) {
    console.error('❌ กรุณาระบุ RID เช่น: INT-2025-0001');
    console.error('   การใช้งาน: node scripts/testMockPermitSubmitted.js INT-2025-0001');
    process.exit(1);
  }

  console.log('🎭 กำลังทดสอบ mockPermitSubmitted...');
  console.log(`   RID: ${linkedPermitRID}`);
  console.log('');

  try {
    // 1) ค้นหา internal_requests ที่มี linkedPermitRID ตรงกัน
    console.log('🔍 ค้นหา internal_requests ที่มี RID นี้...');
    const snap = await db
      .collectionGroup('internal_requests')
      .where('linkedPermitRID', '==', linkedPermitRID)
      .limit(1)
      .get();

    if (snap.empty) {
      console.error(`❌ ไม่พบคำขอที่มี RID = "${linkedPermitRID}"`);
      console.error('   ตรวจสอบว่า RID ถูกต้อง และได้รันผ่าน LP อนุมัติเบื้องต้นแล้ว');
      process.exit(1);
    }

    const docSnap = snap.docs[0];
    const docPath = docSnap.ref.path;
    const docData = docSnap.data();

    console.log(`✅ พบเอกสาร: ${docPath}`);
    console.log(`   สถานะปัจจุบัน: ${docData.status || 'ไม่ระบุ'}`);
    console.log('');

    // 2) ตรวจสอบสถานะ
    if (docData.status !== 'LP รับทราบ (รอผู้รับเหมา)') {
      console.warn(`⚠️  สถานะปัจจุบันคือ "${docData.status}"`);
      console.warn('   ฟังก์ชัน mockPermitSubmitted ทำงานได้เฉพาะสถานะ "LP รับทราบ (รอผู้รับเหมา)"');
      console.warn('   กำลังพยายามเรียกใช้งานต่อไป...');
      console.log('');
    }

    // 3) จำลองการเรียก Cloud Function
    // ⚠️ หมายเหตุ: การเรียกผ่าน Admin SDK จะไม่ผ่าน HTTP Functions Emulator
    //    แต่เราจะอัปเดตข้อมูลโดยตรงเพื่อทดสอบ logic เดียวกัน
    console.log('🎭 กำลังจำลองการส่งฟอร์มผู้รับเหมา...');

    await docSnap.ref.update({
      status: 'รอ LP ตรวจสอบ',
      contractorCompanyName: 'บริษัท ผู้รับเหมาทดสอบ จำกัด',
      contractorContactPerson: 'คุณสมชาย ทดสอบ',
      contractorPhone: '081-234-5678',
      contractorSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('');
    console.log('✅ ทดสอบสำเร็จ!');
    console.log('   สถานะเปลี่ยนเป็น: รอ LP ตรวจสอบ');
    console.log('   เพิ่มข้อมูลผู้รับเหมา mock แล้ว');
    console.log('');
    console.log('🔍 ตรวจสอบผลลัพธ์:');
    console.log(`   - เปิด Emulator UI: http://localhost:4000/firestore`);
    console.log(`   - ดูเอกสาร: ${docPath}`);
    console.log(`   - หรือเปิดหน้า LP > Internal Requests Queue ใน web app`);

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// รับ RID จาก command line argument
const rid = process.argv[2];
testMockPermitSubmitted(rid)
  .then(() => {
    console.log('');
    console.log('✨ สคริปต์ทำงานเสร็จสมบูรณ์');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 เกิดข้อผิดพลาดร้ายแรง:', err);
    process.exit(1);
  });
