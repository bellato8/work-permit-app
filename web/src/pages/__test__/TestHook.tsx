// web/src/pages/__test__/TestHook.tsx
import React from "react";
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import { CircularProgress, Alert, Button, Box, Typography } from "@mui/material";

export default function TestHook() {
  const { admins, loading, error, refreshAdmins, updatePermissions } = useAdminPermissions();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        🧪 ทดสอบ useAdminPermissions Hook
      </Typography>
      
      <Typography variant="h6" gutterBottom>
        จำนวนผู้ดูแล: {admins.length} คน
      </Typography>
      
      <Button 
        variant="contained" 
        onClick={refreshAdmins} 
        sx={{ mb: 2, mr: 2 }}
      >
        🔄 Refresh
      </Button>

      {/* ปุ่มทดสอบ Update - แสดงเฉพาะเมื่อมี admin และมี pagePermissions */}
      {admins.length > 0 && admins[0].pagePermissions && (
        <Button
          variant="outlined"
          color="secondary"
          onClick={async () => {
            try {
              // ✅ เช็คแน่ใจว่ามี pagePermissions ก่อน
              if (admins[0].pagePermissions) {
                await updatePermissions(
                  admins[0].email,
                  admins[0].pagePermissions
                );
                alert('✅ Update successful!');
              }
            } catch (err: any) {
              alert('❌ Update failed: ' + err.message);
            }
          }}
          sx={{ mb: 2 }}
        >
          🧪 Test Update (Admin: {admins[0]?.email})
        </Button>
      )}

      {/* แสดงข้อความถ้าไม่มี pagePermissions */}
      {admins.length > 0 && !admins[0].pagePermissions && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ⚠️ Admin คนแรกไม่มี pagePermissions - ไม่สามารถทดสอบ Update ได้
        </Alert>
      )}
      
      <pre style={{ 
        background: '#f5f5f5', 
        padding: '16px', 
        borderRadius: '8px', 
        overflow: 'auto',
        maxHeight: '500px'
      }}>
        {JSON.stringify(admins, null, 2)}
      </pre>
    </Box>
  );
}