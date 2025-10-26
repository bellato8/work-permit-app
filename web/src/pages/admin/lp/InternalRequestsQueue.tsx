// ======================================================================
// File: src/pages/admin/lp/InternalRequestsQueue.tsx
// Purpose: หน้าคิวคำขอภายใน (เวอร์ชันเริ่มต้น - กัน 404 และบอกแนวทาง)
// Created: 2025-10-26 (Asia/Bangkok)
// Updated: 2025-10-26 - Initial empty page with Thai copy
// ผู้แก้ไข: เพื่อนคู่คิด
// หมายเหตุ:
//   - หน้านี้ตั้งใจให้เป็น "หน้าว่างที่ใช้งานได้" ก่อน เพื่อกดเมนูแล้วไม่ 404
//   - รอบถัดไปจะใส่ตาราง, ปุ่ม "อนุมัติเบื้องต้น" (สร้าง RID + ลิงก์จำลอง) และปุ่ม "ปฏิเสธ"
// ======================================================================

import React from "react";
import { Box, Card, CardContent, Typography, Button, Stack } from "@mui/material";

export default function InternalRequestsQueuePage() {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          คิวคำขอภายใน
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ศูนย์กลางสำหรับเจ้าหน้าที่ LP เพื่อดูคำขอทั้งหมดจากพนักงานภายใน
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1.2}>
            <Typography>
              หน้านี้เป็นเวอร์ชันเริ่มต้น (ยังไม่เชื่อมข้อมูลจริง) — เราจะค่อย ๆ เติม:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>ตารางคำขอ (ค้นหา/กรองสถานะ)</li>
              <li>กด <b>อนุมัติเบื้องต้น</b> → ระบบตั้งสถานะเป็น “LP รับทราบ (รอผู้รับเหมา)” และสร้างลิงก์จำลอง (มี RID)</li>
              <li>กด <b>ปฏิเสธ</b> → เปลี่ยนสถานะเป็น “ไม่อนุมัติ”</li>
              <li>ทดสอบ flow ผ่านปุ่มจำลอง “ผู้รับเหมา submit” เพื่อกระโดดเป็น “รอ LP ตรวจสอบ”</li>
            </ul>

            <Typography variant="caption" color="text.secondary">
              หมายเหตุ: หน้านี้จะใช้ข้อมูลจาก Firestore และ Cloud Functions ตามโครงที่ตกลง
            </Typography>

            <Box>
              <Button variant="contained" disabled>
                (ตัวอย่างปุ่ม) อนุมัติเบื้องต้น
              </Button>
              <Button variant="outlined" sx={{ ml: 1 }} disabled>
                (ตัวอย่างปุ่ม) ปฏิเสธ
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
