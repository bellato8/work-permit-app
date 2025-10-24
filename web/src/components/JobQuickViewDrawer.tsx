// ======================================================================
// File: web/src/components/JobQuickViewDrawer.tsx
// อัปเดต: 2025-10-23
//
// เป้าหมายรอบนี้: ปรับให้ "อ่านง่ายบนมือถือ" และกระชับขึ้น โดยไม่แตะการทำงานเดิม
// - ทำ Drawer ให้ responsive: มือถือกว้างเต็มจอ, เดสก์ท็อปใช้ความกว้างที่กำหนด
// - ใช้ dvh สำหรับความสูงบนมือถือ + เผื่อ safe-area ด้านล่าง (iOS/มือถือจอเว้า)
// - ลดช่องไฟ/ฟอนต์ย่อยและใช้ List dense ให้เนื้อหากะทัดรัด
//
// อ้างอิงแนวทาง:
//   • Breakpoints/sx responsive ของ MUI
//   • List "dense" ของ MUI
//   • CSS env(safe-area-inset-*) และหน่วย dvh สำหรับ mobile viewport
// ======================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
// ★ เพิ่ม: theme + useMediaQuery เพื่อช่วยสลับค่าบางอย่างตามขนาดจอ
import { useMediaQuery, useTheme } from '@mui/material';

// ใช้ Firebase เพื่อขอโทเค็น เหมือนหน้า PermitDetails
import { auth, ensureSignedIn } from '../lib/firebase';

// URL เดียวกับหน้า PermitDetails
const GET_DETAIL_URL = import.meta.env.VITE_GET_REQUEST_ADMIN_URL as string;

// ---- ชนิดข้อมูลย่อของใบงาน (หัว Drawer) ----
export type JobSummary = {
  rid: string;
  title?: string;
  contractor?: string;
  area?: string;
  timeRangeText?: string;
  isIn?: boolean;
  canCheckIn?: boolean;
  canCheckOut?: boolean;
};

type ActionKind = 'checkin' | 'checkout';

type Props = {
  open: boolean;
  job: JobSummary | null;
  onClose: () => void;
  width?: number | string;            // ความกว้างสำหรับจอ ≥ sm (มือถือจะบังคับเต็มจอ)
  children?: React.ReactNode;
  initialFocusTarget?: 'close' | 'title';
  autoFocusDelay?: number;
  onCheckIn?: (job: JobSummary) => void | Promise<any>;
  onCheckOut?: (job: JobSummary) => void | Promise<any>;
  confirmCheckIn?: boolean;
  confirmCheckOut?: boolean;
  autoCloseOnSuccess?: boolean;
  successMessageCheckIn?: string;
  successMessageCheckOut?: string;
  disableCheckIn?: boolean;
  disableCheckOut?: boolean;
  primaryAction?: 'auto' | 'checkin' | 'checkout';
  hideDisabledActions?: boolean;
};

// =================== โครงข้อมูลสำหรับ “3 กล่อง” ===================
type PermitPreview = {
  requester: { name?: string; company?: string; phone?: string; idNo?: string };
  workers: Array<{ name?: string; idNo?: string }>;
  work: {
    type?: string;
    area?: string;
    floor?: string;
    dateText?: string;    // วัน-เดือน-ปีแบบย่อ
    timeText?: string;    // ช่วงเวลา HH:MM–HH:MM
    hotWork?: boolean;
    systems?: string[];   // รายการระบบอาคาร (ถ้ามี)
  };
};

// ---- ตัวช่วยหยิบค่าตัวแรกที่มีจริง ----
function pickFirst<T = any>(...vals: any[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return undefined;
}

function toDate(v: any): Date | undefined {
  if (!v && v !== 0) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

// ---- จัดรูปวันที่/เวลาให้อ่านง่าย (ไทย) ----
const fmtDateTh = new Intl.DateTimeFormat('th-TH', { year: 'numeric', month: 'short', day: '2-digit' });
const fmtTimeTh = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

// ---- แปลงข้อมูลดิบจาก API → ข้อมูล 3 กล่อง ----
function adaptRawToPreview(raw: any): PermitPreview {
  const r = raw || {};
  // บาง API ห่อข้อมูลไว้ใน { success, data } → ดึง data ออกมาก่อน
  const base = r?.data ?? r;
  const rq = base.requester || base.applicant || base.owner || {};

  const start = pickFirst(base?.work?.from, base?.time?.start, base?.from, base?.startAt);
  const end   = pickFirst(base?.work?.to,   base?.time?.end,   base?.to,   base?.endAt);

  const sDate = toDate(start);
  const eDate = toDate(end);
  const dateText =
    sDate ? fmtDateTh.format(sDate) :
    eDate ? fmtDateTh.format(eDate) : undefined;

  const timeText =
    sDate && eDate ? `${fmtTimeTh.format(sDate)}–${fmtTimeTh.format(eDate)}`
    : sDate ? `${fmtTimeTh.format(sDate)}–`
    : eDate ? `–${fmtTimeTh.format(eDate)}`
    : undefined;

  // ผู้ร่วมงาน: รองรับชื่อฟิลด์ได้หลายแบบ
  const arr = pickFirst<any[]>(base.workers, base.team, base.members) || [];
  const workers = arr.map((w: any) => ({
    name: pickFirst(w?.name, w?.fullname, w?.fullName),
    idNo: pickFirst(w?.citizenId, w?.documentId, w?.idNumber, w?.docNo, w?.cardNo),
  }));

  // ระบบอาคาร: รับได้ทั้ง array และ object true/false
  let systems: string[] | undefined = undefined;
  if (Array.isArray(base?.work?.systems)) systems = base.work.systems;
  else if (Array.isArray(base?.systems)) systems = base.systems;
  else if (base?.work?.systems && typeof base.work.systems === 'object') {
    systems = Object.keys(base.work.systems).filter((k) => !!base.work.systems[k]);
  } else if (base?.systems && typeof base.systems === 'object') {
    systems = Object.keys(base.systems).filter((k) => !!base.systems[k]);
  }

  return {
    requester: {
      name:    pickFirst(rq?.fullname, rq?.fullName, rq?.name, base.requesterName, base.applicantName),
      company: pickFirst(rq?.company, base.company, base.contractorCompany, base.contractor?.name),
      phone:   pickFirst(rq?.phone, rq?.mobile, base.phone, base.tel),
      idNo:    pickFirst(rq?.citizenId, rq?.documentId, rq?.idNumber, rq?.docNo, rq?.cardNo, base.requesterId),
    },
    workers,
    work: {
      type:    pickFirst(base?.work?.type, base?.jobType, base?.workType, base?.type),
      area:    pickFirst(base?.work?.area, base?.area, base?.location?.name, base?.site),
      floor:   pickFirst(base?.work?.floor, base?.floor, base?.zone, base?.section),
      dateText,
      timeText,
      hotWork: pickFirst(base?.work?.hotWork, base?.hotWork) ?? false,
      systems,
    },
  };
}

// ---- โหลดรายละเอียดจาก "ที่เดียวกับ PermitDetails" ----
async function loadPermitPreview(rid: string): Promise<PermitPreview | null> {
  if (!GET_DETAIL_URL) return null;
  try {
    // ขอไอดีโทเค็น (ผู้ใช้ต้องล็อกอินอยู่)
    await ensureSignedIn();
    const token = await auth.currentUser?.getIdToken();

    // ต่อ URL ให้สะอาด แล้วแนบ requestId
    const base = GET_DETAIL_URL.replace(/\/+$/, '');
    const url = `${base}?requestId=${encodeURIComponent(rid)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) return null;
    const raw = await res.json().catch(() => ({}));
    return adaptRawToPreview(raw);
  } catch {
    return null;
  }
}

export default function JobQuickViewDrawer({
  open,
  job,
  onClose,
  // ★ เดสก์ท็อป/แท็บเล็ตใช้ 420 (มือถือจะบังคับเต็มจออยู่แล้ว)
  width = 420,
  children,
  initialFocusTarget = 'close',
  autoFocusDelay = 50,
  onCheckIn,
  onCheckOut,
  confirmCheckIn = false,
  confirmCheckOut = true,
  autoCloseOnSuccess = true,
  successMessageCheckIn = 'เช็คอินสำเร็จ',
  successMessageCheckOut = 'เช็คเอาท์สำเร็จ',
  disableCheckIn,
  disableCheckOut,
  primaryAction = 'auto',
  hideDisabledActions = false,
}: Props) {
  const openerRef = useRef<Element | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const checkInBtnRef = useRef<HTMLButtonElement | null>(null);
  const checkOutBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const titleId = 'job-quickview-title';
  const descId = 'job-quickview-desc';

  const [confirmAction, setConfirmAction] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; kind: 'success' | 'error' | 'info' }>({
    open: false, msg: '', kind: 'success',
  });

  // ---------- ส่วนแสดง 3 กล่อง ----------
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PermitPreview | null>(null);

  // ★ ใช้ theme + media query เพื่อรู้ว่า "จอเล็ก" (≤ sm) หรือไม่
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // ใช้ควบคุม padding/spacing/ขนาดปุ่ม

  useEffect(() => {
    let alive = true;
    (async () => {
      if (open && job?.rid) {
        setLoading(true);
        const data = await loadPermitPreview(job.rid);
        if (alive) setPreview(data);
        setLoading(false);
      } else {
        setPreview(null);
      }
    })();
    return () => { alive = false; };
  }, [open, job?.rid]);

  // โฟกัสตอนเปิด/คืนโฟกัสตอนปิด (เพื่อใช้ง่ายและเข้าถึงได้)
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement;
      const id = window.setTimeout(() => {
        (initialFocusTarget === 'title' ? titleRef.current : closeBtnRef.current)?.focus();
      }, autoFocusDelay);
      return () => window.clearTimeout(id);
    }
  }, [open, initialFocusTarget, autoFocusDelay]);

  useEffect(() => {
    if (!open && openerRef.current instanceof HTMLElement) {
      const id = window.setTimeout(() => openerRef.current instanceof HTMLElement && openerRef.current.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const handleClose = () => { if (!busy) onClose(); };

  const canIn = !!job && !!onCheckIn && (job.canCheckIn ?? true) && !disableCheckIn;
  const canOut = !!job && !!onCheckOut && (job.canCheckOut ?? true) && !disableCheckOut;
  const primaryResolved: 'checkin' | 'checkout' =
    (primaryAction === 'auto') ? (job?.isIn ? 'checkout' : 'checkin') : primaryAction;
  const isPrimaryCheckIn = primaryResolved === 'checkin';

  const runAction = async (kind: ActionKind) => {
    if (!job) return;
    const fn = kind === 'checkin' ? onCheckIn : onCheckOut;
    const okMsg = kind === 'checkin' ? successMessageCheckIn : successMessageCheckOut;
    if (!fn) return;
    try {
      setBusy(true);
      await fn(job);
      setSnack({ open: true, msg: okMsg, kind: 'success' });
      setConfirmAction(null);
      if (autoCloseOnSuccess) onClose();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message || 'ดำเนินการไม่สำเร็จ', kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const requestAction = (kind: ActionKind, triggerEl?: HTMLElement | null) => {
    lastTriggerRef.current = triggerEl ?? null;
    const needConfirm = kind === 'checkin' ? confirmCheckIn : confirmCheckOut;
    if (needConfirm) setConfirmAction(kind);
    else void runAction(kind);
  };

  const confirmText = useMemo(() => {
    if (!job || !confirmAction) return { title: '', body: '' };
    const verb = confirmAction === 'checkin' ? 'เช็คอิน' : 'เช็คเอาท์';
    return {
      title: `ยืนยันการ${verb}`,
      body: `คุณกำลังจะ${verb} ใบงาน #${job.rid}${job.timeRangeText ? ` (${job.timeRangeText})` : ''} ดำเนินการต่อหรือไม่`,
    };
  }, [job, confirmAction]);

  const closeConfirm = () => {
    setConfirmAction(null);
    if (lastTriggerRef.current instanceof HTMLElement) lastTriggerRef.current.focus();
  };
  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      variant="temporary"
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': titleId,
        'aria-describedby': descId,
        // ★ Responsive: มือถือกินเต็มจอ, เดสก์ท็อปใช้ความกว้างที่กำหนด
        sx: {
          width: { xs: '100%', sm: width },
          maxWidth: '100vw',
          height: { xs: '100dvh', sm: 'auto' }, // dvh ทำให้เต็มหน้าจอจริงบนมือถือ
          maxHeight: '100dvh',
          borderRadius: { xs: 0, sm: 2 },
          outline: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* หัวข้อ — ลดช่องไฟบนมือถือ */}
      <Box sx={{ p: { xs: 1.25, sm: 2 }, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography id={titleId} variant={isMobile ? 'subtitle1' : 'h6'} sx={{ flex: 1, fontWeight: 700 }} ref={titleRef} tabIndex={-1}>
          {job ? `ใบงาน #${job.rid}` : 'รายละเอียดงาน'}
        </Typography>
        <IconButton ref={closeBtnRef} onClick={handleClose} aria-label="ปิดหน้าต่างย่อย" edge="end" disabled={busy}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>
      <Divider />

      {/* เนื้อหา — กล่องสรุป + 3 กล่องรายละเอียด */}
      <Box id={descId} sx={{ p: { xs: 1.25, sm: 2 }, flex: 1, overflow: 'auto' }}>
        {/* สรุปย่อด้านบน */}
        {job && (
          <Stack spacing={0.5} sx={{ mb: { xs: 1.25, sm: 2 } }}>
            <Typography variant="caption" color="text.secondary">ผู้รับเหมา</Typography>
            <Typography variant="body2">{job.contractor ?? '-'}</Typography>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>พื้นที่/ช่วงเวลา</Typography>
            <Typography variant="body2">{job.area ?? '-'} • {job.timeRangeText ?? '-'}</Typography>
          </Stack>
        )}

        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
            <Typography variant="caption" sx={{ mt: 1 }}>กำลังโหลดข้อมูล</Typography>
          </Stack>
        ) : (
          preview && (
            <Stack spacing={{ xs: 1.25, sm: 2 }}>
              {/* 1) ผู้ยื่นคำขอ */}
              <Box sx={{ p: { xs: 1, sm: 1.5 }, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 700 }}>1) ผู้ยื่นคำขอ</Typography>
                <List dense disablePadding>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="ผู้ยื่นคำขอ"
                      secondary={preview.requester.name || '—'}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="บริษัท"
                      secondary={preview.requester.company || '—'}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="เบอร์โทร"
                      secondary={preview.requester.phone || '—'}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="เลขบัตร/เอกสาร"
                      secondary={preview.requester.idNo || '—'}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                </List>
              </Box>

              {/* 2) ผู้ร่วมงาน */}
              <Box sx={{ p: { xs: 1, sm: 1.5 }, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 700 }}>
                  2) ผู้ร่วมงาน ({preview.workers.length} คน)
                </Typography>
                {preview.workers.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">—</Typography>
                ) : (
                  <List dense disablePadding>
                    {preview.workers.map((w, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                        <ListItemText
                          primary={w.idNo || '—'}
                          secondary={w.name || undefined}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>

              {/* 3) รายละเอียดงาน/สถานที่/เวลา */}
              <Box sx={{ p: { xs: 1, sm: 1.5 }, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.75, fontWeight: 700 }}>
                  3) รายละเอียดงาน/สถานที่/เวลา
                </Typography>
                <List dense disablePadding>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="ประเภทงาน"
                      secondary={preview.work.type || '—'}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="พื้นที่ปฏิบัติงาน"
                      secondary={preview.work.area || '—'}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="ชั้น/โซน"
                      secondary={preview.work.floor || '—'}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="ช่วงเวลา"
                      secondary={
                        preview.work.dateText || preview.work.timeText
                          ? `${preview.work.dateText ?? ''}${preview.work.dateText && preview.work.timeText ? ' • ' : ''}${preview.work.timeText ?? ''}`
                          : '—'
                      }
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ py: { xs: 0, sm: 0.25 } }}>
                    <ListItemText
                      primary="งานร้อน (Hot Work)"
                      secondary={preview.work.hotWork ? 'มี' : 'ไม่มี'}
                      primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                </List>

                <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {(preview.work.systems && preview.work.systems.length > 0) ? (
                    preview.work.systems.map((s, i) => (
                      <Chip key={i} size="small" variant="outlined" label={s} sx={{ height: 22 }} />
                    ))
                  ) : (
                    <Typography variant="caption" color="text.secondary">ไม่มีข้อมูลระบบอาคาร</Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          )
        )}

        {children}
      </Box>

      {/* แถบปุ่มล่าง — เผื่อ safe-area บนมือถือ */}
      {(!!onCheckIn || !!onCheckOut) && (
        <>
          <Divider />
          <Box
            sx={{
              p: { xs: 1, sm: 2 },
              // เพิ่มพื้นที่กันชนด้านล่างสำหรับมือถือ (gesture bar / จอเว้า)
              pb: { xs: 'calc(env(safe-area-inset-bottom) + 8px)', sm: 2 },
              position: 'sticky',
              bottom: 0,
              bgcolor: 'background.paper',
              borderTop: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {(onCheckIn || !hideDisabledActions) && (
                <Button
                  ref={checkInBtnRef}
                  variant={isPrimaryCheckIn ? 'contained' : 'outlined'}
                  size={isMobile ? 'small' : 'medium'}
                  onClick={(e) => requestAction('checkin', e.currentTarget)}
                  disabled={busy || !((job && onCheckIn && (job.canCheckIn ?? true) && !disableCheckIn))}
                >
                  {busy ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                  เช็คอิน
                </Button>
              )}
              {(onCheckOut || !hideDisabledActions) && (
                <Button
                  ref={checkOutBtnRef}
                  variant={!isPrimaryCheckIn ? 'contained' : 'outlined'}
                  size={isMobile ? 'small' : 'medium'}
                  onClick={(e) => requestAction('checkout', e.currentTarget)}
                  disabled={busy || !((job && onCheckOut && (job.canCheckOut ?? true) && !disableCheckOut))}
                >
                  {busy ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                  เช็คเอาท์
                </Button>
              )}
            </Stack>
          </Box>
        </>
      )}

      {/* กล่องยืนยันสั้น ๆ */}
      <Dialog open={!!confirmAction} onClose={busy ? undefined : closeConfirm} aria-labelledby="confirm-title" aria-describedby="confirm-desc" keepMounted>
        <DialogTitle id="confirm-title">{(confirmAction === 'checkin') ? 'ยืนยันการเช็คอิน' : 'ยืนยันการเช็คเอาท์'}</DialogTitle>
        <DialogContent>
          <Typography id="confirm-desc" variant="body2">
            {job ? `คุณกำลังจะ${confirmAction === 'checkin' ? 'เช็คอิน' : 'เช็คเอาท์'} ใบงาน #${job.rid}${job.timeRangeText ? ` (${job.timeRangeText})` : ''}` : ''}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm} autoFocus disabled={busy}>ยกเลิก</Button>
          <Button variant="contained" color={confirmAction === 'checkout' ? 'error' as any : 'primary'} onClick={() => runAction(confirmAction!)} disabled={busy}>
            {busy ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>

      {/* แจ้งผลสั้น ๆ */}
      <Snackbar open={snack.open} autoHideDuration={2500} onClose={closeSnack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={closeSnack} severity={snack.kind} variant="filled" sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Drawer>
  );
}
