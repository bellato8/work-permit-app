// ======================================================================
// File: scripts/seedInternalRequests.js
// หน้าที่: สร้างข้อมูล internal_requests ตัวอย่างใน Firebase Emulator
// วิธีใช้: node scripts/seedInternalRequests.js <user-email>
// ตัวอย่าง: node scripts/seedInternalRequests.js somchai@company.com
// หมายเหตุ: ต้องมี user และ locations อยู่แล้ว
// ======================================================================

const admin = require('firebase-admin');

// เชื่อม Firebase Admin SDK กับ Emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'work-permit-app-1e9f0' });
const db = admin.firestore();
const auth = admin.auth();

const APP_ID = 'work-permit-app-1e9f0';

// ข้อมูลตัวอย่าง (ต้องมี locations อยู่แล้ว)
async function seedInternalRequests(userEmail) {
  try {
    // 1. หา user จาก email
    console.log(`🔍 กำลังค้นหา user: ${userEmail}...`);
    const user = await auth.getUserByEmail(userEmail);
    console.log(`✅ เจอ user: ${user.displayName || user.email} (UID: ${user.uid})`);

    // 2. หา locations ที่มีอยู่
    console.log(`\n🔍 กำลังโหลด locations...`);
    const locationsPath = `artifacts/${APP_ID}/public/data/locations`;
    const locsSnap = await db.collection(locationsPath).limit(3).get();

    if (locsSnap.empty) {
      console.error(`❌ ไม่พบ locations กรุณารัน: node scripts/seedLocations.js ก่อน`);
      process.exit(1);
    }

    const locations = locsSnap.docs.map(d => ({
      id: d.id,
      name: d.data().name || d.data().locationName || 'ไม่มีชื่อ',
      floors: d.data().floors || []
    }));

    console.log(`✅ พบ ${locations.length} locations`);

    // 3. สร้างคำขอตัวอย่าง
    const requestsPath = `artifacts/${APP_ID}/users/${user.uid}/internal_requests`;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const sampleRequests = [
      {
        requesterEmail: user.email,
        locationId: locations[0].id,
        shopName: locations[0].name,
        floor: locations[0].floors[0]?.name || 'G',
        workDetails: 'ซ่อมระบบไฟฟ้า - เปลี่ยนหลอดไฟและตรวจสอบสายไฟ',
        workStartDateTime: admin.firestore.Timestamp.fromDate(tomorrow),
        workEndDateTime: admin.firestore.Timestamp.fromDate(new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000)),
        contractorName: 'บริษัท ช่างไฟฟ้า จำกัด',
        contractorContactPhone: '081-234-5678',
        status: 'รอดำเนินการ',
      },
      {
        requesterEmail: user.email,
        locationId: locations[0].id,
        shopName: locations[0].name,
        floor: locations[0].floors[1]?.name || '1',
        workDetails: 'ติดตั้งกล้อง CCTV เพิ่มเติม 4 จุด',
        workStartDateTime: admin.firestore.Timestamp.fromDate(new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)),
        workEndDateTime: admin.firestore.Timestamp.fromDate(new Date(tomorrow.getTime() + 30 * 60 * 60 * 1000)),
        contractorName: 'บริษัท ระบบรักษาความปลอดภัย จำกัด',
        contractorContactPhone: '082-345-6789',
        status: 'LP รับทราบ (รอผู้รับเหมา)',
        linkedPermitRID: 'INT-2025-0001',
      },
      {
        requesterEmail: user.email,
        locationId: locations.length > 1 ? locations[1].id : locations[0].id,
        shopName: locations.length > 1 ? locations[1].name : locations[0].name,
        floor: locations.length > 1 ? (locations[1].floors[0]?.name || 'G') : 'G',
        workDetails: 'ทำความสะอาดท่อระบายน้ำ',
        workStartDateTime: admin.firestore.Timestamp.fromDate(nextWeek),
        workEndDateTime: admin.firestore.Timestamp.fromDate(new Date(nextWeek.getTime() + 3 * 60 * 60 * 1000)),
        contractorName: 'บริษัท ทำความสะอาด จำกัด',
        contractorContactPhone: '083-456-7890',
        status: 'รอ LP ตรวจสอบ',
        linkedPermitRID: 'INT-2025-0002',
      },
      {
        requesterEmail: user.email,
        locationId: locations.length > 2 ? locations[2].id : locations[0].id,
        shopName: locations.length > 2 ? locations[2].name : locations[0].name,
        floor: 'G',
        workDetails: 'ซ่อมแอร์เสีย - เปลี่ยนคอมเพรสเซอร์',
        workStartDateTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
        workEndDateTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)),
        contractorName: 'บริษัท ช่างแอร์ จำกัด',
        contractorContactPhone: '084-567-8901',
        status: 'อนุมัติเข้าทำงาน',
        linkedPermitRID: 'INT-2024-0099',
      }
    ];

    console.log(`\n🌱 กำลังสร้างข้อมูล internal_requests...`);
    console.log(`📂 Path: ${requestsPath}\n`);

    const batch = db.batch();
    const collectionRef = db.collection(requestsPath);

    for (const req of sampleRequests) {
      const docRef = collectionRef.doc();
      batch.set(docRef, {
        ...req,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const statusIcon =
        req.status === 'รอดำเนินการ' ? '🟡' :
        req.status === 'LP รับทราบ (รอผู้รับเหมา)' ? '🔵' :
        req.status === 'รอ LP ตรวจสอบ' ? '🟠' :
        req.status === 'อนุมัติเข้าทำงาน' ? '✅' :
        req.status === 'ไม่อนุมัติ' ? '❌' : '⚪';

      console.log(`  ${statusIcon} ${req.workDetails.substring(0, 40)}... - ${req.status}`);
    }

    await batch.commit();

    console.log(`\n✅ สร้างข้อมูล ${sampleRequests.length} รายการสำเร็จ!`);
    console.log(`\n💡 ทดสอบได้ที่:`);
    console.log(`   - Dashboard: http://localhost:5173/internal/requests`);
    console.log(`   - Firestore UI: http://localhost:4000/firestore`);
    console.log(`\n📝 Login ด้วย: ${user.email}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);

    if (error.code === 'auth/user-not-found') {
      console.log(`\n💡 สร้าง user ก่อน:`);
      console.log(`   1. เปิด: http://localhost:4000/auth`);
      console.log(`   2. กด "Add user" กรอก email และ password`);
      console.log(`   3. รันสคริปต์นี้อีกครั้ง`);
    }

    process.exit(1);
  }
}

// อ่าน email จาก command line
const email = process.argv[2];

if (!email) {
  console.error('❌ กรุณาระบุ email');
  console.log('วิธีใช้: node scripts/seedInternalRequests.js <email>');
  console.log('ตัวอย่าง: node scripts/seedInternalRequests.js somchai@company.com');
  process.exit(1);
}

seedInternalRequests(email);
