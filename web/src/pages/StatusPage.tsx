// ======================================================================
// File: web/src/pages/StatusPage.tsx
// วันที่/เวลา: 2025-09-16 22:30 (Asia/Bangkok)
// ผู้เขียน: AI + สุทธิรักษ์ วิเชียรศรี
// หน้าที่: หน้าเช็คสถานะคำขอ (/status) + พิมพ์ PDF (UI ใช้ MUI)
// เพิ่มเติมรอบนี้:
//   • แสดง "อัปเดตล่าสุด" เป็นวันเวลาไทย (ปี พ.ศ.) อย่างถูกต้อง
//   • ปรับข้อความผิดพลาดให้อ่านง่ายเหมือนเดิม
// หมายเหตุ: ไม่แตะ endpoint เดิม และไม่เปลี่ยนโครงอินพุต/ปุ่มค้นหา/PDF
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { generatePermitPDF } from "../utils/permitPdf";

// MUI
import {
  Box,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

type DecisionBrief = {
  action: "approve" | "reject" | null;
  at: number | string | null;
  reason?: string | null;
};

type StatusData = {
  rid: string;
  status: string;
  updatedAt?: { _seconds?: number; _nanoseconds?: number } | string | null;
  contractorName?: string;
  company?: string;
  maskedPhone?: string;
  maskedEmail?: string;
  requireLast4?: boolean;
  decision?: DecisionBrief | null;
  rejectionReason?: string;
  phone?: string;
  email?: string;
  [key: string]: any;
};

const GET_STATUS_URL = import.meta.env.VITE_GET_STATUS_URL as string;

// ---------- เวลา: แปลงทุกทรง → millis + แสดงแบบไทย (ปี พ.ศ.) ----------
function toMillis(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v < 2_000_000_000_000 ? v * 1000 : v;
  if (typeof v === "object" && typeof v._seconds === "number") {
    return v._seconds * 1000 + Math.round((v._nanoseconds || 0) / 1e6);
  }
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : t;
}
/** แสดงวันเวลาไทย + ปี พ.ศ. (บังคับตัวเลขอารบิก) เช่น 16/09/2568 14:30 */
function fmtThaiDateTime(input?: any): string {
  const ms = toMillis(input);
  if (ms == null) return "-";
  const d = new Date(ms);
  // 'th-TH' จะใช้ปฏิทินไทย (พ.ศ.) อัตโนมัติอยู่แล้ว
  // เพิ่ม -u-nu-latn เพื่อให้ใช้เลขอารบิก (ไม่เป็นเลขไทย)
  return d.toLocaleString("th-TH-u-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function tStatus(th: string) {
  const v = th?.toLowerCase?.() || "";
  if (v === "approved") return "อนุมัติแล้ว";
  if (v === "rejected") return "ไม่อนุมัติ";
  if (v === "pending") return "รอดำเนินการ";
  return th || "-";
}

export default function StatusPage() {
  const [sp, setSp] = useSearchParams();
  const [rid, setRid] = useState(sp.get("rid") || "");
  const [last4, setLast4] = useState(sp.get("last4") || "");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<StatusData | null>(null);

  // Enter = ค้นหา
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, last4]);

  const validLast4 = useMemo(() => /^\d{4}$/.test((last4 || "").trim()), [last4]);

  // map error code → ข้อความอ่านง่าย
  function humanizeError(http: number, code?: string): string {
    const c = String(code || "").toLowerCase();
    if (!rid.trim() || !validLast4) return "กรุณากรอก RID และเลขท้าย 4 ตัวให้ครบถ้วน";
    if (c === "not_found" || http === 404) return "ไม่พบคำขอตาม RID/เลขท้ายที่ระบุ กรุณาตรวจสอบอีกครั้ง";
    if (c === "last4_mismatch" || http === 403) return "เลขท้าย 4 ตัวไม่ตรงกับข้อมูล กรุณาลองใหม่";
    if (c === "missing rid" || http === 400) return "กรุณาระบุ RID";
    return `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (HTTP ${http})`;
  }

  // ค้นหา
  const handleSearch = async () => {
    setErrorMsg(null);
    setResult(null);

    if (!rid.trim() || !validLast4) {
      setErrorMsg("กรุณากรอก RID และเลขท้าย 4 ตัวให้ครบถ้วน");
      return;
    }

    const next = new URLSearchParams(sp);
    next.set("rid", rid.trim());
    next.set("last4", last4.trim());
    setSp(next, { replace: true });

    try {
      setLoading(true);
      const url = `${GET_STATUS_URL}?rid=${encodeURIComponent(rid.trim())}&last4=${encodeURIComponent(
        last4.trim()
      )}`;
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
      const json = await res.json().catch(() => ({} as any));
      (window as any).__status_last = { ok: res.ok, res, json };

      if (!res.ok || !json?.ok) {
        setErrorMsg(humanizeError(res.status, json?.error));
        setResult(null);
        return;
      }
      setResult(json.data as StatusData);
    } catch (err: any) {
      setErrorMsg(`เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: ${String(err?.message || err)}`);
    } finally {
      setLoading(false);
    }
  };

  // พิมพ์ PDF (ดึงข้อมูลเต็ม)
  const handlePrintPDF = async () => {
    if (!rid.trim() || !last4.trim()) {
      alert("กรุณาค้นหาให้พบก่อนจึงสั่งพิมพ์ได้");
      return;
    }
    setPdfLoading(true);
    try {
      const url = `${GET_STATUS_URL}?rid=${encodeURIComponent(rid.trim())}&last4=${encodeURIComponent(
        last4.trim()
      )}&pdf=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "ไม่สามารถดึงข้อมูลฉบับเต็มได้");
      await generatePermitPDF(json.data);
    } catch (e: any) {
      alert(`พิมพ์ PDF ไม่สำเร็จ: ${e.message}`);
      console.error("PDF Generation Error:", e);
    } finally {
      setPdfLoading(false);
    }
  };

  const isRejected = useMemo(() => {
    const v = String(result?.status || "").toLowerCase();
    return v === "rejected" || v === "ไม่อนุมัติ";
  }, [result]);

  const rejectionText = useMemo(() => {
    if (!result) return "";
    const reason =
      result.rejectionReason ||
      result.decision?.reason ||
      result?.workers?.[0]?.rejectionReason ||
      "";
    return String(reason || "").trim();
  }, [result]);

  // เวลาอัปเดต (เลือก updatedAt → decision.at → undefined)
  const lastUpdated = useMemo(() => {
    return fmtThaiDateTime(result?.updatedAt ?? result?.decision?.at);
  }, [result]);

  return (
    <Box sx={{ maxWidth: 920, mx: "auto", py: 6 }}>
      <Card elevation={3} sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
            ตรวจสอบสถานะคำขอ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            กรอกรหัสคำขอ (RID) และเบอร์โทร 4 ตัวท้ายเพื่อดูผล “อนุมัติ/ไม่อนุมัติ”
          </Typography>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="รหัสคำขอ (RID)"
              placeholder="เช่น WP-2025xxxx-xxxx"
              value={rid}
              onChange={(e) => setRid(e.target.value)}
              autoFocus
            />
            <TextField
              fullWidth
              label="เบอร์โทร 4 ตัวท้าย"
              placeholder="เช่น 4435"
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              inputProps={{ maxLength: 4, inputMode: "numeric" }}
            />
            <Button
              variant="contained"
              size="large"
              onClick={handleSearch}
              disabled={loading}
              startIcon={<SearchIcon />}
              sx={{ px: 3, borderRadius: 2 }}
            >
              {loading ? "กำลังค้นหา..." : "ค้นหา"}
            </Button>
          </Stack>

          {errorMsg && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              <AlertTitle>ไม่สามารถดึงข้อมูล</AlertTitle>
              {errorMsg}
            </Alert>
          )}

          {result && (
            <Card variant="outlined" sx={{ mt: 3, borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={3}
                  divider={<Divider flexItem orientation="vertical" />}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      RID
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {result.rid}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      สถานะ
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {tStatus(result.status)}
                    </Typography>
                  </Box>
                  {result.maskedPhone && (
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        ยืนยันเบอร์
                      </Typography>
                      <Typography variant="h6">{result.maskedPhone}</Typography>
                    </Box>
                  )}
                </Stack>

                {/* แสดงเวลาอัปเดตล่าสุดแบบไทย (พ.ศ.) */}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  อัปเดตล่าสุด: <strong style={{ color: "#111827" }}>{lastUpdated}</strong>
                </Typography>

                {/* กล่องเหตุผลไม่อนุมัติ */}
                {isRejected && (
                  <Alert
                    severity="warning"
                    icon={<ErrorOutlineIcon />}
                    sx={{ mt: 2, borderRadius: 2, bgcolor: "error.lighter", color: "error.dark" } as any}
                  >
                    <AlertTitle>เหตุผลการไม่อนุมัติ</AlertTitle>
                    <Typography whiteSpace="pre-wrap">
                      {rejectionText || "ไม่มีเหตุผลที่ถูกระบุ"}
                    </Typography>
                  </Alert>
                )}

                {/* ปุ่ม PDF เฉพาะกรณีอนุมัติ */}
                {String(result.status || "").toLowerCase() === "approved" && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<PictureAsPdfIcon />}
                      onClick={handlePrintPDF}
                      disabled={pdfLoading}
                      sx={{ borderRadius: 2 }}
                    >
                      {pdfLoading ? "กำลังเตรียม PDF..." : "พิมพ์ใบอนุญาต (PDF)"}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
