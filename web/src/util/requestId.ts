import { doc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function generateRequestId() {
  const date = new Date();
  const datePart = date
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const counterRef = doc(db, 'counters', datePart);
  const count = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().count as number) : 0;
    tx.set(counterRef, { count: increment(1) }, { merge: true });
    return current + 1;
  });
  const num = String(count).padStart(4, '0');
  return `IWSR-${datePart}-${num}`;
}
