// web/src/pages/admin/Requests.tsx
// ---------------------------------------------------------------------
// หน้าแอดมิน: แสดงรายการคำขอ โดยเรียกผ่าน API client (แนบ Bearer อัตโนมัติ)
// เวอร์ชัน: Material-UI (MUI v7)
// ---------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import { apiListRequests, type RequestItem } from "../../lib/apiClient";

// MUI Components
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Paper,
} from "@mui/material";

// MUI Icons
import RefreshIcon from "@mui/icons-material/Refresh";

type LoadState = "idle" | "loading" | "ok" | "error";

export default function Requests() {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  async function load() {
    try {
      setState("loading");
      setErrMsg("");
      const res = await apiListRequests({ limit: 25 });
      setItems(res.data.items || []);
      setState("ok");
    } catch (e: any) {
      setState("error");
      setErrMsg(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      console.error("apiListRequests error:", e);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Box>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5" fontWeight={700}>
          รายการคำขอ (Admin)
        </Typography>
        <Button
          variant="outlined"
          startIcon={
            state === "loading" ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <RefreshIcon />
            )
          }
          onClick={load}
          disabled={state === "loading"}
        >
          {state === "loading" ? "กำลังโหลด..." : "รีเฟรช"}
        </Button>
      </Stack>

      {/* Error Alert */}
      {state === "error" && (
        <Alert severity="error" sx={{ mb: 3 }}>
          เกิดข้อผิดพลาด: {errMsg}
        </Alert>
      )}

      {/* Table */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: "grey.50" }}>
                  <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>
                    RID
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>
                    สถานะ
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>
                    ชื่อผู้รับเหมา
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>
                    สร้างเมื่อ
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>
                    อัปเดตล่าสุด
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state === "loading" && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={40} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        กำลังโหลด...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        ไม่พบรายการ
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow
                      key={it.rid}
                      hover
                      sx={{ "&:last-child td": { border: 0 } }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {it.rid}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <StatusChip value={it.status} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {it.contractorName || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatTs(it.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatTs(it.updatedAt)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

// Status Chip Component
function StatusChip({ value }: { value?: string }) {
  const v = (value || "pending").toLowerCase();

  let color: "success" | "error" | "warning" = "warning";
  let label = "pending";

  if (v === "approved") {
    color = "success";
    label = "approved";
  } else if (v === "rejected") {
    color = "error";
    label = "rejected";
  }

  return (
    <Chip
      label={label}
      color={color}
      size="small"
      sx={{
        fontWeight: 600,
        fontSize: 11,
        textTransform: "lowercase",
      }}
    />
  );
}

// Format Timestamp
function formatTs(ts: any) {
  if (!ts) return "-";
  // รองรับทั้งเลข ms และ Timestamp ของ Firestore
  if (typeof ts === "number") return new Date(ts).toLocaleString("th-TH");
  if (typeof ts?._seconds === "number")
    return new Date(ts._seconds * 1000).toLocaleString("th-TH");
  return "-";
}
