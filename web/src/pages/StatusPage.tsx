import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n';
import QRCode from 'qrcode';

export default function StatusPage() {
  const { t } = useI18n();
  const [requestId, setRequestId] = useState('');
  const [suffix, setSuffix] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [qr, setQr] = useState('');

  const check = async () => {
    const snap = await getDoc(doc(db, 'requests', requestId));
    if (snap.exists()) {
      const data = snap.data();
      if ((data.contactPhone as string).endsWith(suffix)) {
        setStatus(data.status as string);
        setQr(await QRCode.toDataURL(requestId));
      } else {
        setStatus('Not found');
      }
    } else {
      setStatus('Not found');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">{t.status.title}</h1>
      <input className="border" placeholder={t.status.requestId} value={requestId} onChange={(e) => setRequestId(e.target.value)} />
      <input className="border" placeholder={t.status.phoneSuffix} value={suffix} onChange={(e) => setSuffix(e.target.value)} />
      <button className="bg-blue-500 text-white px-4 py-2" onClick={check}>
        {t.status.check}
      </button>
      {status && <div>Status: {status}</div>}
      {qr && <img src={qr} alt="qr" className="w-32 h-32" />}
      {status && (
        <ul className="list-disc pl-4 text-sm">
          <li>Submitted</li>
          <li>Reviewing</li>
          <li>Approved</li>
        </ul>
      )}
    </div>
  );
}
