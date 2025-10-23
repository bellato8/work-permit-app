// ======================================================================
// File: web/src/components/GlassCard.tsx
// อัปเดต: 2025-10-22 Asia/Bangkok
// สรุปการเปลี่ยนแปลง:
// - เพิ่มตัวเลือก clickable?: boolean เพื่อให้ "การ์ด" คลิกได้แบบปลอดภัย
// - ส่งต่อ props มาตรฐาน HTML (onClick, aria-*, tabIndex, className, ฯลฯ)
// - ถ้าเป็นโหมดคลิกได้และไม่ใช่ปุ่มจริง ๆ จะใส่ role="button" + tabIndex=0
//   และรองรับคีย์บอร์ด (Enter/Space) ให้ทำงานเท่ากับการคลิก
//   => ตรงตามแนวปฏิบัติ WAI-ARIA/MDN สำหรับปุ่มกำหนดเอง
// หมายเหตุ:
// - ใช้ "ภาษาคน" ในคอมเมนต์ไว้ให้เพื่อนร่วมทีมเข้าใจง่าย
// - ไม่ทำลายพฤติกรรมเดิม: ถ้าไม่ระบุ clickable และไม่ส่ง onClick ก็จะทำงานเหมือนเดิม
// ======================================================================

import React from "react";

// Props หลักของการ์ด + รับ props มาตรฐานของ HTML เพิ่มเติม (เช่น onClick/aria-label)
type GlassCardProps = React.PropsWithChildren<{
  /** หัวข้อด้านซ้ายบนของการ์ด */
  title?: string;
  /** คำอธิบายสั้นใต้หัวข้อ */
  subtitle?: string;
  /** พื้นที่ฝั่งขวา เช่น ปุ่ม/ชิป/สถานะ */
  right?: React.ReactNode;
  /** เปิดโหมด "คลิกได้" (จะมีโฮเวอร์/โฟกัส/คีย์บอร์ด) */
  clickable?: boolean;
}> &
  React.HTMLAttributes<HTMLElement>; // รับ onClick, aria-*, tabIndex, className, onKeyDown, ...

export default function GlassCard(props: GlassCardProps) {
  const {
    title,
    subtitle,
    right,
    clickable = false,
    children,
    className,
    onKeyDown,
    ...rest
  } = props;

  // ถ้าผู้ใช้ส่ง onClick มา หรือกำหนด clickable เอง ถือว่า "โต้ตอบได้"
  const isInteractive = clickable || typeof rest.onClick === "function";

  // รองรับคีย์บอร์ด: ถ้าโต้ตอบได้ ให้ Enter/Space ทำงานเท่ากับคลิก
  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    // เรียก onKeyDown ต้นฉบับก่อน (ถ้ามี) เผื่อเคสพิเศษ
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (!isInteractive) return;

    // กด Enter หรือ Space ให้ทำงานเหมือนคลิก
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      // เรียก onClick ที่ถูกส่งเข้ามา (ถ้ามี)
      const click = rest.onClick as React.MouseEventHandler<HTMLElement> | undefined;
      click?.(e as unknown as React.MouseEvent<HTMLElement>); // reuse event channel
    }
  };

  // ถ้าไม่ได้ส่ง aria-label มา และเป็นโหมดโต้ตอบได้ ให้ใช้ title เป็นฉลากอ่านออกเสียง
  const ariaLabel =
    (rest as any)["aria-label"] ?? (isInteractive ? title || subtitle : undefined);

  // เตรียมคลาสเสริมเวลาคลิกได้ (ชี้มือ โฮเวอร์ โฟกัสวงแหวน)
  const interactiveCls = isInteractive
    ? "cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 active:translate-y-[1px]"
    : "";

  // รวมคลาส (ยังคงคลาสของเดิมไว้)
  const mergedClassName = ["glass p-5 md:p-8", interactiveCls, className]
    .filter(Boolean)
    .join(" ");

  // หมายเหตุด้านเทคนิค (แบบภาษาคน):
  // - เราใช้ <section> เหมือนเดิม แต่ถ้าเป็นโหมดโต้ตอบได้ เราใส่ role="button" + tabIndex=0
  //   เพื่อให้กด Tab ไปโฟกัสได้ และกด Enter/Space ทำงานได้เหมือนปุ่มจริง ๆ
  // - ถ้าในเนื้อหามี "ปุ่มย่อย" อยู่แล้ว แนะนำให้ปุ่มย่อยใส่ e.stopPropagation()
  //   เพื่อไม่ให้กดปุ่มย่อยแล้วไปเปิดการ์ดโดยไม่ตั้งใจ

  return (
    <section
      // กระจาย props อื่น ๆ ที่ผู้ใช้ส่งมา (เช่น onClick, aria-*)
      {...rest}
      // ถ้าโต้ตอบได้ กำหนดบทบาทและโฟกัสด้วยคีย์บอร์ด
      role={isInteractive ? (rest.role ?? "button") : rest.role}
      tabIndex={isInteractive ? (rest.tabIndex ?? 0) : rest.tabIndex}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={mergedClassName}
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          {title && <h2 className="text-xl md:text-2xl font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
