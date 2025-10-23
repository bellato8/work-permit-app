// ======================================================================
// File: web/src/components/JobOpenLink.tsx
// เวอร์ชัน: 2025-10-23
// หน้าที่: สร้างปุ่ม/ลิงก์ที่ "เปิดงานใน Drawer" และประกอบลิงก์ที่แชร์ได้ทันที
// วิธีใช้ตัวอย่าง:
//   <JobOpenLink as="a" job={{ rid: item.rid }} className="...">ดูงาน</JobOpenLink>
//   <JobOpenLink as="button" job={{ rid: item.rid }} className="w-full">เปิดการ์ดนี้</JobOpenLink>
//   <JobOpenLink as="div" job={{ rid: item.rid }} className="cursor-pointer">ทั้งบล็อกนี้คลิกได้</JobOpenLink>
// หมายเหตุ:
//   • ถ้าเป็น <a> จะมี href ที่รวมพารามิเตอร์เดิม + panel=job&rid=... (กดคลิกขวา/คัดลอกลิงก์ได้)
//   • ถ้ากด Ctrl/Cmd+คลิก หรือปุ่มกลางบน <a> จะให้เบราว์เซอร์เปิดแท็บใหม่ตามปกติ
//   • ใช้คู่กับ <JobQuickViewProvider> ที่ครอบทั้งส่วนของหน้าไว้แล้ว
// ======================================================================

import * as React from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useJobQuickView, type JobLite } from "./JobQuickViewProvider";

type Props = {
  job: JobLite;                       // อย่างน้อยต้องมี rid
  className?: string;
  children?: React.ReactNode;
  as?: "button" | "a" | "div";        // ค่าเริ่มต้นเป็น "button"
};

export default function JobOpenLink(props: Props) {
  const { job, className, children, as = "button" } = props;
  const { openJob } = useJobQuickView();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // ประกอบ href: คงพารามิเตอร์เดิม แล้วเติม panel=job & rid=<rid>
  const href = React.useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.set("panel", "job");   // MDN: set() จะเขียนทับหรือตั้งค่าใหม่ถ้ายังไม่มี
    next.set("rid", job?.rid ?? "");
    const qs = next.toString();
    return qs ? `${location.pathname}?${qs}` : location.pathname;
  }, [searchParams, location.pathname, job?.rid]);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (as === "a") {
      // ปล่อยให้เบราว์เซอร์จัดการเปิดแท็บใหม่เอง (Ctrl/Cmd+คลิก หรือ Middle click)
      if (e.metaKey || e.ctrlKey || (e as any).button === 1) return;
      e.preventDefault();
    }
    if (job?.rid) openJob(job);
  };

  if (as === "a") {
    return (
      <a href={href} className={className} onClick={handleClick}>
        {children}
      </a>
    );
  }

  if (as === "div") {
    return (
      <div
        role="button"
        tabIndex={0}
        className={className}
        onClick={handleClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleClick(e as any)}
      >
        {children}
      </div>
    );
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
