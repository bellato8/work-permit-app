// ======================================================================
// File: web/src/pages/internal/NewRequest.tsx
// เวอร์ชัน: 26/10/2025 22:30 (Asia/Bangkok)
// หน้าที่: ฟอร์มส่งคำขอใหม่ของพนักงานภายใน — เลือกสถานที่ → ระบบโชว์ “ชั้น” ให้เลือกอัตโนมัติ → กรอกข้อมูลสั้น ๆ → บันทึกคำขอ
// เชื่อม Firestore ตาม “สัญญา”: artifacts/{appId}/users/{userId}/internal_requests
// หมายเหตุ:
// - อ่านรายชื่อสถานที่จากตำแหน่งหลัก: artifacts/{appId}/public/data/locations
//   และมีโหมดสำรอง: collections/locations (เพื่อรองรับข้อมูลเก่าที่เพื่อนทดสอบไว้ก่อนหน้า)
// - สถานะเริ่มต้นของคำขอ: "รอดำเนินการ"
// ======================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, auth, app } from '../../lib/firebase';
import { getAuth } from 'firebase/auth';

// ---------- ประเภทข้อมูลแบบเรียบง่าย ----------
type FloorOption = { id: string; name: string; isActive?: boolean };

type LocationRow = {
  id: string;
  locationName?: string;    // กรณีสัญญาหลัก
  floor?: any;              // อาจเป็นสตริง "G,1,2" หรืออาเรย์
  status?: string;          // "Active"/"Inactive"
  // กรณีเดิมที่ทำไว้ก่อน (ตำแหน่งสำรอง)
  name?: string;            // ต้นแบบเดิมเก็บเป็น name
  floors?: FloorOption[];   // ต้นแบบเดิมเก็บเป็น floors[]
  isActive?: boolean;
};

// ---------- ค่าตั้งต้น ----------
const APP_ID = import.meta.env.VITE_APP_ID || 'default'; // ระบุ appId ใน .env (Vite) ถ้าไม่ตั้ง ใช้ 'default'
const COLLECTION_LOCATIONS_PRIMARY = `artifacts/${APP_ID}/public/data/locations`;
const COLLECTION_INTERNAL_REQUESTS_BASE = `artifacts/${APP_ID}/users`;

// ใช้สำหรับอ่านข้อมูลเก่าที่อยู่ตำแหน่งสำรอง (รอบก่อนทำไว้เพื่อให้ทดสอบไว)
const COLLECTION_LOCATIONS_FALLBACK = `locations`;

// แปลง floors (ที่อาจมาได้หลายรูปแบบ) → อาเรย์ FloorOption แบบเดียวกัน
function normalizeFloors(row: LocationRow): FloorOption[] {
  // เคสใหม่ตามสัญญา: อาจเก็บ floor เป็น string "G,1,2" หรือ array ของ string
  if (row.floor && Array.isArray(row.floor)) {
    // array ของ string
    return (row.floor as any[])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0)
      .map((name) => ({ id: name, name, isActive: true }));
  }
  if (row.floor && typeof row.floor === 'string') {
    return String(row.floor)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((name) => ({ id: name, name, isActive: true }));
  }

  // เคสสำรอง: โครงที่ทำไว้ก่อนหน้า (มี floors: FloorOption[])
  if (Array.isArray(row.floors)) {
    return row.floors.map((f) => ({
      id: f.id || f.name,
      name: f.name,
      isActive: f.isActive ?? true,
    }));
  }

  return [];
}

function extractLocationName(row: LocationRow): string {
  // ชื่อสถานที่จากสัญญาใหม่ หรือชื่อเดิมที่เคยใช้
  return row.locationName || row.name || '(ไม่มีชื่อ)';
}

function isRowActive(row: LocationRow): boolean {
  // มาตรฐานใหม่ใช้ status = "Active"/"Inactive"; ของเดิมใช้ isActive: boolean
  if (typeof row.isActive === 'boolean') return row.isActive;
  if (typeof row.status === 'string') return row.status.toLowerCase() === 'active';
  return true;
}

// ---------- คอมโพเนนต์หลัก ----------
export default function NewRequest() {
  const navigate = useNavigate();
  const authInst = auth || getAuth(app);

  // สถานที่ + ชั้น (โหลดจากฐานข้อมูล)
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loadingLocs, setLoadingLocs] = useState(true);

  // ค่าที่ผู้ใช้เลือก/กรอก
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [workDetails, setWorkDetails] = useState('');
  const [workStartAt, setWorkStartAt] = useState('');
  const [workEndAt, setWorkEndAt] = useState('');
  const [contractorCompany, setContractorCompany] = useState('');
  const [contractorContactName, setContractorContactName] = useState('');
  const [contractorContactPhone, setContractorContactPhone] = useState('');
  const [shopName, setShopName] = useState(''); // เผื่อบางเคสต้องระบุชื่อร้าน/พื้นที่ย่อย

  // แจ้งเตือน/สถานะการบันทึก
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // โหลดสถานที่จากตำแหน่งหลัก ตามสัญญา; ถ้าไม่พบ จะลองตำแหน่งสำรอง
  useEffect(() => {
    let unsubPrimary: any;
    let triedFallback = false;

    const loadPrimary = () => {
      const q = query(collection(db, COLLECTION_LOCATIONS_PRIMARY), orderBy('locationName'));
      unsubPrimary = onSnapshot(
        q,
        (snap) => {
          const arr: LocationRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          if (arr.length > 0) {
            setLocations(arr.filter(isRowActive));
            setLoadingLocs(false);
          } else {
            // ถ้าไม่มีข้อมูลเลย ลองตำแหน่งสำรอง
            if (!triedFallback) {
              triedFallback = true;
              loadFallback();
            } else {
              setLocations([]);
              setLoadingLocs(false);
            }
          }
        },
        (err) => {
          // ถ้าพัง ให้ลองตำแหน่งสำรองต่อ
          if (!triedFallback) {
            triedFallback = true;
            loadFallback();
          } else {
            setErrMsg(err?.message || 'โหลดสถานที่ไม่สำเร็จ');
            setLoadingLocs(false);
          }
        }
      );
    };

    const loadFallback = () => {
      const q2 = query(collection(db, COLLECTION_LOCATIONS_FALLBACK), orderBy('name'));
      const unsub = onSnapshot(
        q2,
        (snap) => {
          const arr: LocationRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          setLocations(arr.filter(isRowActive));
          setLoadingLocs(false);
        },
        (err) => {
          setErrMsg(err?.message || 'โหลดสถานที่ (สำรอง) ไม่สำเร็จ');
          setLoadingLocs(false);
        }
      );
    };

    loadPrimary();
    return () => {
      if (typeof unsubPrimary === 'function') unsubPrimary();
    };
  }, []);

  // ชั้นที่ใช้เลือก จะขึ้นกับสถานที่ที่เลือก
  const floorOptions = useMemo<FloorOption[]>(() => {
    const row = locations.find((x) => x.id === selectedLocationId);
    if (!row) return [];
    return normalizeFloors(row).filter((f) => f.isActive !== false);
  }, [locations, selectedLocationId]);

  // ฟังก์ชันช่วย
  function validate(): string | null {
    if (!selectedLocationId) return 'กรุณาเลือกสถานที่';
    if (!selectedFloor) return 'กรุณาเลือกชั้น';
    if (!workStartAt || !workEndAt) return 'กรุณากรอกเวลาเริ่มและสิ้นสุด';
    const start = new Date(workStartAt).getTime();
    const end = new Date(workEndAt).getTime();
    if (isFinite(start) && isFinite(end) && start >= end) {
      return 'เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด';
    }
    if (!workDetails.trim()) return 'กรุณากรอกรายละเอียดงานโดยย่อ';
    return null;
  }

  async function handleSubmit() {
    setErrMsg(null);
    const err = validate();
    if (err) {
      setErrMsg(err);
      return;
    }

    const user = authInst.currentUser;
    if (!user) {
      setErrMsg('ยังไม่ได้เข้าสู่ระบบ');
      return;
    }

    // เตรียมข้อมูลที่จะบันทึก
    const row = locations.find((x) => x.id === selectedLocationId);
    const locationName = row ? extractLocationName(row) : '';

    const payload = {
      requesterEmail: user.email || '',
      locationId: selectedLocationId,
      locationName, // เก็บซ้ำเพื่อค้นหาง่าย
      shopName: shopName.trim() || null,
      floor: selectedFloor,
      workDetails: workDetails.trim(),
      workStartAt: new Date(workStartAt).toISOString(),
      workEndAt: new Date(workEndAt).toISOString(),
      contractorCompany: contractorCompany.trim() || null,
      contractorContactName: contractorContactName.trim() || null,
      contractorContactPhone: contractorContactPhone.trim() || null,
      status: 'รอดำเนินการ',
      linkedPermitRID: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      setSubmitting(true);
      // เขียนลง artifacts/{appId}/users/{uid}/internal_requests
      const col = collection(db, `${COLLECTION_INTERNAL_REQUESTS_BASE}/${user.uid}/internal_requests`);
      await addDoc(col, payload);
      // ไปหน้า Dashboard
      navigate('/internal/requests');
    } catch (e: any) {
      setErrMsg(e?.message || 'บันทึกคำขอไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- หน้าจอ ----------
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>ส่งคำขอใหม่</h1>
      <p style={{ marginTop: 0 }}>
        เลือก “สถานที่” ก่อน แล้วระบบจะแสดง “ชั้น” ของสถานที่นั้นให้เลือกอัตโนมัติ
      </p>

      {/* เลือกสถานที่ + ชั้น */}
      <div
        style={{
          border: '1px solid #e5e5e5',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
          background: '#fafafa',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>สถานที่</span>
            <select
              value={selectedLocationId}
              onChange={(e) => {
                setSelectedLocationId(e.target.value);
                setSelectedFloor('');
              }}
              disabled={loadingLocs}
            >
              <option value="" disabled>
                {loadingLocs ? 'กำลังโหลด…' : '— เลือกสถานที่ —'}
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {extractLocationName(loc)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>ชั้น</span>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              disabled={!selectedLocationId || floorOptions.length === 0}
            >
              <option value="" disabled>
                {selectedLocationId
                  ? floorOptions.length > 0
                    ? '— เลือกชั้น —'
                    : 'ไม่มีชั้นให้เลือก (ติดต่อผู้ดูแล)'
                  : 'กรุณาเลือกสถานที่ก่อน'}
              </option>
              {floorOptions.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* รายละเอียดงาน + เวลา */}
      <div
        style={{
          border: '1px solid #e5e5e5',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>รายละเอียดงาน (สั้น ๆ)</span>
            <textarea
              value={workDetails}
              onChange={(e) => setWorkDetails(e.target.value)}
              placeholder="เช่น เปลี่ยนโคมไฟ/เดินสายไฟ/ตรวจระบบ"
              rows={3}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>วัน–เวลาเริ่ม</span>
            <input
              type="datetime-local"
              value={workStartAt}
              onChange={(e) => setWorkStartAt(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>วัน–เวลาสิ้นสุด</span>
            <input
              type="datetime-local"
              value={workEndAt}
              onChange={(e) => setWorkEndAt(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* ข้อมูลผู้รับเหมา (ถ้ามี) และชื่อร้าน/พื้นที่ย่อย */}
      <div
        style={{
          border: '1px solid #e5e5e5',
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>ชื่อร้าน/พื้นที่ย่อย (ถ้ามี)</span>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="เช่น ร้าน A หรือ พื้นที่คลัง 2"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>บริษัทผู้รับเหมา (ถ้ามี)</span>
            <input
              value={contractorCompany}
              onChange={(e) => setContractorCompany(e.target.value)}
              placeholder="ชื่อบริษัท"
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>ผู้ประสานงานผู้รับเหมา (ชื่อ)</span>
            <input
              value={contractorContactName}
              onChange={(e) => setContractorContactName(e.target.value)}
              placeholder="ชื่อ–นามสกุล"
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            <span>ผู้ประสานงานผู้รับเหมา (โทร)</span>
            <input
              value={contractorContactPhone}
              onChange={(e) => setContractorContactPhone(e.target.value)}
              placeholder="เบอร์โทร"
            />
          </label>
        </div>
      </div>

      {/* ปุ่มบันทึก + ข้อความแจ้งเตือน */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'กำลังบันทึก…' : 'ส่งคำขอ'}
        </button>
        <button onClick={() => navigate('/internal/requests')} disabled={submitting}>
          ย้อนกลับ
        </button>
        {errMsg && (
          <span style={{ color: '#a30000' }}>
            {errMsg}
          </span>
        )}
      </div>
    </div>
  );
}
