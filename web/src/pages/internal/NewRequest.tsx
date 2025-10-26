// ======================================================================
// File: web/src/pages/internal/NewRequest.tsx
// เวอร์ชัน: 26/10/2025 21:05 (Asia/Bangkok)
// หน้าที่: แบบฟอร์มสร้างคำขอใหม่ของพนักงานภายใน → เขียนเอกสารไปที่ internal_requests ของผู้ใช้คนนั้น
// เชื่อม auth ผ่าน "อะแดปเตอร์": Firebase Auth/Firestore (ต้อง init แอปไว้แล้ว)
// หมายเหตุ: เลือกพื้นที่จาก Master Data (Active เท่านั้น), เติมชั้นอัตโนมัติ, validate start < end,
//           เก็บเวลาเป็นสตริง ISO ตามแนวทางของโปรเจกต์, status เริ่มต้น = "รอดำเนินการ"
// วันที/เดือน/ปี เวลา: 26/10/2025 21:05
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';

// -----------------------------
// ประเภทข้อมูล
// -----------------------------
type LocationStatus = 'Active' | 'Inactive';

interface LocationDoc {
  id: string;
  locationName: string;
  floor: string;
  status: LocationStatus;
}

type InternalStatus =
  | 'รอดำเนินการ'
  | 'LP รับทราบ (รอผู้รับเหมา)'
  | 'รอ LP ตรวจสอบ'
  | 'อนุมัติเข้าทำงาน'
  | 'ไม่อนุมัติ';

// -----------------------------
// Utils/Config
// -----------------------------
const auth = getAuth();
const db = getFirestore();

const APP_ID =
  (import.meta as any).env?.VITE_APP_ID ||
  (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ||
  'demo-app';

const LOCATIONS_PATH = `artifacts/${APP_ID}/public/data/locations`;

// เก็บเวลาเป็นสตริง ISO (UTC) ตามแนวทางของโปรเจกต์
function toISO(dtLocal: string): string {
  // dtLocal มาจาก <input type="datetime-local"> เช่น "2025-10-26T13:30"
  // แปลงเป็น Date (สมมุติเวลาเป็น local timezone ของผู้ใช้) แล้ว toISOString()
  const d = new Date(dtLocal);
  return d.toISOString();
}

// -----------------------------
// คอมโพเนนต์หลัก
// -----------------------------
const NewRequest: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  // ฟอร์ม
  const [locationId, setLocationId] = useState('');
  const [shopName, setShopName] = useState('');
  const [floor, setFloor] = useState('');
  const [workDetails, setWorkDetails] = useState('');
  const [startAt, setStartAt] = useState(''); // datetime-local
  const [endAt, setEndAt] = useState('');     // datetime-local
  const [contractorName, setContractorName] = useState('');
  const [contractorContactPhone, setContractorContactPhone] = useState('');

  // master data
  const [locations, setLocations] = useState<LocationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // ตรวจล็อกอิน
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        navigate('/internal/login', { replace: true });
        return;
      }
      setUser(u);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // โหลด locations (เฉพาะ Active)
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const colRef = collection(db, LOCATIONS_PATH);
        const qy = query(colRef, where('status', '==', 'Active'), orderBy('locationName'));
        const snap = await getDocs(qy);
        const list: LocationDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            locationName: data.locationName,
            floor: data.floor,
            status: data.status,
          };
        });
        if (!cancel) setLocations(list);
      } catch (e) {
        console.error('[NewRequest] load locations error:', e);
        if (!cancel) setErr('ไม่สามารถโหลดรายชื่อสถานที่ได้');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // เมื่อเลือก location → เติม shopName/floor อัตโนมัติ
  useEffect(() => {
    const loc = locations.find((x) => x.id === locationId);
    if (loc) {
      setShopName(loc.locationName || '');
      setFloor(loc.floor || '');
    } else {
      setShopName('');
      setFloor('');
    }
  }, [locationId, locations]);

  // ตรวจความถูกต้อง
  const validate = (): string | null => {
    if (!locationId) return 'กรุณาเลือกพื้นที่/ร้านค้า';
    if (!workDetails.trim()) return 'กรุณาระบุวัตถุประสงค์/รายละเอียดงาน';
    if (!startAt) return 'กรุณาระบุเวลาเริ่มต้น';
    if (!endAt) return 'กรุณาระบุเวลาสิ้นสุด';
    const startISO = toISO(startAt);
    const endISO = toISO(endAt);
    if (new Date(startISO) >= new Date(endISO)) return 'เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด';
    if (!contractorName.trim()) return 'กรุณาระบุชื่อบริษัทผู้รับเหมา';
    if (!contractorContactPhone.trim()) return 'กรุณาระบุเบอร์ติดต่อผู้ประสานงานผู้รับเหมา';
    return null;
  };

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    if (saving || !user) return;

    setErr('');
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    try {
      setSaving(true);
      const startISO = toISO(startAt);
      const endISO = toISO(endAt);

      const colPath = `artifacts/${APP_ID}/users/${user.uid}/internal_requests`;
      await addDoc(collection(db, colPath), {
        requesterEmail: user.email || '',
        locationId,
        shopName, // denormalized
        floor,    // denormalized
        workDetails: workDetails.trim(),
        workStartDateTime: startISO, // เก็บเป็น ISO string
        workEndDateTime: endISO,     // เก็บเป็น ISO string
        contractorName: contractorName.trim(),
        contractorContactPhone: contractorContactPhone.trim(),
        status: 'รอดำเนินการ' as InternalStatus,
        linkedPermitRID: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      navigate('/internal/requests', { replace: true });
    } catch (e) {
      console.error('[NewRequest] submit error:', e);
      setErr('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  // สไตล์พื้นฐาน
  const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 };
  const input: React.CSSProperties = { padding: 10, borderRadius: 6, border: '1px solid #d1d5db', width: '100%' };
  const label: React.CSSProperties = { fontSize: 12, marginBottom: 6 };
  const title: React.CSSProperties = { fontSize: 20, fontWeight: 800, margin: 0 };
  const btn: React.CSSProperties = { padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer' };
  const btnPrimary: React.CSSProperties = { ...btn, background: '#2563eb', color: 'white', border: 'none' };
  const small: React.CSSProperties = { color: '#6b7280', fontSize: 12 };

  const locationOptions = useMemo(() => {
    return locations.map((l) => ({ value: l.id, label: `${l.locationName} (ชั้น ${l.floor})` }));
  }, [locations]);

  return (
    <div style={{ padding: 16, fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div>
          <h1 style={title}>สร้างคำขอใหม่</h1>
          <div style={small}>
            เลือกพื้นที่จาก Master Data (Active) → เติมชั้นอัตโนมัติ · บันทึกแล้วสถานะจะเป็น <b>“รอดำเนินการ”</b>
          </div>
        </div>
        <div>
          <Link to="/internal/requests" style={{ textDecoration: 'none' }}>
            <button style={btn}>กลับไป “คำขอของฉัน”</button>
          </Link>
        </div>
      </div>

      {/* แจ้งเตือน/ข้อผิดพลาด */}
      {err && (
        <div style={{ ...box, background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b', marginBottom: 12 }}>
          {err}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ ...box, marginBottom: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={label}>พื้นที่/ร้านค้า *</div>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{ ...input, background: '#fff' }}
              disabled={loading || locations.length === 0}
              required
            >
              <option value="">{loading ? 'กำลังโหลด...' : '— เลือกพื้นที่ —'}</option>
              {locationOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {locations.length === 0 && !loading && (
              <div style={{ ...small, marginTop: 6, color: '#b91c1c' }}>
                ยังไม่มีข้อมูลสถานที่ (Active) — โปรดให้ LP เพิ่มในหน้า “Locations”
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={label}>ชื่อพื้นที่/ร้านค้า (อัตโนมัติ)</div>
              <input value={shopName} style={{ ...input, background: '#f9fafb' }} disabled />
            </div>
            <div>
              <div style={label}>ชั้น (อัตโนมัติ)</div>
              <input value={floor} style={{ ...input, background: '#f9fafb' }} disabled />
            </div>
          </div>
        </div>

        <div style={{ ...box, marginBottom: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={label}>วัตถุประสงค์/รายละเอียดงาน *</div>
            <textarea
              value={workDetails}
              onChange={(e) => setWorkDetails(e.target.value)}
              style={{ ...input, minHeight: 100, resize: 'vertical' }}
              placeholder="อธิบายประเภทงาน สถานที่ภายใน จุดเสี่ยง หรือข้อควรระวัง"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={label}>วันที่/เวลา เริ่มต้น *</div>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                style={input}
                required
              />
            </div>
            <div>
              <div style={label}>วันที่/เวลา สิ้นสุด *</div>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                style={input}
                required
              />
            </div>
          </div>
          <div style={{ ...small, marginTop: 6 }}>
            * ระบบจะเก็บเวลาเป็นสตริง ISO (UTC) — แสดงผลในแดชบอร์ดด้วยรูปแบบท้องถิ่น
          </div>
        </div>

        <div style={{ ...box, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={label}>บริษัทผู้รับเหมา *</div>
              <input
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                style={input}
                required
              />
            </div>
            <div>
              <div style={label}>เบอร์ติดต่อผู้ประสานงานผู้รับเหมา *</div>
              <input
                value={contractorContactPhone}
                onChange={(e) => setContractorContactPhone(e.target.value)}
                style={input}
                placeholder="เช่น 08x-xxx-xxxx"
                required
              />
            </div>
          </div>
        </div>

        <div style={{ ...box, marginBottom: 12 }}>
          <div style={label}>ไฟล์แนบ (ถ้ามี)</div>
          <input type="file" disabled style={{ ...input, background: '#f3f4f6' }} />
          <div style={{ ...small, marginTop: 6 }}>
            **ยังไม่เปิดอัปโหลดในขั้นนี้** — จะเปิดใช้งานเมื่อกำหนด <code>storage.rules</code> และโค้ดอัปโหลดในรอบถัดไป
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Link to="/internal/requests" style={{ textDecoration: 'none' }}>
            <button type="button" style={btn}>ยกเลิก</button>
          </Link>
          <button type="submit" style={btnPrimary} disabled={saving || loading}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกคำขอ'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewRequest;
