// ======================================================================
// File: scripts/seedInternalUsers.js
// หน้าที่: สร้างข้อมูล users_internal ตัวอย่างใน Firebase Emulator
// วิธีใช้: node scripts/seedInternalUsers.js
// ======================================================================

const admin = require('firebase-admin');

// เชื่อม Firebase Admin SDK กับ Emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId: 'work-permit-app-1e9f0' });
const db = admin.firestore();

const APP_ID = 'work-permit-app-1e9f0';
const USERS_INTERNAL_PATH = `artifacts/${APP_ID}/public/data/users_internal`;

// ข้อมูลตัวอย่าง (พนักงานภายใน)
const sampleUsers = [
  {
    email: 'somchai@company.com',
    fullName: 'สมชาย ใจดี',
    department: 'วิศวกรรมซ่อมบำรุง'
  },
  {
    email: 'sukhuma@company.com',
    fullName: 'สุขุมา รักษ์ดี',
    department: 'แผนกบริหาร'
  },
  {
    email: 'wichai@company.com',
    fullName: 'วิชัย มั่นคง',
    department: 'ความปลอดภัย'
  },
  {
    email: 'arunee@company.com',
    fullName: 'อรุณี สว่างใจ',
    department: 'จัดซื้อ'
  },
  {
    email: 'prasert@company.com',
    fullName: 'ประเสริฐ สุขสันต์',
    department: 'วิศวกรรมซ่อมบำรุง'
  },
  {
    email: 'nittaya@company.com',
    fullName: 'นิตยา ปัญญาดี',
    department: 'การตลาด'
  },
  {
    email: 'somkid@company.com',
    fullName: 'สมคิด เจริญทรัพย์',
    department: 'แผนกบริหาร'
  }
];

async function seedInternalUsers() {
  try {
    console.log(`🌱 กำลังสร้างข้อมูล users_internal ตัวอย่าง...`);
    console.log(`📂 Path: ${USERS_INTERNAL_PATH}\n`);

    const batch = db.batch();
    const collectionRef = db.collection(USERS_INTERNAL_PATH);

    for (const user of sampleUsers) {
      const docRef = collectionRef.doc();
      batch.set(docRef, {
        ...user,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`  ✅ ${user.fullName} (${user.email}) - ${user.department}`);
    }

    await batch.commit();

    console.log(`\n✅ สร้างข้อมูล ${sampleUsers.length} รายการสำเร็จ!`);
    console.log(`\n💡 ดูข้อมูลได้ที่: http://localhost:4000/firestore`);
    console.log(`   หรือเปิดหน้า: http://localhost:5173/admin/lp/internal-users`);

    process.exit(0);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  }
}

seedInternalUsers();
