// ======================================================================
// File: web/src/pages/admin/lp/PermitApprovals.tsx
// เวอร์ชัน: 27/10/2025 03:00 (Asia/Bangkok)
// หน้าที่: หน้าอนุมัติ/ไม่อนุมัติใบอนุญาตขั้นสุดท้าย สำหรับ LP Admin
//          - แสดงเฉพาะคำขอที่มีสถานะ "รอ LP ตรวจสอบ"
//          - แสดงข้อมูลผู้รับเหมาที่กรอกมา + ข้อมูลจาก internal request
//          - ให้ LP อนุมัติหรือไม่อนุมัติ → อัปเดตสถานะขั้นสุดท้าย
// เปลี่ยนแปลงรอบนี้:
//   • สร้างใหม่ทั้งหมดจาก placeholder → ทำงานได้จริง
//   • ใช้ collectionGroup query กรอง status = 'รอ LP ตรวจสอบ'
//   • ปุ่มอนุมัติ → เปลี่ยนสถานะเป็น 'อนุมัติเข้าทำงาน'
//   • ปุ่มไม่อนุมัติ → เปลี่ยนสถานะเป็น 'ไม่อนุมัติ'
// ผู้สร้าง: เพื่อนคู่คิด
// อัปเดตล่าสุด: 27/10/2025 03:00
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  getFirestore,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  where,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

type InternalStatus =
  | 'รอดำเนินการ'
  | 'LP รับทราบ (รอผู้รับเหมา)'
  | 'รอ LP ตรวจสอบ'
  | 'อนุมัติเข้าทำงาน'
  | 'ไม่อนุมัติ';

interface PermitRow {
  id: string;
  docPath: string;
  requesterEmail: string;
  locationName: string;
  shopName: string;
  floor: string;
  workDetails: string;
  workStartAt: string | Timestamp;
  workEndAt: string | Timestamp;
  linkedPermitRID: string;

  // ข้อมูลจากผู้รับเหมา (mock)
  contractorCompanyName?: string;
  contractorContactPerson?: string;
  contractorPhone?: string;
  contractorSubmittedAt?: Timestamp;

  status: InternalStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const db = getFirestore();

const small: React.CSSProperties = { color: '#6b7280', fontSize: 12 };

function StatusBadge({ status }: { status: InternalStatus }) {
  const style: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  };
  let bg = '#fef3c7';
  let color = '#92400e';
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
const inputCss: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #d1d5db', width: '100%' };
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' };
const btnSuccess: React.CSSProperties = { ...btn, background: '#16a34a', color: 'white', border: 'none' };
const btnDanger: React.CSSProperties = { ...btn, background: '#dc2626', color: 'white', border: 'none' };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 800, margin: 0 };

const PermitApprovalsPage: React.FC = () => {
  const [rows, setRows] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [qtext, setQtext] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // โหลดเฉพาะคำขอที่สถานะ "รอ LP ตรวจสอบ"
  useEffect(() => {
    setLoading(true);
    const cg = collectionGroup(db, 'internal_requests');
    const qy = query(
      cg,
      where('status', '==', 'รอ LP ตรวจสอบ'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: PermitRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            docPath: d.ref.path,
            requesterEmail: data.requesterEmail || '',
            locationName: data.locationName || '',
            shopName: data.shopName || '',
            floor: data.floor || '',
            workDetails: data.workDetails || '',
            workStartAt: data.workStartAt,
            workEndAt: data.workEndAt,
            linkedPermitRID: data.linkedPermitRID || '',
            contractorCompanyName: data.contractorCompanyName,
            contractorContactPerson: data.contractorContactPerson,
            contractorPhone: data.contractorPhone,
            contractorSubmittedAt: data.contractorSubmittedAt,
            status: data.status || 'รอ LP ตรวจสอบ',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error('[PermitApprovals] onSnapshot error:', e);
        setErr('ไม่สามารถโหลดรายการใบอนุญาตได้');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    return rows.filter((r) => {
      if (!s) return true;
      const hay = [
        r.requesterEmail,
        r.locationName,
        r.shopName,
        r.floor,
        r.workDetails,
        r.linkedPermitRID,
        r.contractorCompanyName || '',
        r.contractorContactPerson || '',
        r.contractorPhone || '',
      ].join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [rows, qtext]);

  const onApprove = async (row: PermitRow) => {
    if (updatingId) return;
    const ok = confirm(`ยืนยันการอนุมัติใบอนุญาต RID: ${row.linkedPermitRID}?`);
    if (!ok) return;

    setUpdatingId(row.id);
    try {
      await updateDoc(doc(db, row.docPath), {
        status: 'อนุมัติเข้าทำงาน',
        updatedAt: serverTimestamp(),
      });
      alert('✅ อนุมัติเรียบร้อย!');
    } catch (e: any) {
      console.error('[PermitApprovals] approve error:', e);
      alert('❌ อนุมัติไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUpdatingId(null);
    }
  };

  const onReject = async (row: PermitRow) => {
    if (updatingId) return;
    const ok = confirm(`ยืนยันการไม่อนุมัติใบอนุญาต RID: ${row.linkedPermitRID}?`);
    if (!ok) return;

    setUpdatingId(row.id);
    try {
      await updateDoc(doc(db, row.docPath), {
        status: 'ไม่อนุมัติ',
        updatedAt: serverTimestamp(),
      });
      alert('ไม่อนุมัติเรียบร้อย');
    } catch (e: any) {
      console.error('[PermitApprovals] reject error:', e);
      alert('❌ ปฏิเสธไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={title}>อนุมัติใบอนุญาต (Permit Approvals)</h1>
        <div style={small}>
          ตรวจสอบข้อมูลผู้รับเหมาและอนุมัติ/ไม่อนุมัติคำขอที่รอการตรวจสอบ
        </div>
      </div>

      {/* แถบค้นหา */}
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="ค้นหา: RID / ผู้ขอ / สถานที่ / ผู้รับเหมา..."
          value={qtext}
          onChange={(e) => setQtext(e.target.value)}
          style={{ ...inputCss, maxWidth: 400 }}
        />
      </div>

      {/* ตาราง */}
      <div style={{ ...box, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>RID</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ผู้ขอ</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>สถานที่/ชั้น</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ช่วงเวลา</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ผู้รับเหมา</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>สถานะ</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={{ padding: 12 }} colSpan={7}>กำลังโหลด...</td></tr>
            ) : err ? (
              <tr><td style={{ padding: 12, color: '#dc2626' }} colSpan={7}>{err}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td style={{ padding: 12, color: '#6b7280' }} colSpan={7}>
                {qtext ? 'ไม่พบข้อมูลที่ค้นหา' : 'ไม่มีคำขอที่รอการตรวจสอบ'}
              </td></tr>
            ) : (
              filtered.map((r) => {
                const updating = updatingId === r.id;
                return (
                  <tr key={r.docPath}>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 700, color: '#2563eb' }}>{r.linkedPermitRID}</div>
                      <div style={small}>ส่งโดย: {fmt(r.createdAt)}</div>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 700 }}>{r.requesterEmail}</div>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 700 }}>{r.locationName}</div>
                      <div style={small}>ชั้น: {r.floor}</div>
                      {r.shopName && <div style={small}>({r.shopName})</div>}
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div>{fmt(r.workStartAt)}</div>
                      <div>→ {fmt(r.workEndAt)}</div>
                      <div style={small}>{r.workDetails}</div>
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontWeight: 700 }}>{r.contractorCompanyName || '-'}</div>
                      <div style={small}>ติดต่อ: {r.contractorContactPerson || '-'}</div>
                      <div style={small}>โทร: {r.contractorPhone || '-'}</div>
                      {r.contractorSubmittedAt && (
                        <div style={{ ...small, color: '#16a34a', marginTop: 4 }}>
                          ✓ ส่งเมื่อ: {fmt(r.contractorSubmittedAt)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          style={btnSuccess}
                          disabled={updating}
                          onClick={() => onApprove(r)}
                          title="อนุมัติเข้าทำงาน"
                        >
                          {updating ? 'กำลังอัปเดต...' : 'อนุมัติ'}
                        </button>
                        <button
                          style={btnDanger}
                          disabled={updating}
                          onClick={() => onReject(r)}
                          title="ไม่อนุมัติ"
                        >
                          ไม่อนุมัติ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* สรุปจำนวน */}
      {!loading && !err && (
        <div style={{ marginTop: 12, ...small }}>
          แสดง {filtered.length} จาก {rows.length} รายการ
          {qtext && ` (กรองด้วย: "${qtext}")`}
        </div>
      )}
    </div>
  );
};

export default PermitApprovalsPage;
