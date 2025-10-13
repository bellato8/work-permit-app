// ======================================================================
// File: functions/scripts/initCollections.js
// Task 11: Initialize checkIns & checkOuts Collections
// วิธีใช้: node functions/scripts/initCollections.js
// ======================================================================

const admin = require("firebase-admin");

// ตรวจสอบว่ามี service account key หรือไม่
let serviceAccount;
try {
  serviceAccount = require("../service-account-key.json");
} catch (error) {
  console.log("⚠️  ไม่พบไฟล์ service-account-key.json");
  console.log("💡 กรุณาดาวน์โหลดจาก Firebase Console → Project Settings → Service Accounts");
  console.log("💡 หรือใช้ GOOGLE_APPLICATION_CREDENTIALS environment variable");
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * สร้าง Collections พร้อมเอกสารตัวอย่าง
 */
async function initCollections() {
  console.log("\n🔧 เริ่มสร้าง Collections...\n");

  try {
    // ===== 1. สร้าง checkIns collection =====
    console.log("📝 กำลังสร้าง checkIns collection...");
    
    const checkInRef = db.collection("checkIns").doc("_init");
    await checkInRef.set({
      requestId: "_example",
      checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
      checkedInBy: {
        uid: "_system",
        email: "system@example.com",
        name: "System Init"
      },
      notes: "This is an example document for initialization. You can delete this.",
      status: "checked-in",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("✅ checkIns collection สร้างเสร็จแล้ว (document ID: _init)");

    // ===== 2. สร้าง checkOuts collection =====
    console.log("📝 กำลังสร้าง checkOuts collection...");
    
    const checkOutRef = db.collection("checkOuts").doc("_init");
    await checkOutRef.set({
      requestId: "_example",
      checkInId: "_init",
      checkedOutAt: admin.firestore.FieldValue.serverTimestamp(),
      checkedOutBy: {
        uid: "_system",
        email: "system@example.com",
        name: "System Init"
      },
      notes: "This is an example document for initialization. You can delete this.",
      status: "checked-out",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("✅ checkOuts collection สร้างเสร็จแล้ว (document ID: _init)");

    // ===== สรุป =====
    console.log("\n🎉 สร้าง Collections สำเร็จ!\n");
    console.log("📋 สิ่งที่ต้องทำต่อ:");
    console.log("   1. เปิด Firebase Console → Firestore Database");
    console.log("   2. ตรวจสอบว่ามี collections: checkIns และ checkOuts");
    console.log("   3. สร้าง Indexes (ดูคำแนะนำด้านล่าง)");
    console.log("   4. ลบเอกสาร _init ได้ (ถ้าต้องการ)\n");
    
    console.log("📊 Indexes ที่ต้องสร้าง:");
    console.log("   Collection: checkIns");
    console.log("   - requestId (Ascending)");
    console.log("   - checkedInAt (Descending)");
    console.log("   - status (Ascending)\n");
    
    console.log("   Collection: checkOuts");
    console.log("   - requestId (Ascending)");
    console.log("   - checkedOutAt (Descending)");
    console.log("   - status (Ascending)\n");
    
    console.log("🔗 สร้าง Indexes ได้ที่:");
    console.log("   https://console.firebase.google.com/project/work-permit-app-1e9f0/firestore/indexes\n");

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
    process.exit(1);
  }

  process.exit(0);
}

// เรียกใช้งาน
initCollections();