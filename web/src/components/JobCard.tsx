// ======================================================================
// File: web/src/components/JobCard.tsx
// เวอร์ชัน: 2025-10-22 21:10 Asia/Bangkok
// สรุป: การ์ดงานที่ "กดทั้งใบ" ได้ พร้อมรองรับคีย์บอร์ดเต็มรูปแบบ
// - แก้ error: ย้าย sx/โค้ดโต้ตอบจาก GlassCard ไปไว้ที่ Box ด้านนอก
// - คลิก/Enter/Space -> เปิด Quick View Drawer ผ่าน useJobQuickView()
// - แสดงวงโฟกัสเฉพาะตอนใช้คีย์บอร์ด (:focus-visible)
// อ้างอิงแนวทาง: role="button" ต้องรองรับ Enter/Space (MDN),
// ใช้ Box ของ MUI เมื่อต้องการ sx (MUI Box API)
// ======================================================================

import React, { KeyboardEvent, useId } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useJobQuickView } from './JobQuickViewProvider';
import { JobSummary } from './JobQuickViewDrawer';
import GlassCard from './GlassCard'; // ถ้าไม่มี ให้เปลี่ยนเป็น MUI Paper ได้

type Props = {
  job: JobSummary;
  // หมายเหตุ: ถ้าต้องการสไตล์พิเศษเพิ่มเติม ให้ปรับที่ Box ด้านนอกแทน (รองรับ sx)
  sx?: object;
};

export default function JobCard({ job, sx }: Props) {
  const { openQuickView } = useJobQuickView();
  const describedById = useId();

  const handleActivate = () => {
    openQuickView(job);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // ทำตัวเสมือน "ปุ่ม": Enter หรือ Space = กดเปิด
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  // ป้ายอธิบายแบบสั้น ๆ สำหรับผู้อ่านหน้าจอ
  const ariaLabel = `เปิดดูงานแบบเร็ว #${job.rid}`;
  const ariaDesc = `ผู้รับเหมา ${job.contractor ?? 'ไม่ระบุ'}, พื้นที่ ${job.area ?? 'ไม่ระบุ'}, เวลา ${job.timeRangeText ?? 'ไม่ระบุ'}`;

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-describedby={describedById}
      onClick={handleActivate}
      onKeyDown={onKeyDown}
      sx={{
        cursor: 'pointer',
        outline: 'none',
        borderRadius: 2,
        // โชว์วงโฟกัสเฉพาะตอนใช้คีย์บอร์ด (อ่านง่าย ไม่รบกวนสายตาเวลาคลิกเมาส์)
        '&:focus-visible': {
          boxShadow: '0 0 0 3px rgba(25,118,210,0.6)',
        },
        // อนุญาตให้ผู้ใช้ส่ง sx เสริมมาได้
        ...sx,
      }}
    >
      <GlassCard clickable>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">ใบงาน #{job.rid}</Typography>
          {job.title && <Typography variant="body2">{job.title}</Typography>}
          <Typography variant="body2" color="text.secondary">
            {job.contractor ?? '-'} • {job.area ?? '-'} • {job.timeRangeText ?? '-'}
          </Typography>
        </Stack>

        {/* ข้อความซ่อนสำหรับผู้อ่านหน้าจอ */}
        <Box
          id={describedById}
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {ariaDesc}
        </Box>
      </GlassCard>
    </Box>
  );
}
