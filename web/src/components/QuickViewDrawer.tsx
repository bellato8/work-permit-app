// ======================================================================
// File: web/src/components/QuickViewDrawer.tsx
// เวอร์ชัน: 2025-10-22 18:xx Asia/Bangkok
// สรุป: โครง “ลิ้นชักด้านขวา (Side Sheet/Drawer)” สำหรับ Quick View ใบงาน
// - ตั้งใจให้เป็นชิ้นส่วนกลาง ใช้ซ้ำได้ในหลายหน้า
// - เปิด/ปิดด้วยปุ่ม, คลิกฉากหลัง, หรือกด ESC
// - รองรับหัวข้อ/คำอธิบายสั้น/พื้นที่เนื้อหา/แถบปุ่มด้านล่าง
// - ความกว้างยืดหยุ่น: มือถือใช้ 90vw, จอใหญ่ไม่เกิน ~560–640px
// หมายเหตุ:
//   A1 = โครง/เปลือกเท่านั้น (ยังไม่ผูกข้อมูลจริง/ปุ่มเช็คอินเอาต์)
//   ขั้น A2/A3 จะค่อย ๆ ใส่ข้อมูลใบงานและปุ่มการทำงาน
// ======================================================================

import * as React from "react";
import { Drawer, Box, IconButton, Typography, Divider, Stack } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export interface QuickViewDrawerProps {
  /** เปิด/ปิดลิ้นชัก */
  open: boolean;
  /** สั่งปิดลิ้นชัก (คลิกกากบาท/ฉากหลัง/กด ESC) */
  onClose: () => void;

  /** หัวข้อด้านบน เช่น "ใบงาน #RID" */
  title?: string;
  /** คำอธิบายสั้นใต้หัวข้อ เช่น ชื่อผู้รับเหมา/พื้นที่ */
  subtitle?: string;

  /** ความกว้าง (ตัวเลือก) เช่น 560 หรือ "600px" ถ้าไม่กำหนดจะปรับตามหน้าจอ */
  width?: number | string;

  /** เนื้อหาหลักภายในลิ้นชัก - ใส่อะไรก็ได้ (A2 จะใส่รายละเอียดใบงาน) */
  children?: React.ReactNode;

  /** ส่วนปุ่ม/แถบการทำงานด้านล่าง (A3 จะใช้) */
  footer?: React.ReactNode;

  /** ใช้สำหรับทดสอบ/ระบุ element */
  id?: string;
}

export default function QuickViewDrawer(props: QuickViewDrawerProps) {
  const {
    open,
    onClose,
    title = "Quick View",
    subtitle,
    width,
    children,
    footer,
    id = "quick-view-drawer",
  } = props;

  // ความกว้างแบบยืดหยุ่น: มือถือใช้ 90% ของหน้าจอ, จอใหญ่ค่อยจำกัดไม่กว้างเกินไป
  const computedWidth = width ?? { xs: "90vw", sm: 520, md: 560, lg: 600 };

  return (
    <Drawer
      anchor="right"            // เปิดจากด้านขวา ตามแนวทาง side sheet
      open={open}
      onClose={onClose}         // คลิกฉากหลัง/กด ESC จะเรียก onClose ให้อัตโนมัติ
      keepMounted               // คง DOM ไว้เพื่อเปิด/ปิดได้ลื่นขึ้น
      PaperProps={{
        sx: {
          width: computedWidth,
          maxWidth: "min(92vw, 640px)",
          borderTopLeftRadius: 2,
          borderBottomLeftRadius: 2,
          boxShadow: 8,
          display: "flex",
          flexDirection: "column",
        },
        role: "dialog",
        "aria-modal": true,
        "aria-labelledby": `${id}-title`,
      }}
    >
      {/* ส่วนหัว */}
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={`${id}-title`} variant="h6" noWrap>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <IconButton
          aria-label={`ปิดหน้าต่าง ${title}`}
          onClick={onClose}
          edge="end"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* เนื้อหาหลัก - เลื่อนอ่านได้ */}
      <Box
        sx={{
          px: 2,
          py: 2,
          overflowY: "auto",
          flex: 1,
          // ระยะหายใจให้อ่านง่าย
          "& *": { lineHeight: 1.5 },
        }}
      >
        {children ?? (
          <Stack spacing={1}>
            <Typography variant="body1">
              ใส่รายละเอียดใบงานที่นี่ (A2 จะมาวางโครงข้อมูล)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              เคล็ดลับ: ช่องนี้ควรอ่านแล้วรู้เรื่องภายใน 10–20 วินาที
            </Typography>
          </Stack>
        )}
      </Box>

      {/* แถบปุ่มด้านล่าง (มีค่อยแสดง) */}
      {footer ? (
        <>
          <Divider />
          <Box
            sx={{
              px: 2,
              py: 1.5,
              display: "flex",
              gap: 1,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {footer}
          </Box>
        </>
      ) : null}
    </Drawer>
  );
}

/*
วิธีทดสอบแบบเร็ว (ชั่วคราว):
--------------------------------
1) นำเข้าไปใช้ในหน้าใดก็ได้
   import QuickViewDrawer from "@/components/QuickViewDrawer";

2) สร้าง state เปิด/ปิด แล้วลองคลิกปุ่มเปิดดู
   const [open, setOpen] = useState(false);
   <Button onClick={() => setOpen(true)}>เปิด Quick View</Button>
   <QuickViewDrawer
     open={open}
     onClose={() => setOpen(false)}
     title="ใบงาน #RID-123456"
     subtitle="ผู้รับเหมา: AAA • พื้นที่: โกดัง A"
   >
     <div>เนื้อหาทดสอบ</div>
   </QuickViewDrawer>

3) คาดหวัง:
   - ลิ้นชักเลื่อนจากขวา กดกากบาท/ฉากหลัง/ESC แล้วปิดได้
   - โฟกัสคีย์บอร์ดวนอยู่ในลิ้นชักจนกว่าจะปิด (จัดการโดย MUI Drawer/Modal)
*/
