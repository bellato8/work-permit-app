// ======================================================================
// File: src/pages/admin/lp/PermitApprovals.tsx
// Purpose: หน้าจอ “อนุมัติใบอนุญาต” (เวอร์ชันเริ่มต้น — กัน 404 และบอกแนวทาง)
// Created: 2025-10-26 (Asia/Bangkok)
// Updated: 2025-10-26 - Initial empty page with Thai copy
// ผู้แก้ไข: เพื่อนคู่คิด
// หมายเหตุ:
//   - หน้านี้เป็น “โครงเริ่มต้น” สำหรับ LP Admin เพื่อใช้อนุมัติ/ไม่อนุมัติ
//   - รอบถัดไปจะเติม: ตารางรายการที่ “รอ LP ตรวจสอบ”, แถบเชื่อมโยง Internal Request
//     (รหัสคำขอ / ผู้ขอ / แผนก) และปุ่มอนุมัติ/ไม่อนุมัติที่อัปเดตสถานะกลับไปยัง internal_requests
// ======================================================================

import React from "react";
import { Box, Card, CardContent, Typography, Stack, Button } from "@mui/material";

export default function PermitApprovalsPage() {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          อนุมัติใบอนุญาต
        </Typography>
        <Typography variant="body2" color="text.secondary">
          หน้านี้ไว้ตรวจสอบข้อมูลใบงานที่ “รอ LP ตรวจสอบ” และตัดสินใจ “อนุมัติเข้าทำงาน” หรือ “ไม่อนุมัติ”
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1.2}>
            <Typography>
              เวอร์ชันเริ่มต้น (ยังไม่เชื่อมข้อมูลจริง) — แผนในรอบถัดไป:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>ตารางรายการที่ <b>รอ LP ตรวจสอบ</b> เท่านั้น</li>
              <li>แสดง “แถบเชื่อมโยง” กับ Internal Request: รหัสคำขอ, ผู้ขอ, แผนก</li>
              <li>ปุ่ม <b>อนุมัติ</b> และ <b>ไม่อนุมัติ</b> ที่อัปเดตสถานะกลับไปยัง <code>internal_requests</code></li>
              <li>หลังอนุมัติ/ไม่อนุมัติ ให้ผู้ขอเห็นสถานะที่ Dashboard ของตัวเองทันที</li>
            </ul>

            <Box>
              <Button variant="contained" disabled>
                (ตัวอย่างปุ่ม) อนุมัติ
              </Button>
              <Button variant="outlined" sx={{ ml: 1 }} disabled>
                (ตัวอย่างปุ่ม) ไม่อนุมัติ
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary">
              หมายเหตุ: ข้อมูลจะมาจาก Firestore และปรับสถานะผ่าน Cloud Functions ตามแบบที่ตกลง
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
