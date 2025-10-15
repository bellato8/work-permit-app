// ======================================================================
// File: web/src/pages/__test__/TestPermissionEditor.tsx
// Purpose: หน้าทดสอบ PermissionEditor (โหมดทดลอง ไม่ผ่านหน้า Users)
// URL (หลังเพิ่ม route ใน App.tsx): /test-permission-editor
// ======================================================================

import React, { useState } from "react";
import {
  Container,
  Paper,
  Stack,
  Typography,
  Box,
  Button,
} from "@mui/material";
import PermissionEditor from "../../components/PermissionEditor";
import { getDefaultPermissions } from "../../lib/defaultPermissions";
import { PagePermissions } from "../../types/permissions";

type RoleKey = "viewer" | "approver" | "admin" | "superadmin";

export default function TestPermissionEditor() {
  // ไม่เปิดอัตโนมัติ ให้ผู้ใช้กดปุ่มเอง
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleKey>("approver");
  const [testEmail] = useState("test@example.com");

  const handleSave = async (perms: PagePermissions) => {
    console.log("📝 Saved permissions:", perms);

    // สรุปภาพรวมแบบย่อ (แสดง canView ของแต่ละหน้า)
    const summary = Object.keys(perms)
      .map((page) => {
        const pagePerms = perms[page as keyof PagePermissions] as any;
        const canView = pagePerms?.canView;
        return `${page}: ${canView ? "✅" : "❌"}`;
      })
      .join("\n");

    alert(`บันทึกสำเร็จ!\n\n${summary}`);

    // หน่วงนิดเดียวให้เห็นฟีล "กำลังบันทึก"
    await new Promise((r) => setTimeout(r, 500));
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          🧪 ทดสอบ Permission Editor
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          หน้านี้เอาไว้ทดสอบ PermissionEditor แบบแยกเดี่ยว ไม่ปะปนกับหน้า
          Users
        </Typography>

        <Stack spacing={2} sx={{ mt: 3 }}>
          {/* เลือก Role */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              เลือก Role สำหรับทดสอบ:
            </Typography>
            <Stack direction="row" spacing={1}>
              {(["viewer", "approver", "admin", "superadmin"] as const).map(
                (role) => (
                  <Button
                    key={role}
                    size="small"
                    variant={selectedRole === role ? "contained" : "outlined"}
                    onClick={() => setSelectedRole(role)}
                  >
                    {role}
                  </Button>
                )
              )}
            </Stack>
          </Box>

          {/* ปุ่มเปิด Editor */}
          <Button variant="contained" size="large" onClick={() => setOpen(true)}>
            เปิด Permission Editor
          </Button>

          {/* คำแนะนำ */}
          <Paper sx={{ p: 2, bgcolor: "info.lighter" }}>
            <Typography variant="subtitle2" gutterBottom>
              📌 คำแนะนำในการทดสอบ:
            </Typography>
            <Typography variant="body2" component="div">
              <ol>
                <li>เลือก Role ที่ต้องการทดสอบ</li>
                <li>กดปุ่ม "เปิด Permission Editor"</li>
                <li>ลองเปลี่ยน Checkbox ต่าง ๆ</li>
                <li>กดปุ่ม "รีเซ็ต" เพื่อดูค่าเริ่มต้น</li>
                <li>กดปุ่ม "บันทึก" → มี Alert และ Console Log</li>
              </ol>
            </Typography>
          </Paper>

          {/* โซน Console */}
          <Paper sx={{ p: 2, bgcolor: "grey.100" }}>
            <Typography variant="subtitle2" gutterBottom>
              💬 ตรวจสอบ Console:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
              เปิด DevTools (F12) → แท็บ Console เพื่อดูผลลัพธ์
            </Typography>
          </Paper>
        </Stack>
      </Paper>

      {/* Permission Editor Dialog */}
      <PermissionEditor
        open={open}
        onClose={() => setOpen(false)}
        email={testEmail}
        role={selectedRole}
        currentPermissions={getDefaultPermissions(selectedRole)}
        onSave={handleSave}
      />
    </Container>
  );
}
