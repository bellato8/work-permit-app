import React from "react";
import { useFormContext } from "react-hook-form";

type Props = {
  fileInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
};

export default function WorkerList({ fileInputRefs }: Props) {
  const { register, watch, setValue } = useFormContext<any>();
  const workers = watch("workers") as { name: string; citizenId: string; isSupervisor?: boolean }[];

  const addRow = () => {
    const next = [...workers, { name: "", citizenId: "", isSupervisor: false }];
    setValue("workers", next, { shouldDirty: true });
  };

  const removeLast = () => {
    if (workers.length <= 1) return;
    const next = workers.slice(0, -1);
    setValue("workers", next, { shouldDirty: true });
    fileInputRefs.current = fileInputRefs.current.slice(0, next.length);
  };

  return (
    <div className="space-y-3">
      <div className="label">รายชื่อผู้ร่วมงาน (รวมผู้ควบคุมงาน)</div>

      {workers.map((w, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-3 bg-white/70">
          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <label className="label">ชื่อ-นามสกุล</label>
              <input
                className="input"
                {...register(`workers.${i}.name` as const)}
                placeholder="ชื่อ นามสกุล"
              />
            </div>

            <div>
              <label className="label">เลขเอกสารยืนยันตัวตน</label>
              <input
                className="input"
                {...register(`workers.${i}.citizenId` as const)}
                placeholder="เลขบัตร/Passport (ใส่ได้ทั้งตัวเลขและตัวอักษร)"
              />
            </div>

            <label className="flex items-center gap-2 text-sm mb-1 md:mb-2">
              <input type="checkbox" {...register(`workers.${i}.isSupervisor` as const)} />
              ผู้ควบคุม
            </label>
          </div>

          <div className="mt-3">
            <label className="label">แนบรูปบัตรประชาชน (ผู้ร่วมงานคนที่ {i + 1})</label>
            <input
              type="file"
              accept="image/*,.heic"
              className="input"
              ref={(el) => (fileInputRefs.current[i] = el)}
            />
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <button type="button" className="btn" onClick={addRow}>+ เพิ่มแถว</button>
        <button type="button" className="btn" onClick={removeLast}>ลบแถวสุดท้าย</button>
      </div>
    </div>
  );
}
