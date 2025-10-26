// ======================================================================
// File: src/pages/admin/lp/LocationsPage.tsx
// Purpose: หน้าจัดการ "สถานที่ (Locations)" — เวอร์ชันเริ่มต้นกัน 404
// Created: 2025-10-26 (Asia/Bangkok)
// Updated: 2025-10-26 - Initial empty page with Thai copy
// ผู้แก้ไข: เพื่อนคู่คิด
// หมายเหตุ:
//   - หน้านี้เป็นโครงว่างเพื่อให้เมนูทำงานก่อน
//   - รอบถัดไปจะใส่: ตาราง, ค้นหา, ปุ่มเพิ่ม/แก้ไข/ลบ, toggle Active/Inactive
//   - ข้อมูลจริงจะอ่าน/เขียนที่ artifacts/{appId}/public/data/locations
// ======================================================================

import React from "react";
import { Box, Card, CardContent, Typography, Stack, Button } from "@mui/material";

export default function LocationsPage() {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          สถานที่ (Locations)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          จัดการรายชื่อพื้นที่/ร้านค้า เช่น ชื่อพื้นที่ ชั้น และสถานะเปิดใช้งาน
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1.2}>
            <Typography>
              เวอร์ชันเริ่มต้น (ยังไม่เชื่อมข้อมูลจริง) — แผนในรอบถัดไป:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>ตารางรายชื่อสถานที่ พร้อมค้นหา/กรอง</li>
              <li>ปุ่ม <b>เพิ่มสถานที่</b> (เปิดหน้าต่างเล็กกรอก: ชื่อ, ชั้น, สถานะ)</li>
              <li>ปุ่ม <b>แก้ไข/ลบ</b> รายการ</li>
              <li>สวิตช์ <b>Active/Inactive</b> เพื่อเปิด–ปิดการใช้งาน</li>
            </ul>

            <Box>
              <Button variant="contained" disabled>
                (ตัวอย่างปุ่ม) เพิ่มสถานที่
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary">
              หมายเหตุ: หน้านี้จะใช้ข้อมูลจาก Firestore ตามสคีมาที่ตกลง และตรวจสิทธิ์ตามกติกา
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
