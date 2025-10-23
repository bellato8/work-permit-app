// ======================================================================
// File: web/src/components/JobQuickViewDrawer.tsx
// เวอร์ชัน: 2025-10-23 00:00 Asia/Bangkok
// สรุป: Drawer แบบ Quick View สำหรับใบงาน (เปิดด้านขวา)
// - ปิดได้ 3 ทาง: กากบาท, ปุ่ม ESC, คลิกฉากหลัง (Backdrop)
// - ขังโฟกัสในกล่อง + คืนโฟกัสให้ตัวเปิด (แนว WAI-ARIA APG / MUI Modal)
// - กล่องยืนยันจุดเสี่ยง + กันกดซ้ำ + แจ้งผลสั้น ๆ
// - [ใหม่] อ่านสิทธิ/สถานะจาก job: { isIn?, canCheckIn?, canCheckOut? }
// - [ใหม่] เลือกปุ่มหลัก 'auto' ตาม isIn (no→เช็คอิน, yes→เช็คเอาท์)
// - [ใหม่] เลือกซ่อนปุ่มที่ใช้ไม่ได้ (hideDisabledActions)
// อ้างอิงแนวปฏิบัติ: โฟกัสใน dialog/APG, MUI focus trap, ปุ่มใน dialog/Material
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

// ---- ชนิดข้อมูลย่อของใบงาน ----
export type JobSummary = {
  rid: string;
  title?: string;
  contractor?: string;
  area?: string;
  timeRangeText?: string;

  // ธงสิทธิ/สถานะ (ถ้ามี)
  isIn?: boolean;         // อยู่ในพื้นที่แล้ว?
  canCheckIn?: boolean;   // อนุญาตเช็คอิน?
  canCheckOut?: boolean;  // อนุญาตเช็คเอาท์?
};

type ActionKind = 'checkin' | 'checkout';

type Props = {
  open: boolean;
  job: JobSummary | null;
  onClose: () => void;
  width?: number | string;
  children?: React.ReactNode;

  initialFocusTarget?: 'close' | 'title';
  autoFocusDelay?: number;

  // ปุ่มการทำงาน (รองรับ sync/async)
  onCheckIn?: (job: JobSummary) => void | Promise<any>;
  onCheckOut?: (job: JobSummary) => void | Promise<any>;

  // การยืนยัน
  confirmCheckIn?: boolean;
  confirmCheckOut?: boolean;

  // พฤติกรรมหลังสำเร็จ
  autoCloseOnSuccess?: boolean;
  successMessageCheckIn?: string;
  successMessageCheckOut?: string;

  // ปิดการกด (จากภายนอก)
  disableCheckIn?: boolean;
  disableCheckOut?: boolean;

  // เลือกปุ่มหลัก: 'auto' = ตามสถานะ, หรือบังคับ 'checkin'/'checkout'
  primaryAction?: 'auto' | 'checkin' | 'checkout';

  // ซ่อนปุ่มที่ใช้ไม่ได้ (แทนที่จะ gray out)
  hideDisabledActions?: boolean;
};

export default function JobQuickViewDrawer({
  open,
  job,
  onClose,
  width = 520,
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
  // คืนโฟกัสให้ตัวเปิด
  const openerRef = useRef<Element | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const checkInBtnRef = useRef<HTMLButtonElement | null>(null);
  const checkOutBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const titleId = 'job-quickview-title';
  const descId = 'job-quickview-desc';

  // ยืนยัน/สถานะกำลังทำงาน + แจ้งผล
  const [confirmAction, setConfirmAction] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; kind: 'success' | 'error' | 'info' }>({
    open: false, msg: '', kind: 'success',
  });

  // โฟกัสตอนเปิด
  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement;
      const id = window.setTimeout(() => {
        if (initialFocusTarget === 'title') {
          titleRef.current?.focus();
        } else {
          closeBtnRef.current?.focus();
        }
      }, autoFocusDelay);
      return () => window.clearTimeout(id);
    }
  }, [open, initialFocusTarget, autoFocusDelay]);

  // คืนโฟกัสตอนปิด
  useEffect(() => {
    if (!open && openerRef.current instanceof HTMLElement) {
      const id = window.setTimeout(() => {
        if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
      }, 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // ปิด (ห้ามปิดระหว่าง busy)
  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  // รวมเงื่อนไขปุ่มจาก job + ภายนอก
  const canIn = !!job && !!onCheckIn && (job.canCheckIn ?? true) && !disableCheckIn;
  const canOut = !!job && !!onCheckOut && (job.canCheckOut ?? true) && !disableCheckOut;

  // เลือกปุ่มหลักอัตโนมัติจากสถานะ (หรือบังคับจากพร็อพ)
  const primaryResolved: 'checkin' | 'checkout' =
    primaryAction === 'auto'
      ? (job?.isIn ? 'checkout' : 'checkin')
      : primaryAction;

  const isPrimaryCheckIn = primaryResolved === 'checkin';

  // ทำงานจริง
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

  // ขอทำงาน (อาจต้องยืนยันก่อน)
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
    if (lastTriggerRef.current instanceof HTMLElement) {
      lastTriggerRef.current.focus();
    }
  };

  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  // แสดง/ซ่อนปุ่มตามสิทธิ
  const renderCheckInBtn = canIn || !hideDisabledActions;
  const renderCheckOutBtn = canOut || !hideDisabledActions;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}      // ESC/ฉากหลัง—ปิดได้ถ้าไม่ได้ busy
      variant="temporary"
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': titleId,
        'aria-describedby': descId,
        sx: { width, outline: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* ส่วนหัว */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          id={titleId}
          variant="h6"
          sx={{ flex: 1 }}
          ref={titleRef}
          tabIndex={-1}
        >
          {job ? `ใบงาน #${job.rid}` : 'รายละเอียดงาน'}
        </Typography>
        <IconButton
          ref={closeBtnRef}
          onClick={handleClose}
          aria-label="ปิดหน้าต่างย่อย (Close)"
          edge="end"
          disabled={busy}
        >
          <CloseRoundedIcon />
        </IconButton>
      </Box>
      <Divider />

      {/* เนื้อหา */}
      <Box id={descId} sx={{ p: 2, flex: 1, overflow: 'auto' }}>
        {job && (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle2">ผู้รับเหมา</Typography>
            <Typography variant="body2">{job.contractor ?? '-'}</Typography>

            <Typography variant="subtitle2" sx={{ mt: 1 }}>พื้นที่/ช่วงเวลา</Typography>
            <Typography variant="body2">
              {job.area ?? '-'} • {job.timeRangeText ?? '-'}
            </Typography>
          </Stack>
        )}
        {children}
      </Box>

      {/* แถบปุ่ม */}
      {(renderCheckInBtn || renderCheckOutBtn) && (
        <>
          <Divider />
          <Box
            sx={{
              p: 2,
              position: 'sticky',
              bottom: 0,
              backgroundColor: 'background.paper',
              borderTop: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {/* ปุ่มรอง/หลักตามสถานะ */}
              {renderCheckInBtn && (
                <Button
                  ref={checkInBtnRef}
                  variant={isPrimaryCheckIn ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={(e) => requestAction('checkin', e.currentTarget)}
                  disabled={busy || !canIn}
                >
                  {busy && confirmAction === 'checkin' ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                  เช็คอิน
                </Button>
              )}

              {renderCheckOutBtn && (
                <Button
                  ref={checkOutBtnRef}
                  variant={!isPrimaryCheckIn ? 'contained' : 'outlined'}
                  color={!isPrimaryCheckIn ? 'primary' : 'primary'}
                  onClick={(e) => requestAction('checkout', e.currentTarget)}
                  disabled={busy || !canOut}
                >
                  {busy && confirmAction === 'checkout' ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                  เช็คเอาท์
                </Button>
              )}
            </Stack>
          </Box>
        </>
      )}

      {/* ยืนยันสั้น ๆ */}
      <Dialog
        open={!!confirmAction}
        onClose={busy ? undefined : closeConfirm}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        keepMounted
      >
        <DialogTitle id="confirm-title">{confirmText.title}</DialogTitle>
        <DialogContent>
          <Typography id="confirm-desc" variant="body2">
            {confirmText.body}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm} autoFocus disabled={busy}>
            ยกเลิก
          </Button>
          <Button
            variant="contained"
            color={confirmAction === 'checkout' ? 'error' as any : 'primary'}
            onClick={() => runAction(confirmAction!)}
            disabled={busy}
          >
            {busy ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>

      {/* แจ้งผลสั้น ๆ */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={closeSnack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={closeSnack} severity={snack.kind} variant="filled" sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Drawer>
  );
}
