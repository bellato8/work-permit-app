// ======================================================================
// File: web/src/pages/admin/lp/LocationsPage.tsx
// เวอร์ชัน: 27/10/2025 00:40 (Asia/Bangkok)
// หน้าที่: จัดการ Master Data "Locations" (เพิ่ม/แก้ไข/ลบ/สลับ Active)
// เชื่อมบริการ: Firestore (collection, onSnapshot, add/update/delete)
// หมายเหตุ:
//   • Path ตามสัญญา: artifacts/{appId}/public/data/locations
//   • appId จะอ่านจาก VITE_APP_ID ถ้าไม่มีใช้งาน VITE_FIREBASE_PROJECT_ID แทน
//   • ฟิลด์: locationName, floor, status ('Active' | 'Inactive'), createdAt, updatedAt
//   • UI ภาษาไทย ใช้ฟอนต์ Sarabun เพื่อความคมชัด
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 27/10/2025 00:40
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

type LocationStatus = 'Active' | 'Inactive';

interface LocationDoc {
  id: string;
  locationName: string;
  floor: string;
  status: LocationStatus;
  createdAt?: any;
  updatedAt?: any;
}

const db = getFirestore();

// เลือก appId จาก ENV (ถ้าไม่มี VITE_APP_ID ให้ใช้ VITE_FIREBASE_PROJECT_ID)
const appId =
  (import.meta as any).env?.VITE_APP_ID ||
  (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ||
  'work-permit-app';

// path หลักของคอลเลกชัน
const collPath = `artifacts/${appId}/public/data/locations`;

const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 };
const inputCss: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #d1d5db', width: '100%' };
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { ...btn, background: '#2563eb', color: 'white', border: 'none' };
const btnWarn: React.CSSProperties  = { ...btn, background: '#ef4444', color: 'white', border: 'none' };
const btnDark: React.CSSProperties  = { ...btn, background: '#374151', color: 'white', border: 'none' };
const title: React.CSSProperties    = { fontSize: 20, fontWeight: 800, margin: 0 };
const small: React.CSSProperties    = { color: '#6b7280', fontSize: 12 };

interface FormState {
  id?: string;
  locationName: string;
  floor: string;
  status: LocationStatus;
}

const emptyForm: FormState = { locationName: '', floor: '', status: 'Active' };

const Modal: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode; title?: string }> = ({ open, onClose, children, title }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
    }}>
      <div style={{ background: '#fff', borderRadius: 10, width: 'min(560px, 95vw)', padding: 16, boxShadow: '0 20px 40px rgba(0,0,0,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>{title || 'รายละเอียด'}</h3>
          <button onClick={onClose} style={{ ...btn }}>ปิด</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const LocationsPage: React.FC = () => {
  const [rows, setRows] = useState<LocationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [qtext, setQtext] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qy = query(collection(db, collPath), orderBy('locationName', 'asc'));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: LocationDoc[] = [];
        snap.forEach(d => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            locationName: data.locationName || '',
            floor: data.floor || '',
            status: (data.status || 'Inactive') as LocationStatus,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error('[LocationsPage] onSnapshot error:', e);
        setErr('ไม่สามารถโหลดข้อมูลสถานที่ได้');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      [r.locationName, r.floor, r.status].join(' ').toLowerCase().includes(s)
    );
  }, [rows, qtext]);

  const openAdd = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row: LocationDoc) => {
    setForm({
      id: row.id,
      locationName: row.locationName,
      floor: row.floor,
      status: row.status,
    });
    setShowForm(true);
  };

  const validate = (f: FormState) => {
    const problems: string[] = [];
    if (!f.locationName.trim()) problems.push('กรุณากรอกชื่อพื้นที่/ร้านค้า');
    if (!f.floor.trim()) problems.push('กรุณากรอกชั้น');
    if (!['Active','Inactive'].includes(f.status)) problems.push('สถานะไม่ถูกต้อง');
    return problems;
  };

  const save = async () => {
    if (saving) return;
    const problems = validate(form);
    if (problems.length) {
      alert(problems.join('\n'));
      return;
    }
    try {
      setSaving(true);
      const { id, ...rest } = form;
      if (!id) {
        await addDoc(collection(db, collPath), {
          ...rest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, `${collPath}/${id}`), {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
      setShowForm(false);
    } catch (e) {
      console.error('[LocationsPage] save error:', e);
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: LocationDoc) => {
    try {
      const next: LocationStatus = row.status === 'Active' ? 'Inactive' : 'Active';
      await updateDoc(doc(db, `${collPath}/${row.id}`), {
        status: next,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[LocationsPage] toggle error:', e);
      alert('เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const removeRow = async (row: LocationDoc) => {
    const ok = confirm(`ยืนยันลบ "${row.locationName}" ?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, `${collPath}/${row.id}`));
    } catch (e) {
      console.error('[LocationsPage] delete error:', e);
      alert('ลบไม่สำเร็จ');
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={title}>สถานที่ (Locations)</h1>
        <div style={small}>
          เส้นทางข้อมูล: <code>{collPath}</code>
        </div>
      </div>

      {/* แถบเครื่องมือ */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px' }}>
          <input
            placeholder="ค้นหา: ชื่อพื้นที่/ชั้น/สถานะ..."
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            style={inputCss}
          />
        </div>
        <button style={btnPrimary} onClick={openAdd}>+ เพิ่มสถานที่</button>
      </div>

      {/* ตาราง */}
      <div style={{ ...box, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ชื่อพื้นที่/ร้านค้า</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ชั้น</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>สถานะ</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 12 }}>กำลังโหลด...</td></tr>
            ) : err ? (
              <tr><td colSpan={4} style={{ padding: 12, color: '#dc2626' }}>{err}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 12, color: '#6b7280' }}>ไม่พบข้อมูล</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>{r.locationName}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{r.floor}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                      background: r.status === 'Active' ? '#dcfce7' : '#fee2e2',
                      color: r.status === 'Active' ? '#166534' : '#991b1b', fontWeight: 700, fontSize: 12
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={btnDark} onClick={() => openEdit(r)}>แก้ไข</button>
                      <button style={btn} onClick={() => toggleStatus(r)}>
                        {r.status === 'Active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                      <button style={btnWarn} onClick={() => removeRow(r)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal ฟอร์ม เพิ่ม/แก้ไข */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={form.id ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่'}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 700 }}>ชื่อพื้นที่/ร้านค้า<span style={{ color: '#ef4444' }}>*</span></div>
            <input
              value={form.locationName}
              onChange={(e) => setForm({ ...form, locationName: e.target.value })}
              style={inputCss}
              placeholder="เช่น ร้าน A / โซน B"
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 700 }}>ชั้น<span style={{ color: '#ef4444' }}>*</span></div>
            <input
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              style={inputCss}
              placeholder="เช่น ชั้น 1 / 2F / B1"
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 700 }}>สถานะ</div>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as LocationStatus })}
              style={{ ...inputCss, background: '#fff' }}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button style={btn} onClick={() => setShowForm(false)}>ยกเลิก</button>
            <button style={btnPrimary} onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LocationsPage;
