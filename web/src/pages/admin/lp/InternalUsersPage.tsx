// ======================================================================
// File: src/pages/admin/lp/InternalUsersPage.tsx
// Purpose: หน้าจัดการ "ผู้ใช้ภายใน" — เวอร์ชันเริ่มต้นกัน 404
// Created: 2025-10-26 (Asia/Bangkok)
// Updated: 2025-10-26 - Initial empty page with Thai copy
// ผู้แก้ไข: เพื่อนคู่คิด
// หมายเหตุ:
//   - หน้านี้เป็นโครงว่างเพื่อให้เมนูทำงานก่อน
//   - รอบถัดไปจะใส่: ตาราง users_internal, ปุ่มเพิ่ม/แก้ไข/ลบ (email/password/department)
//   - ตรวจสิทธิ์ให้เฉพาะ LP admin/superadmin ทำได้ตามกติกา
// ======================================================================

import React from "react";
import { Box, Card, CardContent, Typography, Stack, Button } from "@mui/material";

export default function InternalUsersPage() {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          ผู้ใช้ภายใน
        </Typography>
        <Typography variant="body2" color="text.secondary">
          จัดการบัญชีพนักงานภายใน (อีเมล รหัสผ่าน แผนก) สำหรับใช้งาน Internal Portal
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1.2}>
            <Typography>
              เวอร์ชันเริ่มต้น (ยังไม่เชื่อมข้อมูลจริง) — แผนในรอบถัดไป:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>ตารางรายชื่อผู้ใช้ภายใน (ค้นหา/กรอง)</li>
              <li>ปุ่ม <b>เพิ่มผู้ใช้</b> (อีเมล/รหัสผ่าน/ชื่อ/แผนก)</li>
              <li>ปุ่ม <b>แก้ไข</b> และ <b>ลบ</b></li>
            </ul>

            <Box>
              <Button variant="contained" disabled>
                (ตัวอย่างปุ่ม) เพิ่มผู้ใช้
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary">
              หมายเหตุ: ข้อมูลจริงจะอ่าน/เขียนจากคอลเลกชัน <code>users_internal</code>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
