// ======================================================================
// File: functions/src/tools/backfillCreatedAt.ts
// เวอร์ชัน: 04/10/2568  (Asia/Bangkok)
// หน้าที่: สคริปต์ Backfill ฟิลด์ createdAt ให้เอกสารในคอลเลกชัน "requests"
// เชื่อม auth ผ่าน "อะแดปเตอร์": Firebase Admin SDK (Service Account ของโปรเจกต์)
// หมายเหตุ:
//   - ใช้ BulkWriter เพื่อเขียนจำนวนมากแบบปลอดภัย + มี retry อัตโนมัติ
//   - dry-run ได้ด้วย --dry-run (ล็อกอย่างเดียวไม่เขียน)
//   - เลือกแหล่งเวลา: audit.createdAt(ms) > decision.at > updatedAt > snapshot.createTime
// ======================================================================

import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_READ = 1000;   // อ่านทีละ 1000 เอกสาร
const MAX_WRITES = 20000;  // safety stop (กันพลาดใส่เลขสูงไป)

function toMillis(anyVal: any): number | undefined {
  if (anyVal == null) return undefined;
  if (typeof anyVal === 'number' && isFinite(anyVal)) {
    const abs = Math.abs(anyVal);
    if (abs < 1e11) return anyVal * 1000;   // sec -> ms
    if (abs < 1e13) return anyVal;          // ms
    if (abs < 1e16) return Math.floor(anyVal / 1000); // µs -> ms
    return Math.floor(anyVal / 1e6);        // ns -> ms
  }
  if (typeof (anyVal as any)?.toMillis === 'function') {
    try { return (anyVal as admin.firestore.Timestamp).toMillis(); } catch {}
  }
  const sec = (anyVal as any)?.seconds ?? (anyVal as any)?._seconds;
  const nsec = (anyVal as any)?.nanoseconds ?? (anyVal as any)?._nanoseconds ?? 0;
  if (typeof sec === 'number') return sec * 1000 + Math.round(nsec / 1e6);

  if (typeof anyVal === 'string') {
    const t = Date.parse(anyVal);
    if (!Number.isNaN(t)) return t;
    const n = Number(anyVal);
    if (Number.isFinite(n)) return toMillis(n);
  }
  return undefined;
}

function pickCreatedAtMillis(doc: admin.firestore.QueryDocumentSnapshot): number {
  const d = doc.data() || {};
  const m1 = toMillis(d?.audit?.createdAt);
  if (m1) return m1;
  const m2 = toMillis(d?.decision?.at);
  if (m2) return m2;
  const m3 = toMillis(d?.updatedAt);
  if (m3) return m3;
  return doc.createTime.toMillis();
}

async function main() {
  console.log(`[backfill] start. dryRun=${DRY_RUN}`);

  let total = 0;
  let updated = 0;

  const bulk = db.bulkWriter();
  bulk.onWriteError((err) => {
    if (err.failedAttempts < 5) return true; // ให้ลองใหม่อัตโนมัติสูงสุด 5 ครั้ง
    console.error('Write failed:', err);
    return false;
  });

  let lastId: string | null = null;
  let safety = 0;

  for (;;) {
    let q = db.collection('requests')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_READ);

    if (lastId) q = q.startAfter(lastId);

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      total += 1;
      lastId = doc.id;

      const hasCreated = Object.prototype.hasOwnProperty.call(doc.data(), 'createdAt');
      if (hasCreated) continue;

      const ms = pickCreatedAtMillis(doc);
      const ts = admin.firestore.Timestamp.fromMillis(ms);

      if (DRY_RUN) {
        console.log(`[dry] will set createdAt for ${doc.id} -> ${new Date(ms).toISOString()}`);
      } else {
        bulk.set(doc.ref, { createdAt: ts }, { merge: true });
        updated += 1;
        safety += 1;
        if (safety >= MAX_WRITES) {
          console.warn(`[backfill] safety stop reached at ${safety} writes`);
          await bulk.close();
          console.log(`[backfill] total=${total}, updated=${updated}`);
          return;
        }
      }
    }
    if (snap.size < BATCH_READ) break; // หมดแล้ว
  }

  if (!DRY_RUN) {
    await bulk.close();
  }

  console.log(`[backfill] done. total=${total}, updated=${updated}, dryRun=${DRY_RUN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
