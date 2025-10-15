// ======================================================================
// File: scripts/backup-admins.cjs
// Purpose: สำรองข้อมูลคอลเลกชัน "admins" ลงไฟล์ JSON
// Usage:   node scripts/backup-admins.cjs
// ======================================================================

const fs = require('fs');
const admin = require('firebase-admin');
const sa = require('./admin-sa.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('admins').get();
  const out = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const fname = `backup-admins-${new Date().toISOString().slice(0,10)}.json`;
  fs.writeFileSync(fname, JSON.stringify(out, null, 2), 'utf8');

  console.log('✅ Backup saved:', fname, '• records:', out.length);
  process.exit(0);
})().catch(err => {
  console.error('❌ Backup failed:', err?.message || err);
  process.exit(1);
});
