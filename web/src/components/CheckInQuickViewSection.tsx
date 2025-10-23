// ======================================================================
// File: web/src/components/CheckInQuickViewSection.tsx
// เวอร์ชัน: 2025-10-23 00:35 Asia/Bangkok
// แก้: import API เป็นเส้นทางสัมพัทธ์ (แก้ TS2307)
// ======================================================================

import React from 'react';
import CheckInJobList from './CheckInJobList';
import { JobSummary } from './JobQuickViewDrawer';
import { apiCheckIn, apiCheckOut } from '../api/attendance'; // << เปลี่ยนตรงนี้

// รูปแบบจากหน้าจริง (ปรับให้เข้ากับข้อมูลของคุณ)
export type SourceJob = {
  rid: string;
  title?: string;
  contractorName?: string;
  areaName?: string;
  scheduleStart?: string | number | Date | null;
  scheduleEnd?: string | number | Date | null;

  status?: 'scheduled' | 'in' | 'out';
  canCheckIn?: boolean;
  canCheckOut?: boolean;
};

type Props = {
  jobs: SourceJob[];
  emptyText?: string;
  minCardWidth?: number;
  gap?: number;

  isInForJob?: (j: SourceJob) => boolean;
  canCheckInForJob?: (j: SourceJob) => boolean;
  canCheckOutForJob?: (j: SourceJob) => boolean;

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

  timeText?: (start?: Date | null, end?: Date | null) => string;
};

function toDate(v: string | number | Date | null | undefined): Date | undefined {
  if (v == null) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

function defaultTimeText(start?: Date | null, end?: Date | null) {
  const fmt = new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok',
  });
  if (start && end) return `${fmt.format(start)}–${fmt.format(end)}`;
  if (start) return fmt.format(start);
  return '-';
}

export default function CheckInQuickViewSection({
  jobs,
  emptyText,
  minCardWidth,
  gap,
  isInForJob = (j) => j.status === 'in',
  canCheckInForJob = (j) => j.canCheckIn ?? true,
  canCheckOutForJob = (j) => j.canCheckOut ?? true,
  onCheckIn,
  onCheckOut,
  confirmCheckIn,
  confirmCheckOut,
  autoCloseOnSuccess = true,
  successMessageCheckIn = 'เช็คอินสำเร็จ',
  successMessageCheckOut = 'เช็คเอาท์สำเร็จ',
  disableCheckIn,
  disableCheckOut,
  primaryAction = 'auto',
  hideDisabledActions = false,
  timeText = defaultTimeText,
}: Props) {
  const mapped: JobSummary[] = jobs.map((j) => {
    const s = toDate(j.scheduleStart);
    const e = toDate(j.scheduleEnd);
    return {
      rid: j.rid,
      title: j.title,
      contractor: j.contractorName,
      area: j.areaName,
      timeRangeText: timeText(s ?? null, e ?? null),
      isIn: isInForJob(j),
      canCheckIn: canCheckInForJob(j),
      canCheckOut: canCheckOutForJob(j),
    };
  });

  // ต่อ API ตัวอย่าง (override ได้ผ่านพร็อพ)
  const handleCheckIn = onCheckIn ?? (async (job: JobSummary) => {
    await apiCheckIn(job.rid);
  });
  const handleCheckOut = onCheckOut ?? (async (job: JobSummary) => {
    await apiCheckOut(job.rid);
  });

  return (
    <CheckInJobList
      jobs={mapped}
      emptyText={emptyText}
      minCardWidth={minCardWidth}
      gap={gap}
      onCheckIn={handleCheckIn}
      onCheckOut={handleCheckOut}
      confirmCheckIn={confirmCheckIn}
      confirmCheckOut={confirmCheckOut}
      autoCloseOnSuccess={autoCloseOnSuccess}
      successMessageCheckIn={successMessageCheckIn}
      successMessageCheckOut={successMessageCheckOut}
      disableCheckIn={disableCheckIn}
      disableCheckOut={disableCheckOut}
      primaryAction={primaryAction}
      hideDisabledActions={hideDisabledActions}
    />
  );
}
