// ======================================================================
// File: web/src/pages/internal/RequestsDashboard.tsx
// เวอร์ชัน: 27/10/2025 01:20 (Asia/Bangkok)
// หน้าที่: แดชบอร์ด "คำขอของฉัน" แสดง internal_requests เฉพาะของผู้ใช้ที่ล็อกอิน
// เชื่อม auth ผ่าน "อะแดปเตอร์": Firebase Auth (onAuthStateChanged), Firestore (onSnapshot)
// เปลี่ยนแปลงรอบนี้:
// • [เพิ่ม] ข้อความอธิบายกรณีต้องสร้าง Composite Index เมื่อ query orderBy('createdAt')
// • [เพิ่ม] แสดงวันที่ "สร้างเมื่อ" (createdAt) ใต้ชื่อร้านค้า
// • [เพิ่ม] ปุ่ม "คัดลอก RID" (แสดงเมื่อมี RID)
// อ้างอิง: Realtime listeners & index docs ของ Firestore
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore';

// -----------------------------
// สถานะงาน (ต้องตรงตามสเป็ก)
// -----------------------------
type InternalStatus =
  | 'รอดำเนินการ'
  | 'LP รับทราบ (รอผู้รับเหมา)'
  | 'รอ LP ตรวจสอบ'
  | 'อนุมัติเข้าทำงาน'
  | 'ไม่อนุมัติ';

// -----------------------------
// ประเภทข้อมูลเอกสาร
// -----------------------------
interface InternalRequestDoc {
  id?: string;
  requesterEmail: string;
  locationId: string; // ref id ของ locations
  shopName: string; // denormalized
  floor: string; // denormalized
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

// -----------------------------
// Utils
// -----------------------------
const auth = getAuth();
const db = getFirestore();

const APP_ID =
  (import.meta as any).env?.VITE_APP_ID ||
  (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ||
  'demo-app';

// แสดงป้ายสถานะ (ภาษาไทย + สี)
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

// แปลงเวลา: รองรับ Timestamp หรือ ISO string
function formatDateTime(input?: string | Timestamp) {
  if (!input) return '-';
  try {
    let d: Date;
    if (typeof input === 'string') {
      d = new Date(input);
    } else if (input instanceof Timestamp) {
      d = input.toDate();
    } else {
      return '-';
    }
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = d.getHours().toString().padStart(2, '0');
    const mi = d.getMinutes().toString().padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return '-';
  }
}

// -----------------------------
// คอมโพเนนต์หลัก
// -----------------------------
const RequestsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  const [items, setItems] = useState<InternalRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // ค้นหา/กรอง
  const [qtext, setQtext] = useState('');
  const [statusFilter, setStatusFilter] = useState<InternalStatus | 'ทั้งหมด'>('ทั้งหมด');

  // ตรวจการล็อกอิน ถ้าไม่ล็อกอิน → redirect ไป /internal/login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        navigate('/internal/login', { replace: true });
        return;
      }
      setUser(u);
    });
    return () => unsub();
  }, [navigate]);

  // โหลดรายการของผู้ใช้คนนี้
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const colPath = `artifacts/${APP_ID}/users/${user.uid}/internal_requests`;
    const colRef = collection(db, colPath);

    // เรียงล่าสุดก่อน
    const qy = query(colRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: InternalRequestDoc[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<InternalRequestDoc, 'id'>;
          rows.push({ id: d.id, ...data });
        });
        setItems(rows);
        setLoading(false);
      },
      (e: any) => {
        console.error('[RequestsDashboard] onSnapshot error:', e);
        // ถ้าต้องการดัชนี Firestore จะส่ง error พร้อมลิงก์สร้าง index ในคอนโซล
        const needIndex =
          e?.code === 'failed-precondition' ||
          /index/i.test(e?.message || '');
        if (needIndex) {
          setErr('ต้องสร้างดัชนี (Composite Index) สำหรับการเรียงข้อมูลตาม createdAt — โปรดคลิกลิงก์สร้างดัชนีที่แสดงในคอนโซล แล้วลองใหม่');
        } else {
          setErr('ไม่สามารถโหลดรายการคำขอได้');
        }
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // กรองรายการในหน้า
  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    return items.filter((it) => {
      const okStatus = statusFilter === 'ทั้งหมด' ? true : it.status === statusFilter;
      if (!okStatus) return false;

      if (!s) return true;
      const hay =
        [
          it.shopName,
          it.floor,
          it.workDetails,
          it.contractorName,
          it.contractorContactPhone,
          it.linkedPermitRID || '',
          it.requesterEmail,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
      return hay.includes(s);
    });
  }, [items, qtext, statusFilter]);

  // สไตล์พื้นฐาน
  const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 };
  const input: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #d1d5db', width: '100%' };
  const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' };
  const btnPrimary: React.CSSProperties = { ...btn, background: '#2563eb', color: 'white', border: 'none' };
  const btnGhost: React.CSSProperties = { ...btn, background: '#fff' };
  const title: React.CSSProperties = { fontSize: 20, fontWeight: 800, margin: 0 };
  const small: React.CSSProperties = { color: '#6b7280', fontSize: 12 };

  // คัดลอกข้อความ (RID)
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('คัดลอกแล้ว');
    } catch {
      alert('คัดลอกไม่สำเร็จ');
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={title}>คำขอของฉัน</h1>
        <div style={small}>
          แสดงเฉพาะคำขอที่คุณสร้างเอง · Path: <code>/artifacts/{APP_ID}/users/&lt;uid&gt;/internal_requests</code>
        </div>
      </div>

      {/* แถบเครื่องมือ */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <input
            placeholder="ค้นหา: ร้าน/ชั้น/รายละเอียด/ผู้รับเหมา/เบอร์/RID..."
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            style={input}
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ ...input, width: 220, background: '#fff' }}
          >
            <option value="ทั้งหมด">ทั้งหมด</option>
            <option value="รอดำเนินการ">รอดำเนินการ</option>
            <option value="LP รับทราบ (รอผู้รับเหมา)">LP รับทราบ (รอผู้รับเหมา)</option>
            <option value="รอ LP ตรวจสอบ">รอ LP ตรวจสอบ</option>
            <option value="อนุมัติเข้าทำงาน">อนุมัติเข้าทำงาน</option>
            <option value="ไม่อนุมัติ">ไม่อนุมัติ</option>
          </select>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Link to="/internal/requests/new" style={{ textDecoration: 'none' }}>
            <button style={btnPrimary}>+ สร้างคำขอใหม่</button>
          </Link>
        </div>
      </div>

      {/* ตาราง */}
      <div style={{ ...box, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>พื้นที่/ร้าน</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ช่วงเวลา</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ผู้รับเหมา</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>สถานะ</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>RID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={{ padding: 12 }} colSpan={5}>กำลังโหลด...</td></tr>
            ) : err ? (
              <tr><td style={{ padding: 12, color: '#dc2626' }} colSpan={5}>{err}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td style={{ padding: 12, color: '#6b7280' }} colSpan={5}>ไม่พบข้อมูล</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontWeight: 700 }}>{r.shopName || '-'}</div>
                    <div style={small}>ชั้น: {r.floor || '-'}</div>
                    <div style={small}>สร้างเมื่อ: {formatDateTime(r.createdAt)}</div>
                  </td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                    <div>{formatDateTime(r.workStartDateTime)} → {formatDateTime(r.workEndDateTime)}</div>
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
                    {r.linkedPermitRID ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{r.linkedPermitRID}</span>
                        <button style={btnGhost} onClick={() => copy(r.linkedPermitRID!)}>คัดลอก</button>
                      </div>
                    ) : (
                      <span style={{ color: '#6b7280' }}>-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RequestsDashboard;