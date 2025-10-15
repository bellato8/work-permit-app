// ======================================================================
// File: scripts/verify-permissions.cjs
// Purpose: ตรวจสอบผลลัพธ์หลัง migrate ว่ามี pagePermissions ครบหรือไม่
// Usage:   node scripts/verify-permissions.cjs
// ======================================================================

const admin = require('firebase-admin');
const sa = require('./admin-sa.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const expectedPages = [
  'dashboard','approvals','permits','dailyWork','reports',
  'users','logs','cleanup','settings'
];

(async () => {
  const snap = await db.collection('admins').get();
  let ok = 0, warn = 0;

  console.log('\n=== Verify pagePermissions (admins) ===\n');
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const pp = data.pagePermissions || null;
    const has = !!pp;

    // นับจำนวนหน้าที่เปิดดูได้ (canView === true)
    let viewCount = 0;
    if (has) {
      for (const k of Object.keys(pp)) {
        const v = pp[k];
        const cv = (v && typeof v.canView === 'boolean') ? v.canView : true;
        if (cv) viewCount++;
      }
    }

    // เช็กว่าขาดหน้าบังคับไหม
    const missing = has ? expectedPages.filter(k => !(k in pp)) : expectedPages;

    const line = [
      `• ${doc.id}`,
      `role=${data.role || '—'}`,
      `hasPP=${has ? 'yes' : 'no'}`,
      `viewable=${viewCount}`
    ].join(' | ');

    if (!has || missing.length > 0) {
      console.log(line);
      if (!has) {
        console.log('  ⚠️  missing: all (no pagePermissions)');
      } else {
        console.log('  ⚠️  missing:', missing.join(', '));
      }
      warn++;
    } else {
      console.log(line);
      ok++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ OK: ${ok}`);
  console.log(`⚠️  Need attention: ${warn}`);
  console.log(`📊 Total: ${snap.size}\n`);

  process.exit(0);
})().catch(err => {
  console.error('❌ Verify failed:', err?.message || err);
  process.exit(1);
});
