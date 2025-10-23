// ======================================================================
// File: web/src/components/QuickViewConnector.tsx
// เวอร์ชัน: 2025-10-22 19:xx Asia/Bangkok
// สรุป: ตัว "ตัวกลาง/ตัวเชื่อม" ให้การ์ดกดแล้วเปิด Quick View ได้ทันที
// ใช้คู่กับ QuickViewDrawer + QuickViewPermitInfo ที่มีอยู่แล้ว
// แนวคิด: หน้าเดิมเพิ่มแค่ 3 จุด → import / ครอบรายการ / onClick เรียก open(permit)
// การเปลี่ยนแปลงในเวอร์ชันนี้ (ตาม "ทางเลือก A"):
// - เปลี่ยนบรรทัด import จาก '@/components/...' --> ใช้ทางใกล้ './...'
// - อัปเดตตัวอย่างการใช้งานท้ายไฟล์ให้เข้ากัน
// หมายเหตุ:
// - ถ้าภายหลังต้องการใช้ '@' เป็นทางลัด ให้ตั้งค่า tsconfig 'paths' + vite 'resolve.alias'
//   (ตอนนี้ใช้ทางใกล้เพื่อให้คอมไพล์ผ่านก่อน)
// ======================================================================

import * as React from "react";
import QuickViewDrawer from "./QuickViewDrawer";
import QuickViewPermitInfo, {
  QuickViewPermitInfoProps,
} from "./QuickViewPermitInfo";

// โครงข้อมูลขั้นต่ำที่ตัวเชื่อมคาดหวัง (ยืดหยุ่น: มีเท่าไรก็ส่งมาเท่านั้น)
export type PermitLike = QuickViewPermitInfoProps & {
  rid?: string; // เช่น "WP-20251022-XXXX"
};

export interface QuickViewConnectorProps {
  // children เป็นฟังก์ชันที่เราจะส่งตัวช่วย { open } ให้ไปใช้กับการ์ด
  children: (helpers: { open: (permit: PermitLike) => void }) => React.ReactNode;

  // ปรับแต่งหัวข้อส่วนบนของ Drawer ได้ ถ้าอยาก override
  titleOverride?: (permit?: PermitLike | null) => string | undefined;
  subtitleOverride?: (permit?: PermitLike | null) => string | undefined;

  // ความกว้างลิ้นชัก (ถ้าอยากกำหนดเอง)
  width?: number | string;
}

export default function QuickViewConnector(props: QuickViewConnectorProps) {
  const { children, titleOverride, subtitleOverride, width } = props;

  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<PermitLike | null>(null);

  // เรียกตอนการ์ดโดนคลิก
  const handleOpen = (permit: PermitLike) => {
    setData(permit);
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const title =
    titleOverride?.(data) ??
    (data?.title || (data?.rid ? `ใบงาน ${data.rid}` : "ใบงาน"));

  const subtitle =
    subtitleOverride?.(data) ?? (data?.rid ? String(data.rid) : undefined);

  return (
    <>
      {/* ส่งตัวช่วย open ไปให้ส่วนลูก (รายการ/การ์ด) */}
      {children({ open: handleOpen })}

      {/* ลิ้นชักด้านขวา + คอนเทนต์อ่านเร็ว */}
      <QuickViewDrawer
        open={open}
        onClose={handleClose}
        title={title}
        subtitle={subtitle}
        width={width}
      >
        {data ? <QuickViewPermitInfo {...data} /> : null}
      </QuickViewDrawer>
    </>
  );
}

/*
วิธีใช้กับไฟล์หน้าเดิม (ตัวอย่าง 3 บรรทัด):
------------------------------------------------
1) นำเข้า (ใช้ทางใกล้)
   import QuickViewConnector from "./QuickViewConnector";

2) ครอบส่วนที่แสดง "รายการการ์ดงาน"
   <QuickViewConnector>
     {({ open }) => (
       <Stack /* ที่นี่คือรายการของคุณ *\/>
         {list.map((permit) => (
           <GlassCard
             key={permit.rid}
             onClick={() =>
               open({
                 rid: permit.rid,
                 title: permit.title,
                 contractorName: permit.contractor?.name,
                 location: permit.locationText,
                 schedule: {
                   dateText: permit.dateText,
                   startTime: permit.startTime,
                   endTime: permit.endTime,
                 },
                 status: permit.status, // "scheduled" | "in" | "out" | ...
                 counts: {
                   scheduled: permit.planCount,
                   checkedIn: permit.checkedIn,
                   checkedOut: permit.checkedOut,
                 },
                 badges: permit.badges,
                 meta: { "ผู้ควบคุมงาน": permit.ownerName },
                 notes: permit.note,
               })
             }
           >
             ... เนื้อหาการ์ดเดิม ...
           </GlassCard>
         ))}
       </Stack>
     )}
   </QuickViewConnector>

หมายเหตุ:
- ถ้า onClick ทับกับปุ่มย่อย (เช่น "เช็คอิน/เอาต์") ให้ใส่ onClick เฉพาะส่วนหัวการ์ด
  และใส่ stopPropagation() ในปุ่มย่อย เพื่อไม่ให้เปิด Drawer ผิดจังหวะ
- Drawer รองรับเลือกด้านเปิดด้วย anchor และปิดด้วย onClose (ESC/คลิกฉากหลัง) เป็นมาตรฐาน
  จึงสอดคล้องกับการใช้งานทั่วไปและการเข้าถึงได้ง่าย
*/
