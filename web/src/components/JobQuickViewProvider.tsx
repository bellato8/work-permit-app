// ======================================================================
// File: web/src/components/JobQuickViewProvider.tsx
// เวอร์ชัน: 2025-10-23
// ปรับ A5 (deep-link Drawer):
//   • อ่าน/เขียน ?panel=job&rid=... เพื่อเปิด/ปิด Drawer ได้เหมือนเดิมหลังแชร์ลิงก์หรือรีโหลด
//   • คงพารามิเตอร์อื่น ๆ ใน URL (เช่น ?date=...) เสมอ (เพิ่ม/ลบเฉพาะ panel กับ rid)
//   • เพิ่ม openJob(jobLite): ถ้ามีแค่ rid ใช้ openByRid; ถ้ามีข้อมูลมากกว่า rid ใช้ openQuickView
//   • ลบการ export ซ้ำ ลดความเสี่ยง TS2323/TS2484
// อ้างอิงแนวคิด/เครื่องมือ:
//   • useSearchParams (React Router v6): set แล้ว “นำทาง” อัตโนมัติ (เหมือน useState แต่เป็น URL) [docs]
//   • URLSearchParams.set()/delete(): เพิ่ม/แก้/ลบพารามิเตอร์แบบปลอดภัย [MDN]
//   • createContext/useContext: ส่งข้อมูลให้ลูก ๆ โดยไม่ต้องพร็อพหลายชั้น [React docs]
// ======================================================================

import React, {
  createContext, useContext, useMemo, useState,
  useCallback, useEffect, useRef, PropsWithChildren,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import JobQuickViewDrawer, { JobSummary } from './JobQuickViewDrawer';

// ---------- ชนิดข้อมูล ----------------------------------------------------
// JobLite: อย่างน้อยต้องมี rid — ใช้กรณีปุ่ม/การ์ดที่มีข้อมูลไม่ครบ (ให้ Drawer โหลดต่อเองได้)
export type JobLite = Pick<JobSummary, 'rid'> & Partial<JobSummary>;

// ค่าที่แชร์ผ่านบริบท (context)
type Ctx = {
  open: boolean;
  job: JobSummary | null;
  // เปิดด้วยออบเจ็กต์งาน (ข้อมูลครบ)
  openQuickView: (job: JobSummary) => void;
  // เปิดด้วยรหัสงานอย่างเดียว (ใช้กับ deep-link หรือปุ่มแบบเบา ๆ)
  openByRid: (rid: string) => void;
  // ปิด Drawer และล้าง panel/rid ออกจาก URL
  closeQuickView: () => void;
  // ทางลัด: รับ JobLite (อย่างน้อยมี rid) แล้วตัดสินใจว่าจะเปิดแบบไหน
  openJob: (job: JobLite) => void;
};

type ProviderProps = PropsWithChildren<{
  // พร็อพสำหรับ Drawer เดิม — คงครบ (ไม่ตัดความสามารถ)
  onCheckIn?: (job: JobSummary) => void | Promise<any>;
  onCheckOut?: (job: JobSummary) => void | Promise<any>;
  confirmCheckIn?: boolean;
  confirmCheckOut?: boolean;
  autoCloseOnSuccess?: boolean;
  successMessageCheckIn?: string;
  successMessageCheckOut?: string;
  disableCheckIn?: boolean;
  disableCheckOut?: boolean;
  primaryAction?: 'auto' | 'checkin' | 'checkout';
  hideDisabledActions?: boolean;
}>;

const JobQuickViewContext = createContext<Ctx | undefined>(undefined);

// ฮุคใช้งานบริบท (โยน error ถ้าอยู่นอก Provider เพื่อกันพลาด)
export function useJobQuickView() {
  const ctx = useContext(JobQuickViewContext);
  if (!ctx) throw new Error('useJobQuickView ต้องใช้ภายใน <JobQuickViewProvider>');
  return ctx;
}

// ----------------- ตัว Provider หลัก --------------------------------------
export function JobQuickViewProvider({
  children,
  onCheckIn,
  onCheckOut,
  confirmCheckIn,
  confirmCheckOut,
  autoCloseOnSuccess,
  successMessageCheckIn,
  successMessageCheckOut,
  disableCheckIn,
  disableCheckOut,
  primaryAction,
  hideDisabledActions,
}: ProviderProps) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<JobSummary | null>(null);

  // อ่าน/เขียนพารามิเตอร์ใน URL (React Router v6) — set แล้ว “นำทาง” อัตโนมัติ
  const [searchParams, setSearchParams] = useSearchParams();

  // ธงกันลูประหว่างอ่านจาก URL ↔ เขียนกลับ URL
  const syncingFromUrlRef = useRef(false);

  // เขียน/ลบพารามิเตอร์ panel/rid โดยคงค่าอื่น ๆ ไว้
  const writeUrl = useCallback((rid?: string) => {
    const next = new URLSearchParams(searchParams);
    if (rid) {
      next.set('panel', 'job'); // MDN: set = แทนค่าพารามิเตอร์ หรือสร้างใหม่ถ้าไม่มี
      next.set('rid', rid);
      setSearchParams(next, { replace: false }); // เก็บประวัติ (back/forward ได้)
    } else {
      next.delete('panel');     // MDN: delete = ลบเฉพาะพารามิเตอร์ที่ระบุ
      next.delete('rid');
      setSearchParams(next, { replace: true }); // ล้างให้สะอาด (ไม่ยัดประวัติซ้ำ)
    }
  }, [searchParams, setSearchParams]);

  // เปิดด้วยออบเจ็กต์งาน (ข้อมูลครบ)
  const openQuickView = useCallback((j: JobSummary) => {
    if (!j || !j.rid) return;
    setJob(j);
    setOpen(true);
    if (!syncingFromUrlRef.current) writeUrl(j.rid);
  }, [writeUrl]);

  // เปิดด้วย rid อย่างเดียว (ใช้ deep-link/เปิดจาก URL)
  const openByRid = useCallback((rid: string) => {
    if (!rid) return;
    setJob(prev => (prev?.rid === rid ? prev : ({ rid } as JobSummary)));
    setOpen(true);
    if (!syncingFromUrlRef.current) writeUrl(rid);
  }, [writeUrl]);

  // ทางลัด: รับ JobLite แล้วเลือกวิธีเปิดให้เหมาะสม
  const openJob = useCallback((j: JobLite) => {
    if (!j || !j.rid) return;
    const onlyRid = Object.keys(j).length === 1 && 'rid' in j;
    if (onlyRid) openByRid(j.rid);
    else openQuickView(j as JobSummary);
  }, [openByRid, openQuickView]);

  // ปิด Drawer และล้างพารามิเตอร์ออกจาก URL
  const closeQuickView = useCallback(() => {
    setOpen(false);
    if (!syncingFromUrlRef.current) writeUrl(undefined);
  }, [writeUrl]);

  // เปิดจาก URL อัตโนมัติ: ถ้าเจอ ?panel=job&rid=...
  useEffect(() => {
    const panel = searchParams.get('panel');
    const rid = searchParams.get('rid') || '';

    syncingFromUrlRef.current = true;

    if (panel === 'job' && rid) {
      if (!open || job?.rid !== rid) openByRid(rid);
    } else {
      if (open) setOpen(false);
    }

    // ปล่อยธงในรอบถัดไป
    const t = setTimeout(() => { syncingFromUrlRef.current = false; }, 0);
    return () => clearTimeout(t);
    // เจตนาให้ทำงานเมื่อพารามิเตอร์เปลี่ยน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const value: Ctx = useMemo(() => ({
    open,
    job,
    openQuickView,
    openByRid,
    closeQuickView,
    openJob,
  }), [open, job, openQuickView, openByRid, closeQuickView, openJob]);

  return (
    <JobQuickViewContext.Provider value={value}>
      {children}

      {/* ส่งพร็อพที่ได้รับ “ต่อ” ลง Drawer ตรง ๆ (ความสามารถเดิมยังอยู่ครบ) */}
      <JobQuickViewDrawer
        open={open}
        job={job}
        onClose={closeQuickView}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        confirmCheckIn={confirmCheckIn}
        confirmCheckOut={confirmCheckOut}
        autoCloseOnSuccess={autoCloseOnSuccess}
        successMessageCheckIn={successMessageCheckIn}
        successMessageCheckOut={successMessageCheckOut}
        disableCheckIn={disableCheckIn}
        disableCheckOut={disableCheckOut}
        primaryAction={primaryAction}
        hideDisabledActions={hideDisabledActions}
      />
    </JobQuickViewContext.Provider>
  );
}

// ทั้ง default และ named export — “ไม่” re-export ซ้ำ เพื่อลดโอกาสชนกัน
export default JobQuickViewProvider;
