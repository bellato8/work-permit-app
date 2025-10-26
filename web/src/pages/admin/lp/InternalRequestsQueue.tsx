// ======================================================================
// File: web/src/pages/admin/lp/InternalRequestsQueue.tsx
// เวอร์ชัน: 27/10/2025 00:25 (Asia/Bangkok)
// หน้าที่: คิวคำขอทั้งหมด (Internal Requests) สำหรับ LP Admin — แสดง/ค้นหา/กรอง/อนุมัติเบื้องต้น/ปฏิเสธ
// เชื่อมบริการ: Firestore (collectionGroup onSnapshot), Cloud Functions (httpsCallable)
// เปลี่ยนแปลงรอบนี้:
//   • [แก้บั๊ก] inputCss.border สตริงแตก ('1px solid '#d1d5db' → '1px solid #d1d5db')
//   • [คงเดิม] เรียก Cloud Functions ด้วย region จาก ENV: VITE_FUNCTIONS_REGION (fallback 'us-central1')
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 27/10/2025 00:25
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  getFirestore,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

type InternalStatus =
  | 'รอดำเนินการ'
  | 'LP รับทราบ (รอผู้รับเหมา)'
  | 'รอ LP ตรวจสอบ'
  | 'อนุมัติเข้าทำงาน'
  | 'ไม่อนุมัติ';

interface InternalRequestRow {
  id: string;
  docPath: string;
  requesterEmail: string;
  locationId: string;
  shopName: string;
  floor: string;
  workDetails: string;
  workStartDateTime: string | Timestamp;
  workEndDateTime: string | Timestamp;
  contractorName: string;
  contractorContactPhone: string;
  status: InternalStatus;
  linkedPermitRID?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const db = getFirestore();

// === เลือก region ของ Cloud Functions จาก ENV ===
const region = (import.meta as any).env?.VITE_FUNCTIONS_REGION || 'us-central1';
// ใช้ชื่อตัวแปร functionsClient เพื่อไม่ชนกับชื่อ import
const functionsClient = getFunctions(undefined, region);

// ใช้สำหรับ tooltip/หมายเหตุ
const small: React.CSSProperties = { color: '#6b7280', fontSize: 12 };

function StatusBadge({ status }: { status: InternalStatus }) {
  const style: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  };
  let bg = '#e5e7eb';
  let color = '#374151';
  if (status === 'รอดำเนินการ') { bg = '#fff7ed'; color = '#9a3412'; }
  if (status === 'LP รับทราบ (รอผู้รับเหมา)') { bg = '#dbeafe'; color = '#1e3a8a'; }
  if (status === 'รอ LP ตรวจสอบ') { bg = '#fef3c7'; color = '#92400e'; }
  if (status === 'อนุมัติเข้าทำงาน') { bg = '#dcfce7'; color = '#166534'; }
  if (status === 'ไม่อนุมัติ') { bg = '#fee2e2'; color = '#991b1b'; }
  return <span style={{ ...style, background: bg, color }}>{status}</span>;
}

function fmt(input?: string | Timestamp) {
  if (!input) return '-';
  try {
    let d: Date;
    if (typeof input === 'string') d = new Date(input);
    else d = input.toDate();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return '-';
  }
}

const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 };
// ✅ แก้สตริง border ให้ถูกต้อง
const inputCss: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #d1d5db', width: '100%' };
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { ...btn, background: '#2563eb', color: 'white', border: 'none' };
const btnWarn: React.CSSProperties = { ...btn, background: '#ef4444', color: 'white', border: 'none' };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 800, margin: 0 };

const InternalRequestsQueue: React.FC = () => {
  const [rows, setRows] = useState<InternalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [qtext, setQtext] = useState('');
  const [statusFilter, setStatusFilter] = useState<InternalStatus | 'ทั้งหมด'>('ทั้งหมด');
  const [callingId, setCallingId] = useState<string | null>(null); // ป้องกันกดซ้ำขณะเรียก CF

  useEffect(() => {
    setLoading(true);
    const cg = collectionGroup(db, 'internal_requests');
    // เรียงล่าสุดก่อน
    const qy = query(cg, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: InternalRequestRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            docPath: d.ref.path, // เก็บ path เต็ม
            requesterEmail: data.requesterEmail || '',
            locationId: data.locationId || '',
            shopName: data.shopName || '',
            floor: data.floor || '',
            workDetails: data.workDetails || '',
            workStartDateTime: data.workStartDateTime,
            workEndDateTime: data.workEndDateTime,
            contractorName: data.contractorName || '',
            contractorContactPhone: data.contractorContactPhone || '',
            status: data.status || 'รอดำเนินการ',
            linkedPermitRID: data.linkedPermitRID ?? null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error('[InternalRequestsQueue] onSnapshot error:', e);
        setErr('ไม่สามารถโหลดคิวคำขอได้');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    return rows.filter((r) => {
      const okStatus = statusFilter === 'ทั้งหมด' ? true : r.status === statusFilter;
      if (!okStatus) return false;
      if (!s) return true;
      const hay = [
        r.requesterEmail,
        r.shopName,
        r.floor,
        r.workDetails,
        r.contractorName,
        r.contractorContactPhone,
        r.linkedPermitRID || '',
      ].join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [rows, qtext, statusFilter]);

  const onReject = async (row: InternalRequestRow) => {
    if (!row.docPath) return;
    const ok = confirm('ยืนยันการปฏิเสธคำขอนี้?');
    if (!ok) return;
    try {
      await updateDoc(doc(db, row.docPath), {
        status: 'ไม่อนุมัติ',
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[InternalRequestsQueue] reject error:', e);
      alert('ปฏิเสธไม่สำเร็จ กรุณาลองใหม่');
    }
  };

  const onApprovePreliminary = async (row: InternalRequestRow) => {
    if (callingId) return; // กันกดซ้ำ
    setCallingId(row.id);
    try {
      // เรียก Cloud Function (v2) พร้อม region จาก ENV
      const createLink = httpsCallable(functionsClient, 'createContractorLink');
      // ส่งทั้ง requestId และ path เพื่อให้ฝั่ง CF ใช้อย่างใดอย่างหนึ่ง
      const resp: any = await createLink({
        requestId: row.id,
        internalRequestPath: row.docPath,
      });
      const rid = resp?.data?.rid || resp?.data?.RID || '-';
      const url = resp?.data?.url || resp?.data?.link || '-';
      alert(`สร้างลิงก์เรียบร้อย\nRID: ${rid}\nURL: ${url}\n\nคัดลอก URL เพื่อส่งให้ผู้รับเหมาได้เลย`);
      // หมายเหตุ: ฝั่ง CF จะเป็นผู้อัปเดตสถานะและแนบ RID ในเอกสารอยู่แล้ว
    } catch (e: any) {
      console.error('[InternalRequestsQueue] createContractorLink error:', e);
      const msg = e?.message || 'เรียก Cloud Function ไม่สำเร็จ กรุณาตรวจสอบการ deploy/region';
      alert(msg);
    } finally {
      setCallingId(null);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={title}>คิวคำขอ (Internal Requests)</h1>
        <div style={small}>แสดงคำขอทั้งหมดที่ส่งมาจากพนักงานภายใน · Functions region: <b>{region}</b></div>
      </div>

      {/* แถบเครื่องมือ */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <input
            placeholder="ค้นหา: ผู้ขอ/ร้าน/ชั้น/รายละเอียด/ผู้รับเหมา/เบอร์/RID..."
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            style={inputCss}
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ ...inputCss, width: 260, background: '#fff' }}
          >
            <option value="ทั้งหมด">ทั้งหมด</option>
            <option value="รอดำเนินการ">รอดำเนินการ</option>
            <option value="LP รับทราบ (รอผู้รับเหมา)">LP รับทราบ (รอผู้รับเหมา)</option>
            <option value="รอ LP ตรวจสอบ">รอ LP ตรวจสอบ</option>
            <option value="อนุมัติเข้าทำงาน">อนุมัติเข้าทำงาน</option>
            <option value="ไม่อนุมัติ">ไม่อนุมัติ</option>
          </select>
        </div>
      </div>

      {/* ตาราง */}
      <div style={{ ...box, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ผู้ขอ</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>พื้นที่/ชั้น</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ช่วงเวลา</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ผู้รับเหมา</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>สถานะ</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>RID</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={{ padding: 12 }} colSpan={7}>กำลังโหลด...</td></tr>
            ) : err ? (
              <tr><td style={{ padding: 12, color: '#dc2626' }} colSpan={7}>{err}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td style={{ padding: 12, color: '#6b7280' }} colSpan={7}>ไม่พบข้อมูล</td></tr>
            ) : (
              filtered.map((r) => {
                const approving = callingId === r.id;
                return (
                  <tr key={r.docPath}>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 700 }}>{r.requesterEmail || '-'}</div>
                      <div style={small}>{fmt(r.createdAt)}</div>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 700 }}>{r.shopName || '-'}</div>
                      <div style={small}>ชั้น: {r.floor || '-'}</div>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div>{fmt(r.workStartDateTime)} → {fmt(r.workEndDateTime)}</div>
                      <div style={small}>{r.workDetails || '-'}</div>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div>{r.contractorName || '-'}</div>
                      <div style={small}>{r.contractorContactPhone || '-'}</div>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      {r.linkedPermitRID || <span style={{ color: '#6b7280' }}>-</span>}
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          style={btnPrimary}
                          disabled={approving || r.status !== 'รอดำเนินการ'}
                          onClick={() => onApprovePreliminary(r)}
                          title="อนุมัติเบื้องต้น (สร้างลิงก์ผู้รับเหมา)"
                        >
                          {approving ? 'กำลังสร้างลิงก์...' : 'อนุมัติเบื้องต้น'}
                        </button>
                        <button
                          style={btnWarn}
                          disabled={r.status === 'อนุมัติเข้าทำงาน' || r.status === 'ไม่อนุมัติ'}
                          onClick={() => onReject(r)}
                          title="ปฏิเสธ"
                        >
                          ปฏิเสธ
                        </button>
                        {/* อนาคต: ปุ่ม “ดูรายละเอียด” เปิดโมดอลได้หากต้องการ */}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InternalRequestsQueue;
