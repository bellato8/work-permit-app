// ======================================================================
// File: functions/scripts/migrateRequests.js
// เวอร์ชัน: 2025-10-11 (Task 12)
// หน้าที่: Migration Script เพิ่มฟิลด์ใหม่ 3 ฟิลด์ใน Collection requests
//          - dailyStatus: "scheduled" (ค่าเริ่มต้น)
//          - lastCheckIn: null
//          - lastCheckOut: null
// วิธีใช้:
//   1. ตรวจสอบว่ามี service-account-key.json ใน functions/
//   2. cd functions
//   3. node scripts/migrateRequests.js
// หมายเหตุ:
//   - อัปเดตเฉพาะ documents ที่ยังไม่มีฟิลด์ dailyStatus
//   - ใช้ batch write (ได้สูงสุด 500 docs/batch)
//   - Safe สำหรับ Production (ไม่ซ้ำซ้อน)
// ======================================================================

const admin = require("firebase-admin");
const path = require("path");

// ─────────────────────────────────────────────────────────────────────
// 🔧 CONFIG: แก้ path ของ Service Account Key ตามโครงสร้างโปรเจกต์
// ─────────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "../service-account-key.json");

// ตรวจสอบว่ามีไฟล์หรือไม่
const fs = require("fs");
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ ไม่พบไฟล์:", SERVICE_ACCOUNT_PATH);
  console.error("📌 วิธีแก้:");
  console.error("   1. ไปที่ Firebase Console > Project Settings > Service Accounts");
  console.error("   2. กด 'Generate new private key'");
  console.error("   3. บันทึกเป็น service-account-key.json ใน functions/");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────
// 📊 MAIN FUNCTION: อัปเดต requests collection
// ─────────────────────────────────────────────────────────────────────
async function migrateRequests() {
  console.log("🚀 เริ่ม Migration สำหรับ Collection: requests");
  console.log("📅 เวลา:", new Date().toISOString());
  console.log("─".repeat(60));

  const requestsRef = db.collection("requests");
  const snapshot = await requestsRef.get();

  if (snapshot.empty) {
    console.log("⚠️  Collection requests ว่างเปล่า - ไม่มีข้อมูลให้ migrate");
    process.exit(0);
  }

  console.log(`📦 พบ ${snapshot.size} documents ใน requests collection`);

  let countAlreadyMigrated = 0;
  let countNeedsMigration = 0;
  const batch = db.batch();
  const BATCH_LIMIT = 500; // Firestore batch limit

  snapshot.forEach((doc) => {
    const data = doc.data();

    // เช็คว่ามีฟิลด์ dailyStatus หรือยัง
    if (data.dailyStatus !== undefined) {
      countAlreadyMigrated++;
      return; // ข้าม document นี้
    }

    // ต้อง migrate
    countNeedsMigration++;

    // อัปเดต document ด้วย 3 ฟิลด์ใหม่
    batch.update(doc.ref, {
      dailyStatus: "scheduled",      // ค่าเริ่มต้น: งานที่จะเข้า
      lastCheckIn: null,              // ยังไม่เช็คอิน
      lastCheckOut: null,             // ยังไม่เช็คเอาท์
    });

    // ถ้าใกล้ถึง limit ให้ commit batch
    if (countNeedsMigration % BATCH_LIMIT === 0) {
      console.log(`⏳ กำลัง commit batch (${countNeedsMigration} docs)...`);
    }
  });

  // สรุปผล
  console.log("─".repeat(60));
  console.log("📊 สรุปผลการ Migration:");
  console.log(`   ✅ Documents ที่มีฟิลด์แล้ว: ${countAlreadyMigrated}`);
  console.log(`   🔧 Documents ที่ต้อง migrate: ${countNeedsMigration}`);

  // Commit batch
  if (countNeedsMigration > 0) {
    console.log("⏳ กำลัง commit การเปลี่ยนแปลงไปยัง Firestore...");
    await batch.commit();
    console.log(`✅ Migration สำเร็จ! อัปเดต ${countNeedsMigration} documents`);
  } else {
    console.log("✅ ทุก documents มีฟิลด์ครบแล้ว - ไม่จำเป็นต้อง migrate");
  }

  console.log("─".repeat(60));
  console.log("🎉 Migration เสร็จสิ้น!");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────
// 🔧 ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────
migrateRequests().catch((error) => {
  console.error("❌ เกิดข้อผิดพลาดระหว่าง Migration:");
  console.error(error);
  process.exit(1);
});
