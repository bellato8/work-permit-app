import { useState } from "react";
import { Button, Box, Typography, Paper, CircularProgress } from "@mui/material";
import { getDailyWorkByDate } from "../services/dailyOperationsService";

export default function TestDaily() {
  // ตัวแปรเก็บสถานะต่างๆ
  const [loading, setLoading] = useState(false); // กำลังโหลดหรือไม่
  const [result, setResult] = useState<any>(null); // เก็บผลลัพธ์จาก API
  const [error, setError] = useState<string>(""); // เก็บข้อความ Error (ถ้ามี)

  // ฟังก์ชันทดสอบเรียก API
  async function testGetDailyWork() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      // เรียก API โหลดงานวันที่ 13 ตุลาคม 2025
      const data = await getDailyWorkByDate("2025-10-13");
      setResult(data); // เก็บผลลัพธ์
      console.log("✅ API สำเร็จ:", data);
    } catch (e: any) {
      // ถ้าเกิด Error
      setError(e.message || "เกิดข้อผิดพลาดไม่ทราบสาเหตุ");
      console.error("❌ API ผิดพลาด:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1200, margin: "0 auto" }}>
      {/* หัวข้อหน้า */}
      <Typography variant="h4" gutterBottom>
        🧪 ทดสอบ Daily Operations Service
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        หน้านี้ใช้สำหรับทดสอบการเรียก API ดูงานรายวัน
      </Typography>

      {/* ปุ่มทดสอบ */}
      <Button 
        variant="contained" 
        size="large"
        onClick={testGetDailyWork} 
        disabled={loading}
        sx={{ mb: 3 }}
      >
        {loading ? "กำลังโหลด..." : "🚀 ทดสอบโหลดงานรายวัน (13 ต.ค. 2025)"}
      </Button>

      {/* แสดง Loading */}
      {loading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <CircularProgress size={24} />
          <Typography>กำลังเรียก API...</Typography>
        </Box>
      )}

      {/* แสดง Error (ถ้ามี) */}
      {error && (
        <Paper 
          sx={{ 
            p: 3, 
            mb: 3, 
            bgcolor: "#ffebee", 
            border: "2px solid #f44336" 
          }}
        >
          <Typography variant="h6" color="error" gutterBottom>
            ❌ เกิดข้อผิดพลาด
          </Typography>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Paper>
      )}

      {/* แสดงผลลัพธ์ (ถ้ามี) */}
      {result && (
        <Paper sx={{ p: 3, bgcolor: "#f5f5f5" }}>
          <Typography variant="h6" gutterBottom color="success.main">
            ✅ เรียก API สำเร็จ!
          </Typography>
          
          {/* แสดงสรุปข้อมูล */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1">
              📅 <strong>วันที่:</strong> {result.date}
            </Typography>
            <Typography variant="body1">
              📊 <strong>งานทั้งหมด:</strong> {result.total} รายการ
            </Typography>
            <Typography variant="body1">
              📋 <strong>งานที่กำหนดไว้:</strong> {result.scheduled?.length || 0} รายการ
            </Typography>
            <Typography variant="body1">
              ✅ <strong>เช็คอินแล้ว:</strong> {result.checkedIn?.length || 0} รายการ
            </Typography>
            <Typography variant="body1">
              🏁 <strong>เช็คเอาท์แล้ว:</strong> {result.checkedOut?.length || 0} รายการ
            </Typography>
          </Box>

          {/* แสดงข้อมูลแบบ JSON */}
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
            📄 ข้อมูลทั้งหมด (JSON):
          </Typography>
          <Box 
            sx={{ 
              bgcolor: "#fff", 
              p: 2, 
              borderRadius: 1,
              overflow: "auto",
              maxHeight: 400
            }}
          >
            <pre style={{ margin: 0, fontSize: "12px" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </Box>
        </Paper>
      )}
    </Box>
  );
}