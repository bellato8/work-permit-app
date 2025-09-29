// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/components/StampedPreview.tsx  (NEW)
// อธิบาย: แสดงตัวอย่างตราประทับอัตโนมัติ เมื่อเลือกไฟล์ และส่งไฟล์สะอาดกลับให้พาเรนต์
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { makePreviewAndClean, PrepResult } from '../utils/image';

type Props = {
  file?: File | null;
  requestId?: string;
  fullname?: string;
  onReady?: (clean: { blob: Blob; fileName: string }) => void; // ส่งกลับให้ฟอร์มใช้แทนออริจินัล
};

export default function StampedPreview({ file, requestId, fullname, onReady }: Props) {
  const [res, setRes] = useState<PrepResult | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!file) { setRes(null); return; }
      const r = await makePreviewAndClean(file, requestId, fullname);
      if (!alive) return;
      setRes(r);
      onReady?.({ blob: r.cleanedBlob, fileName: r.cleanedFileName });
    })();
    return () => { alive = false; };
  }, [file, requestId, fullname]);

  if (!file || !res) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: '#475569' }}>ตัวอย่างตราประทับ (แสดงอัตโนมัติหลังเลือกไฟล์)</div>
      <img src={res.previewUrl} alt="preview" style={{ marginTop: 6, maxWidth: '100%', borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,.15)' }} />
    </div>
  );
}
