// ======================================================================
// File: scripts/setSuperadmin.js
// หน้าที่: ตั้งค่า custom claims superadmin ให้ user ใน Firebase Emulator
// วิธีใช้: node scripts/setSuperadmin.js <email>
// ตัวอย่าง: node scripts/setSuperadmin.js admin@example.com
// ======================================================================

const admin = require('firebase-admin');

// เชื่อม Firebase Admin SDK กับ Emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'work-permit-app-1e9f0' });

async function setSuperadmin(email) {
  try {
    // หา user จาก email
    console.log(`🔍 กำลังค้นหา user: ${email}...`);
    const user = await admin.auth().getUserByEmail(email);

    console.log(`✅ เจอ user: ${user.displayName || user.email} (UID: ${user.uid})`);

    // ตั้ง custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      role: 'superadmin',
      isSuperadmin: true,
      isAdmin: true
    });

    console.log(`✅ ตั้งค่า superadmin สำเร็จ!`);
    console.log(`📝 Custom Claims:`, {
      role: 'superadmin',
      isSuperadmin: true,
      isAdmin: true
    });

    console.log(`\n💡 หมายเหตุ: user ต้อง login ใหม่เพื่อให้ token อัปเดต`);

    process.exit(0);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);

    if (error.code === 'auth/user-not-found') {
      console.log(`\n💡 คำแนะนำ: สร้าง user ก่อนด้วย Firebase Emulator UI`);
      console.log(`   - เปิด: http://localhost:4000/auth`);
      console.log(`   - กด "Add user" แล้วกรอก email และ password`);
    }

    process.exit(1);
  }
}

// อ่าน email จาก command line
const email = process.argv[2];

if (!email) {
  console.error('❌ กรุณาระบุ email');
  console.log('วิธีใช้: node scripts/setSuperadmin.js <email>');
  console.log('ตัวอย่าง: node scripts/setSuperadmin.js admin@example.com');
  process.exit(1);
}

setSuperadmin(email);
