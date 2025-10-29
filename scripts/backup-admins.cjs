// ======================================================================
// File: scripts/backup-admins.cjs
// Purpose: สำรองข้อมูลคอลเลกชัน "admins" ลงไฟล์ JSON
// Usage:   
//   - Dev:  node scripts/backup-admins.cjs
//   - Prod: NODE_ENV=production node scripts/backup-admins.cjs
// ======================================================================

const fs = require('fs');
const admin = require('firebase-admin');

// เลือก Service Account ตาม Environment
const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const saFile = isProd ? './admin-sa.json' : './admin-sa-dev.json';

console.log('🔧 Environment:', env);
console.log('📁 Using Service Account:', saFile);

// ตรวจสอบว่าไฟล์ Service Account มีอยู่หรือไม่
if (!fs.existsSync(saFile)) {
  console.error(`❌ Error: Service Account file not found: ${saFile}`);
  console.error('   Please make sure you have the correct file in the scripts directory.');
  process.exit(1);
}

const sa = require(saFile);
const projectId = sa.project_id;

console.log('🎯 Target Project:', projectId);
console.log('');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  console.log('📊 Fetching admins from Firestore...');
  const snap = await db.collection('admins').get();
  const out = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // เพิ่มชื่อ Environment ในชื่อไฟล์เพื่อไม่ให้สับสน
  const envLabel = isProd ? 'prod' : 'dev';
  const fname = `backup-admins-${envLabel}-${new Date().toISOString().slice(0,10)}.json`;
  
  fs.writeFileSync(fname, JSON.stringify(out, null, 2), 'utf8');

  console.log('✅ Backup saved:', fname);
  console.log('📈 Total records:', out.length);
  console.log('');
  process.exit(0);
})().catch(err => {
  console.error('❌ Backup failed:', err?.message || err);
  process.exit(1);
});
