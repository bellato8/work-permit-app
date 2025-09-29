// ======================================================================
// File: web/src/pages/admin/Cleanup.tsx
// เวอร์ชัน: 2025-09-22 23:40 (Asia/Bangkok)
// เปลี่ยนเพื่อให้ตรงกับ MUI v6 (Grid v2):
//  - ใช้ Grid v2 (นำเข้า '@mui/material/Grid')
//  - ลบ prop `item` ออกจากลูกของ container ทั้งหมด
// ======================================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Card, CardContent, CardHeader, Typography, TextField, Button, Stack,
  Divider, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  Collapse, Paper, Chip, LinearProgress, Table, TableHead, TableRow, TableCell, TableBody
} from "@mui/material";
import Grid from "@mui/material/Grid";

import { getAuth, onIdTokenChanged } from "firebase/auth";
import {
  removeRequestAll, removeLogsAll, removeLogsByRid, removeLogsBefore,
  DeleteLogsResult, DeleteRequestCascadeResult,
} from "../../lib/adminCleanup";
import useAuthzLive from "../../hooks/useAuthzLive";

// ---------- ตัวช่วยตีความ superadmin หลายรูปแบบ ----------
function normalizeRole(v: unknown): string {
  return String(v ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}
function isSuperAdminLike(claims: any, authz: any): boolean {
  const roleFromClaims = normalizeRole(claims?.role);
  const roleFromAuthz  = normalizeRole(authz?.role);
  const fromRole = roleFromClaims === "superadmin" || roleFromAuthz === "superadmin";
  const fromFlags =
    claims?.superadmin === true || claims?.superAdmin === true || claims?.isSuperAdmin === true ||
    authz?.superadmin === true || authz?.roles?.superadmin === true;
  const capsFromClaims: string[] = Array.isArray(claims?.caps) ? claims.caps.map(normalizeRole) : [];
  const capsFromAuthz: string[]  = Array.isArray(authz?.caps)  ? authz.caps.map(normalizeRole)  : [];
  const fromCaps = capsFromClaims.includes("superadmin") || capsFromAuthz.includes("superadmin");
  return !!(fromRole || fromFlags || fromCaps);
}

type ConfirmKind = "reqRid" | "reqRidMulti" | "logsAll" | "logsRid" | "logsBefore";
type MultiItemResult = { rid: string; ok: boolean; err?: string };

const CleanupPage: React.FC = () => {
  const authz: any = useAuthzLive?.() ?? {};

  const [claims, setClaims] = useState<any>(null);
  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState<boolean>(true);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setClaims(null);
        setIsSuperadmin(false);
        setChecking(false);
        return;
      }
      const token = await user.getIdTokenResult(true);
      setClaims(token.claims || {});
      setIsSuperadmin(isSuperAdminLike(token.claims, authz));
      setChecking(false);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authz?.role, JSON.stringify(authz?.caps), authz?.superadmin, authz?.roles?.superadmin]);

  const refreshClaims = async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    setChecking(true);
    const token = await user.getIdTokenResult(true);
    setClaims(token.claims || {});
    setIsSuperadmin(isSuperAdminLike(token.claims, authz));
    setChecking(false);
  };

  // ====== ฟอร์ม/สถานะ UI ======
  const [rid, setRid] = useState("");
  const [ridsText, setRidsText] = useState("");
  const [logsRid, setLogsRid] = useState("");
  const [beforeTs, setBeforeTs] = useState("");
  const [busy, setBusy] = useState(false);

  // ====== โหมด "ลบหลาย RID" ======
  const [multiActive, setMultiActive] = useState(false);
  const [multiIdx, setMultiIdx] = useState(0);
  const [multiTotal, setMultiTotal] = useState(0);
  const [multiCurrent, setMultiCurrent] = useState<string>("");
  const [multiResults, setMultiResults] = useState<MultiItemResult[]>([]);

  const ridsList = useMemo(() => {
    const items = ridsText.split(/[\s,;]+/g).map(s => s.trim()).filter(Boolean);
    return Array.from(new Set(items));
  }, [ridsText]);

  const multiPercent = useMemo(() => {
    if (!multiActive || multiTotal <= 0) return 0;
    return Math.round((multiIdx / multiTotal) * 100);
  }, [multiActive, multiIdx, multiTotal]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMsg, setSnackMsg] = useState("");
  const [snackErr, setSnackErr] = useState(false);

  const [showDebug, setShowDebug] = useState(false);

  const superGuardText = useMemo(() => {
    if (checking || isSuperadmin === null) return "กำลังตรวจสิทธิ…";
    if (isSuperadmin === false) return "คุณไม่มีสิทธิ์ superadmin (ปุ่มทั้งหมดถูกปิดใช้งาน)";
    return "superadmin พร้อมใช้งานเครื่องมือล้างข้อมูล";
  }, [checking, isSuperadmin]);

  const beforeTsISO = useMemo(() => (beforeTs ? new Date(beforeTs).toISOString() : ""), [beforeTs]);

  const openConfirm = (kind: ConfirmKind) => {
    setConfirmKind(kind);
    setConfirmText("");
    setConfirmOpen(true);
  };

  const confirmTitle =
    confirmKind === "reqRid" ? "ยืนยันการลบงานทั้งชุดตาม RID"
    : confirmKind === "reqRidMulti" ? "ยืนยันการลบงาน 'หลาย RID'"
    : confirmKind === "logsAll" ? "ยืนยันการลบ Logs ทั้งหมด"
    : confirmKind === "logsRid" ? "ยืนยันการลบ Logs ตาม RID"
    : confirmKind === "logsBefore" ? "ยืนยันการลบ Logs ก่อนวัน-เวลา"
    : "ยืนยันการดำเนินการ";

  const confirmBody =
    confirmKind === "reqRid"
      ? `การลบนี้จะลบทั้งเอกสาร Firestore (รวม subcollections) และไฟล์ Storage ใต้ requests/${rid}/ ทั้งหมด!\n\nพิมพ์ RID ให้ตรงเพื่อยืนยัน: ${rid || "(ยังไม่ได้กรอก)"}`
    : confirmKind === "reqRidMulti"
      ? `จะลบงานตาม RID จำนวน ${ridsList.length} รายการ (ลบทีละงานอย่างปลอดภัย)\nตัวอย่าง: ${ridsList.slice(0, 5).join(", ")}${ridsList.length > 5 ? " …" : ""}\n\nพิมพ์คำว่า DELETE เพื่อยืนยัน`
    : confirmKind === "logsAll"
      ? `การลบนี้จะลบเอกสารในคอลเลกชัน "logs" ทั้งหมด! พิมพ์คำว่า DELETE เพื่อยืนยัน`
    : confirmKind === "logsRid"
      ? `จะลบ Logs เฉพาะที่มี rid = "${logsRid || "(ยังไม่ได้กรอก)"}"\nพิมพ์ RID ให้ตรงเพื่อยืนยัน`
    : confirmKind === "logsBefore"
      ? `จะลบ Logs ที่ createdAt ก่อน/เท่ากับเวลา ${beforeTs || "(ยังไม่ได้เลือก)"}\nพิมพ์คำว่า OK เพื่อยืนยัน`
    : "";

  const confirmOK =
    confirmKind === "reqRid"
      ? confirmText.trim() === rid.trim() && !!rid.trim()
    : confirmKind === "reqRidMulti"
      ? confirmText.trim().toUpperCase() === "DELETE" && ridsList.length > 0
    : confirmKind === "logsAll"
      ? confirmText.trim().toUpperCase() === "DELETE"
    : confirmKind === "logsRid"
      ? confirmText.trim() === logsRid.trim() && !!logsRid.trim()
    : confirmKind === "logsBefore"
      ? confirmText.trim().toUpperCase() === "OK" && !!beforeTs
    : false;

  const handleDo = async () => {
    if (!confirmKind) return;
    if (!isSuperadmin) {
      setSnackMsg("คุณไม่มีสิทธิ์ superadmin");
      setSnackErr(true);
      setSnackOpen(true);
      setConfirmOpen(false);
      return;
    }

    try {
      setBusy(true);

      let result: DeleteRequestCascadeResult | DeleteLogsResult | null = null;

      if (confirmKind === "reqRid") {
        await removeRequestAll(rid.trim());
        setSnackMsg(`ลบงาน ${rid.trim()} สำเร็จ`);
        setSnackErr(false);
      } else if (confirmKind === "reqRidMulti") {
        const list = [...ridsList];
        setMultiActive(true);
        setMultiIdx(0);
        setMultiTotal(list.length);
        setMultiCurrent("");
        setMultiResults([]);

        let ok = 0;
        const fail: Array<{ rid: string; msg: string }> = [];

        for (let i = 0; i < list.length; i++) {
          const r = list[i];
          setMultiCurrent(r);
          try {
            await removeRequestAll(r);
            ok++;
            setMultiResults(prev => [...prev, { rid: r, ok: true }]);
          } catch (e: any) {
            const msg = e?.message || String(e);
            fail.push({ rid: r, msg });
            setMultiResults(prev => [...prev, { rid: r, ok: false, err: "ล้มเหลว" }]);
          } finally {
            setMultiIdx(i + 1);
          }
        }

        setMultiActive(false);

        if (fail.length === 0) {
          setSnackMsg(`ลบงานแบบหลาย RID สำเร็จ: ${ok} รายการ`);
          setSnackErr(false);
        } else {
          setSnackMsg(`ลบสำเร็จ ${ok} รายการ, ล้มเหลว ${fail.length}`);
          setSnackErr(true);
        }
      } else if (confirmKind === "logsAll") {
        result = await removeLogsAll();
        setSnackMsg(`ลบ Logs ทั้งหมดสำเร็จ: ${(result as DeleteLogsResult).deleted} รายการ`);
        setSnackErr(false);
      } else if (confirmKind === "logsRid") {
        result = await removeLogsByRid(logsRid.trim());
        setSnackMsg(`ลบ Logs ของ RID ${logsRid.trim()} สำเร็จ: ${(result as DeleteLogsResult).deleted} รายการ`);
        setSnackErr(false);
      } else if (confirmKind === "logsBefore") {
        const ts = beforeTsISO || beforeTs;
        result = await removeLogsBefore(ts);
        setSnackMsg(`ลบ Logs ก่อนเวลาเลือก สำเร็จ: ${(result as DeleteLogsResult).deleted} รายการ`);
        setSnackErr(false);
      }

      setSnackOpen(true);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setSnackMsg(`ผิดพลาด: ${msg}`);
      setSnackErr(true);
      setSnackOpen(true);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const clearMultiResults = () => {
    setMultiResults([]);
    setMultiIdx(0);
    setMultiTotal(0);
    setMultiCurrent("");
  };

  const user = getAuth().currentUser;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mr: 1 }}>
          Cleanup (เฉพาะ superadmin)
        </Typography>
        <Button size="small" onClick={refreshClaims} disabled={checking}>
          รีเฟรชสิทธิ์
        </Button>
        <Button size="small" onClick={() => setShowDebug((v) => !v)}>
          {showDebug ? "ซ่อนดีบัก" : "แสดงดีบัก"}
        </Button>
        <Chip label={checking ? "ตรวจสิทธิ…" : isSuperadmin ? "superadmin" : "no access"} color={isSuperadmin ? "success" : "default"} size="small" />
      </Stack>

      <Typography variant="body2" color={isSuperadmin ? "success.main" : "text.secondary"} sx={{ mb: 2 }}>
        {checking ? "กำลังตรวจสิทธิ…" : isSuperadmin ? "superadmin พร้อมใช้งานเครื่องมือล้างข้อมูล" : "คุณไม่มีสิทธิ์ superadmin (ปุ่มทั้งหมดถูกปิดใช้งาน)"}
      </Typography>

      <Collapse in={showDebug}>
        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: "#fbfbff" }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>ดีบักสิทธิ์</Typography>
          <Typography variant="body2"><b>User:</b> {user?.email || "-"}</Typography>
          <Typography variant="body2"><b>authz.role:</b> {String(authz?.role ?? "-")}</Typography>
          <Typography variant="body2"><b>authz.caps:</b> {Array.isArray(authz?.caps) ? authz.caps.join(", ") : "-"}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}><b>token.claims keys:</b> {claims ? Object.keys(claims).join(", ") : "-"}</Typography>
          <Typography variant="body2"><b>token.role:</b> {String(claims?.role ?? "-")} | <b>token.superadmin:</b> {String(claims?.superadmin ?? "-")}</Typography>
          <Typography variant="body2"><b>สรุป isSuperadmin:</b> {String(isSuperadmin)}</Typography>
        </Paper>
      </Collapse>

      <Grid container spacing={3}>
        {/* ลบงานตาม RID - ทีละตัว */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardHeader title="ลบงานทั้งชุดตาม RID (ทีละตัว)" />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label="RID (เช่น WP-20250908-ZYNK)"
                  value={rid}
                  onChange={(e) => setRid(e.target.value)}
                  placeholder="พิมพ์ RID ที่ต้องการลบ"
                  disabled={busy || !isSuperadmin}
                  fullWidth
                />
                <Button
                  variant="contained"
                  color="error"
                  disabled={busy || !isSuperadmin || !rid.trim()}
                  onClick={() => openConfirm("reqRid")}
                >
                  ลบงานนี้ (อันตราย)
                </Button>
                <Typography variant="caption" color="text.secondary">
                  คำเตือน: จะลบเอกสาร Firestore (รวม subcollections) และไฟล์ใน Storage ใต้ <code>requests/{rid || "RID"}/</code> ทั้งหมด
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ลบงานหลาย RID */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" aria-busy={multiActive}>
            <CardHeader title="ลบงานหลาย RID (คั่นด้วยขึ้นบรรทัด/ช่องว่าง/คอมมา)" />
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label="ใส่หลาย RID ได้ เช่น บรรทัดละ 1 ตัว หรือคั่นด้วย , ; ช่องว่าง"
                  value={ridsText}
                  onChange={(e) => setRidsText(e.target.value)}
                  disabled={busy || !isSuperadmin || multiActive}
                  multiline
                  minRows={4}
                  fullWidth
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={`ตรวจพบ ${ridsList.length} RID`} size="small" />
                  {ridsList.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      ตัวอย่าง: {ridsList.slice(0, 3).join(", ")}{ridsList.length > 3 ? " …" : ""}
                    </Typography>
                  )}
                </Stack>
                <Button
                  variant="contained"
                  color="error"
                  disabled={busy || !isSuperadmin || ridsList.length === 0 || multiActive}
                  onClick={() => openConfirm("reqRidMulti")}
                >
                  ลบหลายงาน (อันตราย)
                </Button>

                <Collapse in={multiActive || multiResults.length > 0}>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {multiActive && (
                      <>
                        <Typography variant="body2">
                          กำลังลบ… ({multiIdx}/{multiTotal}) {multiCurrent ? `RID: ${multiCurrent}` : ""}
                        </Typography>
                        <LinearProgress variant="determinate" value={multiPercent} />
                      </>
                    )}

                    {multiResults.length > 0 && (
                      <Paper variant="outlined" sx={{ mt: 1 }}>
                        <Table size="small" aria-label="ผลการลบหลาย RID">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>RID</TableCell>
                              <TableCell sx={{ fontWeight: 600, width: 140 }}>ผลลัพธ์</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {multiResults.map((it, idx) => (
                              <TableRow key={`${it.rid}-${idx}`}>
                                <TableCell>{it.rid}</TableCell>
                                <TableCell sx={{ color: it.ok ? "success.main" : "error.main" }}>
                                  {it.ok ? "สำเร็จ" : "ล้มเหลว"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                          <Button size="small" onClick={clearMultiResults} disabled={multiActive}>
                            เคลียร์ผล
                          </Button>
                        </Stack>
                      </Paper>
                    )}
                  </Stack>
                </Collapse>

                <Typography variant="caption" color="text.secondary">
                  ระบบจะลบทีละงาน (sequential: ซี-เคว็น-เชิล) เพื่อลดความเสี่ยงเรื่องโควต้า/ไทม์เอาต์
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ลบ Logs */}
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardHeader title="ลบ Logs" />
            <CardContent>
              <Grid container spacing={3}>
                {/* ลบทั้งหมด */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">ลบทั้งหมด</Typography>
                    <Button
                      variant="contained"
                      color="error"
                      disabled={busy || !isSuperadmin}
                      onClick={() => openConfirm("logsAll")}
                    >
                      ลบ Logs ทั้งหมด (อันตราย)
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      ใช้เฉพาะกรณีจำเป็นมาก จะลบทุกเอกสารในคอลเลกชัน <code>logs</code>
                    </Typography>
                  </Stack>
                </Grid>

                {/* ลบตาม RID */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">ลบตาม RID</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="RID"
                        value={logsRid}
                        onChange={(e) => setLogsRid(e.target.value)}
                        placeholder="เช่น WP-20250908-ZYNK"
                        disabled={busy || !isSuperadmin}
                        fullWidth
                      />
                      <Button
                        variant="outlined"
                        color="error"
                        disabled={busy || !isSuperadmin || !logsRid.trim()}
                        onClick={() => openConfirm("logsRid")}
                      >
                        ลบ Logs ของ RID นี้
                      </Button>
                    </Stack>
                  </Stack>
                </Grid>

                {/* ลบก่อนวันเวลา */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">ลบก่อนวันเวลา</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        label="ก่อนเวลา (datetime-local)"
                        type="datetime-local"
                        value={beforeTs}
                        onChange={(e) => setBeforeTs(e.target.value)}
                        disabled={busy || !isSuperadmin}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                      />
                      <Button
                        variant="outlined"
                        color="error"
                        disabled={busy || !isSuperadmin || !beforeTs}
                        onClick={() => openConfirm("logsBefore")}
                      >
                        ลบ Logs ก่อนเวลานี้
                      </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      ระบบจะส่งเวลาเป็น ISO (UTC) ไปยังฟังก์ชันอัตโนมัติ
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, whiteSpace: "pre-line" }}>
            {confirmBody}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="พิมพ์เพื่อยืนยัน"
            placeholder={
              confirmKind === "logsAll" || confirmKind === "reqRidMulti" ? "พิมพ์ DELETE" :
              confirmKind === "logsBefore" ? "พิมพ์ OK" :
              "พิมพ์ RID ให้ตรง"
            }
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={busy}>ยกเลิก</Button>
          <Button onClick={handleDo} disabled={!confirmOK || busy} variant="contained" color="error">ยืนยัน</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackOpen} autoHideDuration={6500} onClose={() => setSnackOpen(false)}>
        <Alert onClose={() => setSnackOpen(false)} severity={snackErr ? "error" : "success"} variant="filled" sx={{ width: "100%" }}>
          {snackMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CleanupPage;
