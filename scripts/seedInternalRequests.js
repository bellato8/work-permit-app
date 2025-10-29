// ======================================================================
// File: scripts/seedInternalRequests.js
// หน้าที่: สร้างข้อมูล internal_requests ตัวอย่างใน Firebase
// Usage:
//   - Dev (Emulator):  node scripts/seedInternalRequests.js --env=dev <email>
//   - Prod (Real):     node scripts/seedInternalRequests.js --env=prod <email>
// ตัวอย่าง:
//   node scripts/seedInternalRequests.js --env=dev somchai@company.com
//   node scripts/seedInternalRequests.js --env=prod somchai@company.com
// หมายเหตุ: ต้องมี user และ locations อยู่แล้ว
// Updated: 2025-10-29 - เพิ่มการรองรับหลาย environments (Dev/Prod)
// ======================================================================

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ======================================================================
// Environment Configuration
// ⚠️ ห้าม hardcode - ต้องระบุ --env=dev หรือ --env=prod เสมอ
// ======================================================================

const ENV_CONFIGS = {
  dev: {
    projectId: 'work-permit-app-dev',
    appId: 'work-permit-app-dev',
    serviceAccountPath: './admin-sa-dev.json',
    useEmulator: true,
    emulatorPorts: {
      firestore: 8080,
      auth: 9099
    },
    displayName: '🔧 Development (Emulator)',
    color: '\x1b[33m' // Yellow
  },
  prod: {
    projectId: 'work-permit-app-1e9f0',
    appId: 'work-permit-app-1e9f0',
    serviceAccountPath: './admin-sa.json',
    useEmulator: false,
    displayName: '🚀 Production (Real Firebase)',
    color: '\x1b[31m' // Red
  }
};

// ======================================================================
// Helper Functions
// ======================================================================

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);

  let env = null;
  let email = null;

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      const envValue = arg.split('=')[1];
      if (envValue === 'dev' || envValue === 'prod') {
        env = envValue;
      }
    } else if (!arg.startsWith('--')) {
      email = arg;
    }
  }

  return { env, email };
}

/**
 * แสดง usage และ exit
 */
function showUsageAndExit() {
  console.log('\n' + '='.repeat(70));
  console.log('❌ Error: Missing required arguments');
  console.log('='.repeat(70));
  console.log('\nUsage:');
  console.log('  node scripts/seedInternalRequests.js --env=<dev|prod> <email>');
  console.log('\nExamples:');
  console.log('  # Development (Emulator)');
  console.log('  node scripts/seedInternalRequests.js --env=dev somchai@company.com');
  console.log('');
  console.log('  # Production (Real Firebase - ระวัง!)');
  console.log('  node scripts/seedInternalRequests.js --env=prod somchai@company.com');
  console.log('\nOptions:');
  console.log('  --env=dev     Use Development environment (Emulator)');
  console.log('  --env=prod    Use Production environment (Real Firebase)');
  console.log('\nService Account Files Required:');
  console.log('  ./admin-sa-dev.json   - For development environment');
  console.log('  ./admin-sa.json       - For production environment');
  console.log('\nNote:');
  console.log('  - ต้องมี user และ locations อยู่แล้ว');
  console.log('  - Dev ใช้ Firebase Emulator (localhost)');
  console.log('  - Prod ใช้ Firebase จริง (ระวังการแก้ไขข้อมูล!)');
  console.log('='.repeat(70) + '\n');
  process.exit(1);
}

// ======================================================================
// Seed Function
// ======================================================================

async function seedInternalRequests(env, userEmail) {
  const config = ENV_CONFIGS[env];
  const resetColor = '\x1b[0m';

  console.log('\n' + '='.repeat(70));
  console.log('🌱 Seed Internal Requests Script');
  console.log('='.repeat(70));
  console.log(`Environment: ${config.color}${config.displayName}${resetColor}`);
  console.log(`Project ID: ${config.color}${config.projectId}${resetColor}`);
  console.log(`User Email: ${userEmail}`);
  console.log('='.repeat(70) + '\n');

  // ตรวจสอบว่า service account file มีหรือไม่ (สำหรับ prod)
  if (!config.useEmulator) {
    const saPath = path.resolve(__dirname, config.serviceAccountPath);
    if (!fs.existsSync(saPath)) {
      console.error(`❌ Service account file not found: ${config.serviceAccountPath}`);
      console.error(`   Please ensure the file exists at: ${saPath}\n`);
      process.exit(1);
    }
  }

  try {
    // Configure Emulator (ถ้าเป็น dev)
    if (config.useEmulator) {
      console.log('🔧 Configuring Firebase Emulator...');
      process.env.FIRESTORE_EMULATOR_HOST = `localhost:${config.emulatorPorts.firestore}`;
      process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${config.emulatorPorts.auth}`;
      console.log(`   Firestore: localhost:${config.emulatorPorts.firestore}`);
      console.log(`   Auth: localhost:${config.emulatorPorts.auth}\n`);

      // Initialize without service account (Emulator)
      admin.initializeApp({ projectId: config.projectId });
    } else {
      // Initialize with service account (Production)
      console.log('🚀 Connecting to Production Firebase...');
      const saPath = path.resolve(__dirname, config.serviceAccountPath);
      const serviceAccount = require(saPath);

      // Double-check project ID matches
      if (serviceAccount.project_id !== config.projectId) {
        console.error(`❌ Service account project mismatch!`);
        console.error(`   Expected: ${config.projectId}`);
        console.error(`   Got: ${serviceAccount.project_id}\n`);
        process.exit(1);
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.projectId
      });
      console.log(`   ✅ Connected to ${config.projectId}\n`);
    }

    const db = admin.firestore();
    const auth = admin.auth();
    const APP_ID = config.appId;

    // 1. หา user จาก email
    console.log(`🔍 กำลังค้นหา user: ${userEmail}...`);
    const user = await auth.getUserByEmail(userEmail);
    console.log(`✅ เจอ user: ${user.displayName || user.email} (UID: ${user.uid})`);

    // 2. หา locations ที่มีอยู่
    console.log(`\n🔍 กำลังโหลด locations...`);
    const locationsPath = `artifacts/${APP_ID}/public/data/locations`;
    const locsSnap = await db.collection(locationsPath).limit(3).get();

    if (locsSnap.empty) {
      console.error(`❌ ไม่พบ locations กรุณารัน: node scripts/seedLocations.js --env=${env} ก่อน`);
      process.exit(1);
    }

    const locations = locsSnap.docs.map(d => ({
      id: d.id,
      name: d.data().name || d.data().locationName || 'ไม่มีชื่อ',
      floors: d.data().floors || []
    }));

    console.log(`✅ พบ ${locations.length} locations`);

    // 3. Confirmation (สำหรับ prod)
    if (!config.useEmulator) {
      console.log(`\n${config.color}⚠️  WARNING: This will create data in PRODUCTION!${resetColor}`);
      console.log(`   Project: ${config.projectId}`);

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        rl.question('   Type "yes" to continue: ', ans => {
          rl.close();
          resolve(ans);
        });
      });

      if (answer.toLowerCase() !== 'yes') {
        console.log('\n❌ Seed cancelled by user.\n');
        process.exit(0);
      }
      console.log('');
    }

    // 4. สร้างคำขอตัวอย่าง
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

    if (config.useEmulator) {
      console.log(`   - Dashboard: http://localhost:5173/internal/requests`);
      console.log(`   - Firestore UI: http://localhost:4000/firestore`);
    } else {
      console.log(`   - Dashboard: https://${config.projectId}.web.app/internal/requests`);
      console.log(`   - Firebase Console: https://console.firebase.google.com/project/${config.projectId}/firestore`);
    }

    console.log(`\n📝 Login ด้วย: ${user.email}`);
    console.log(`\nEnvironment: ${config.displayName}`);
    console.log(`Project: ${config.projectId}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ เกิดข้อผิดพลาด!');
    console.error('='.repeat(70));
    console.error(`Environment: ${config.displayName}`);
    console.error(`Project: ${config.projectId}`);
    console.error('Error:', error.message);

    if (error.code === 'auth/user-not-found') {
      console.log(`\n💡 สร้าง user ก่อน:`);
      if (config.useEmulator) {
        console.log(`   1. เปิด: http://localhost:4000/auth`);
        console.log(`   2. กด "Add user" กรอก email และ password`);
      } else {
        console.log(`   1. เปิด Firebase Console: https://console.firebase.google.com/project/${config.projectId}/authentication/users`);
        console.log(`   2. กด "Add user" กรอก email และ password`);
      }
      console.log(`   3. รันสคริปต์นี้อีกครั้ง`);
    }

    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }
}

// ======================================================================
// Main
// ======================================================================

const { env, email } = parseArguments();

if (!env || !email) {
  showUsageAndExit();
}

seedInternalRequests(env, email);
