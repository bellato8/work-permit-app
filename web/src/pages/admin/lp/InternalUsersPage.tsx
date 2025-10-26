// ======================================================================
// File: web/src/pages/admin/lp/InternalUsersPage.tsx
// เวอร์ชัน: 27/10/2025 00:55 (Asia/Bangkok)
// หน้าที่: จัดการผู้ใช้ภายใน (users_internal) — แสดง/ค้นหา/เพิ่ม/แก้ไข/ลบ
// เชื่อมบริการ: Firestore (collection, onSnapshot, add/update/delete)
// หมายเหตุ:
//   • คอลเลกชันตามสัญญา: users_internal (Fields: userId?, email, fullName, department, createdAt, updatedAt)
//   • ใช้ onSnapshot แบบเรียลไทม์ + orderBy เพื่อเรียงตามชื่อ/อีเมล
//   • ตรวจรูปแบบอีเมล และค่าว่างก่อนบันทึก
// อ้างอิง: Firebase Web v9 (modular) addDoc/updateDoc/deleteDoc/onSnapshot/collection/orderBy
//          เอกสารอธิบาย API อย่างเป็นทางการของ Firestore/Functions
//          - Firestore API: addDoc/updateDoc/deleteDoc/onSnapshot/orderBy/collection :contentReference[oaicite:1]{index=1}
//          - แนวคิดการฟังข้อมูลเรียลไทม์ onSnapshot :contentReference[oaicite:2]{index=2}
// ผู้แก้ไข: เพื่อนคู่คิด
// อัปเดตล่าสุด: 27/10/2025 00:55
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

type InternalUser = {
  id: string;             // doc id
  userId?: string;        // (ออปชัน) UID ของ Auth ไว้ผูกภายหลัง
  email: string;
  fullName: string;
  department: string;
  createdAt?: any;
  updatedAt?: any;
};

const db = getFirestore();

const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 };
const inputCss: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #d1d5db', width: '100%' };
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' };
const btnPrimary: React.CSSProperties = { ...btn, background: '#2563eb', color: 'white', border: 'none' };
const btnWarn: React.CSSProperties  = { ...btn, background: '#ef4444', color: 'white', border: 'none' };
const btnDark: React.CSSProperties  = { ...btn, background: '#374151', color: 'white', border: 'none' };
const title: React.CSSProperties    = { fontSize: 20, fontWeight: 800, margin: 0 };
const small: React.CSSProperties    = { color: '#6b7280', fontSize: 12 };

type FormState = {
  id?: string;
  userId?: string;
  email: string;
  fullName: string;
  department: string;
};

const emptyForm: FormState = { email: '', fullName: '', department: '' };

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

const InternalUsersPage: React.FC = () => {
  const [rows, setRows] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [qtext, setQtext] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);

    // คอลเลกชันตามสัญญา: users_internal
    // เรียงตาม fullName asc (สำรอง: ถ้าไม่มีให้เรียงตาม email)
    const qy = query(collection(db, 'users_internal'), orderBy('fullName', 'asc'));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const list: InternalUser[] = [];
        snap.forEach(d => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            userId: data.userId,
            email: data.email || '',
            fullName: data.fullName || '',
            department: data.department || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setRows(list);
        setLoading(false);
      },
      (e) => {
        console.error('[InternalUsersPage] onSnapshot error:', e);
        setErr('ไม่สามารถโหลดข้อมูลผู้ใช้ภายในได้');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = qtext.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      [r.email, r.fullName, r.department].join(' ').toLowerCase().includes(s)
    );
  }, [rows, qtext]);

  const openAdd = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row: InternalUser) => {
    setForm({
      id: row.id,
      userId: row.userId,
      email: row.email,
      fullName: row.fullName,
      department: row.department,
    });
    setShowForm(true);
  };

  const validate = (f: FormState) => {
    const problems: string[] = [];
    if (!f.email.trim()) problems.push('กรุณากรอกอีเมล');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) problems.push('รูปแบบอีเมลไม่ถูกต้อง');
    if (!f.fullName.trim()) problems.push('กรุณากรอกชื่อ–สกุล');
    if (!f.department.trim()) problems.push('กรุณากรอกแผนก');
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
        await addDoc(collection(db, 'users_internal'), {
          ...rest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, `users_internal/${id}`), {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
      setShowForm(false);
    } catch (e) {
      console.error('[InternalUsersPage] save error:', e);
      alert('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (row: InternalUser) => {
    const ok = confirm(`ยืนยันลบผู้ใช้ภายใน "${row.fullName}" ?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, `users_internal/${row.id}`));
    } catch (e) {
      console.error('[InternalUsersPage] delete error:', e);
      alert('ลบไม่สำเร็จ');
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={title}>ผู้ใช้ภายใน (Internal Users)</h1>
        <div style={small}>คอลเลกชัน: <code>users_internal</code></div>
      </div>

      {/* แถบเครื่องมือ */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px' }}>
          <input
            placeholder="ค้นหา: อีเมล/ชื่อ–สกุล/แผนก..."
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            style={inputCss}
          />
        </div>
        <button style={btnPrimary} onClick={openAdd}>+ เพิ่มผู้ใช้</button>
      </div>

      {/* ตาราง */}
      <div style={{ ...box, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>อีเมล</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>ชื่อ–สกุล</th>
              <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #e5e7eb' }}>แผนก</th>
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
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>{r.email}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{r.fullName}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{r.department}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={btnDark} onClick={() => openEdit(r)}>แก้ไข</button>
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
      <Modal open={showForm} onClose={() => setShowForm(false)} title={form.id ? 'แก้ไขผู้ใช้ภายใน' : 'เพิ่มผู้ใช้ภายใน'}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 700 }}>อีเมล<span style={{ color: '#ef4444' }}>*</span></div>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={inputCss}
              placeholder="name@example.com"
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 700 }}>ชื่อ–สกุล<span style={{ color: '#ef4444' }}>*</span></div>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              style={inputCss}
              placeholder="เช่น สมชาย ใจดี"
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 700 }}>แผนก<span style={{ color: '#ef4444' }}>*</span></div>
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              style={inputCss}
              placeholder="เช่น วิศวกรรมซ่อมบำรุง"
            />
          </div>
          {/* ช่องนี้ไว้ผูก UID Auth ภายหลัง ถ้ามี */}
          <div>
            <div style={{ marginBottom: 6, fontWeight: 700 }}>User ID (Auth UID) <span style={{ color: '#6b7280', fontWeight: 400 }}>(ออปชัน)</span></div>
            <input
              value={form.userId || ''}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              style={inputCss}
              placeholder="ใส่ UID เพื่อผูกกับบัญชี Auth (ถ้ามี)"
            />
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

export default InternalUsersPage;
