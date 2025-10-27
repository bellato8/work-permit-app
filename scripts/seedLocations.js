// ======================================================================
// File: scripts/seedLocations.js
// หน้าที่: สร้างข้อมูล locations ตัวอย่างใน Firebase Emulator
// วิธีใช้: node scripts/seedLocations.js
// ======================================================================

const admin = require('firebase-admin');
const { v4: uuid } = require('uuid');

// เชื่อม Firebase Admin SDK กับ Emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId: 'work-permit-app-1e9f0' });
const db = admin.firestore();

const APP_ID = 'work-permit-app-1e9f0';
const LOCATIONS_PATH = `artifacts/${APP_ID}/public/data/locations`;

// ข้อมูลตัวอย่าง (ตามฟอร์มกระดาษที่แนบ)
const sampleLocations = [
  {
    name: 'อาคาร A',
    floors: [
      { id: uuid(), name: 'G', isActive: true },
      { id: uuid(), name: '1', isActive: true },
      { id: uuid(), name: '2', isActive: true },
      { id: uuid(), name: 'M', isActive: true }
    ],
    isActive: true
  },
  {
    name: 'อาคาร B',
    floors: [
      { id: uuid(), name: 'G', isActive: true },
      { id: uuid(), name: '1', isActive: true },
      { id: uuid(), name: '2', isActive: true },
      { id: uuid(), name: '3', isActive: true }
    ],
    isActive: true
  },
  {
    name: 'ศูนย์อิเวนท์',
    floors: [
      { id: uuid(), name: 'G', isActive: true },
      { id: uuid(), name: '1', isActive: true }
    ],
    isActive: true
  },
  {
    name: 'ลานจอดรถ',
    floors: [
      { id: uuid(), name: 'B1', isActive: true },
      { id: uuid(), name: 'B2', isActive: true }
    ],
    isActive: true
  },
  {
    name: 'โซน Food Court',
    floors: [
      { id: uuid(), name: 'G', isActive: true }
    ],
    isActive: false // ตัวอย่างที่ปิดใช้งาน
  }
];

async function seedLocations() {
  try {
    console.log(`🌱 กำลังสร้างข้อมูล locations ตัวอย่าง...`);
    console.log(`📂 Path: ${LOCATIONS_PATH}\n`);

    const batch = db.batch();
    const collectionRef = db.collection(LOCATIONS_PATH);

    for (const location of sampleLocations) {
      const docRef = collectionRef.doc();
      batch.set(docRef, {
        ...location,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const floorsText = location.floors.map(f => f.name).join(', ');
      const statusIcon = location.isActive ? '✅' : '❌';
      console.log(`  ${statusIcon} ${location.name} (ชั้น: ${floorsText})`);
    }

    await batch.commit();

    console.log(`\n✅ สร้างข้อมูล ${sampleLocations.length} รายการสำเร็จ!`);
    console.log(`\n💡 ดูข้อมูลได้ที่: http://localhost:4000/firestore`);
    console.log(`   หรือเปิดหน้า: http://localhost:5173/admin/lp/locations`);

    process.exit(0);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  }
}

seedLocations();
