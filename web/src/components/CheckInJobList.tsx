// ======================================================================
// File: web/src/components/CheckInJobList.tsx
// เวอร์ชัน: 2025-10-23 00:35 Asia/Bangkok
// ย้ำ: Props รองรับ onCheckIn/onCheckOut และพร็อพที่เกี่ยวข้อง (แก้ TS2322)
// ======================================================================

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import JobCard from './JobCard';
import { JobQuickViewProvider } from './JobQuickViewProvider';
import { JobSummary } from './JobQuickViewDrawer';

type Props = {
  jobs: JobSummary[];
  emptyText?: string;
  minCardWidth?: number;
  gap?: number;

  // พร็อพปุ่ม/พฤติกรรม ส่งลง Provider -> Drawer
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

export default function CheckInJobList({
  jobs,
  emptyText = '— ไม่มีงานในช่วงนี้ —',
  minCardWidth = 280,
  gap = 2,
  onCheckIn,
  onCheckOut,
  confirmCheckIn,
  confirmCheckOut,
  autoCloseOnSuccess,
  successMessageCheckIn,
  successMessageCheckOut,
  disableCheckIn,
  disableCheckOut,
  primaryAction,
  hideDisabledActions,
}: Props) {
  return (
    <JobQuickViewProvider
      onCheckIn={onCheckIn}
      onCheckOut={onCheckOut}
      confirmCheckIn={confirmCheckIn}
      confirmCheckOut={confirmCheckOut}
      autoCloseOnSuccess={autoCloseOnSuccess}
      successMessageCheckIn={successMessageCheckIn}
      successMessageCheckOut={successMessageCheckOut}
      disableCheckIn={disableCheckIn}
      disableCheckOut={disableCheckOut}
      primaryAction={primaryAction}
      hideDisabledActions={hideDisabledActions}
    >
      {jobs.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">{emptyText}</Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`,
            gap,
          }}
        >
          {jobs.map((j) => (
            <JobCard key={j.rid} job={j} />
          ))}
        </Box>
      )}
    </JobQuickViewProvider>
  );
}
