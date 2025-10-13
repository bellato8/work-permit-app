// ─────────────────────────────────────────────────────────────────────────────
// ไฟล์: web/src/pages/RequestFormPage.tsx
// ผู้เขียน (Written by): GPT-5 Thinking
// อัปเดตล่าสุด (Last modified): 2025-08-21 (Asia/Bangkok)
// แก้อะไร:
// 1) เปลี่ยน ensureAuth -> authReady (รอ Anonymous login ให้ได้สิทธิ์ก่อนเขียน Firestore/Storage)
// 2) ปรับลอจิกให้ "เขียน Firestore แค่ครั้งเดียว (create)" และใส่ images path ตั้งแต่รอบแรก
//    เพื่อตรง Firestore Rules ที่อนุญาตเฉพาะ create (ไม่มี update/merge)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import GlassCard from "../components/GlassCard";
import { FormProvider, useForm } from "react-hook-form";
import WorkerList from "../components/WorkerList";
import { onlyDigits, validateThaiCitizenId, last4 } from "../utils/validation";
import { processIdImage } from "../utils/image";
import { makeRequestId } from "../utils/requestId";
import type { RequestRecord } from "../types";
import dayjs from "dayjs";
import QRCode from "qrcode";

// ⬇️ ใช้ authReady, db, storage จากศูนย์กลาง Firebase (ล็อกอินนิรนามอัตโนมัติ)
import { db, storage, authReady } from "../lib/firebase";

import { collection, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { loadThaiLocations, listProvinces, listDistricts, listSubdistricts } from "../lib/locations";

/** ───────────────────────────────────────────────────────────────────────────
 * ชั้น: เก็บค่าแบบคงที่ (B1/F1..F8) แล้วค่อยแสดง label ไทย+อังกฤษบน UI
 * ─────────────────────────────────────────────────────────────────────────── */
type FloorCode = 'B1' | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8';

const FLOOR_LABEL: Record<FloorCode, string> = {
  B1: 'ชั้นใต้ดิน (Basement)',
  F1: 'ชั้น 1 (Floor 1)',
  F2: 'ชั้น 2 (Floor 2)',
  F3: 'ชั้น 3 (Floor 3)',
  F4: 'ชั้น 4 (Floor 4)',
  F5: 'ชั้น 5 (Floor 5)',
  F6: 'ชั้น 6 (Floor 6)',
  F7: 'ชั้น 7 (Floor 7)',
  F8: 'ชั้น 8 (Floor 8)',
};

const FLOOR_OPTIONS = (Object.keys(FLOOR_LABEL) as FloorCode[]).map(v => ({
  value: v,
  label: FLOOR_LABEL[v],
}));

type FormShape = {
  title: string;
  fullname: string;
  citizenId: string;
  addrDetail?: string;
  addr: { province: string; district: string; subdistrict: string };
  company: string;
  phone: string;
  email?: string;

  area: string;
  floor: FloorCode;              // ← ใช้โค้ดชั้นมาตรฐาน
  type: string;
  from: string;
  to: string;

  building: {
    electric: boolean; plumbing: boolean; lighting: boolean; hvac: boolean; water: boolean; gas: boolean;
    amp?: string;
  };

  hotWork: "มี"|"ไม่มี";
  equipments: { has: "มี"|"ไม่มี"; details?: string; };

  workers: { name: string; citizenId: string; isSupervisor?: boolean }[];
  _hp?: string;
};

export default function RequestFormPage() {
  const createdAt = Date.now();
  const requestId = useMemo(() => makeRequestId(), []);

  const methods = useForm<FormShape>({
    defaultValues: {
      title: "นาย",
      fullname: "",
      citizenId: "",
      addrDetail: "",
      addr: { province: "", district: "", subdistrict: "" },
      company: "",
      phone: "",
      email: "",
      area: "",
      floor: "F1",                // ← ค่าเริ่มต้น: ชั้น 1 (เก็บเป็น F1)
      type: "",
      from: "",
      to: "",
      building: { electric: false, plumbing: false, lighting: false, hvac: false, water: false, gas: false, amp: "" },
      hotWork: "ไม่มี",
      equipments: { has: "ไม่มี" },
      workers: [{ name: "", citizenId: "", isSupervisor: true }]
    }
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = methods;

  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewBusy, setPreviewBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>();
  const [submitted, setSubmitted] = useState<null | { requestId: string }>(null);
  const [isSending, setIsSending] = useState(false);

  const requesterImgRef = useRef<HTMLInputElement>(null);
  const workerFileInputs = useRef<(HTMLInputElement | null)[]>([]);

  // จังหวัด/อำเภอ/ตำบล
  const [locMap, setLocMap] = useState<any>(null);
  const [provList, setProvList] = useState<string[]>([]);
  const [distList, setDistList] = useState<string[]>([]);
  const [subdList, setSubdList] = useState<string[]>([]);
  useEffect(() => {
    loadThaiLocations().then((m) => { setLocMap(m); setProvList(listProvinces(m)); });
  }, []);
  const addr = watch("addr");
  useEffect(() => {
    if (!locMap) return;
    setDistList(listDistricts(locMap, addr.province));
    setValue("addr.district", ""); setSubdList([]); setValue("addr.subdistrict", "");
  }, [addr.province, locMap, setValue]);
  useEffect(() => {
    if (!locMap) return;
    setSubdList(listSubdistricts(locMap, addr.province, addr.district));
    setValue("addr.subdistrict", "");
  }, [addr.district, locMap, setValue]);

  const hp = watch("_hp");
  const building = watch("building");
  const equipHas = watch("equipments.has");
  const from = watch("from"); const to = watch("to");

  // ─────────────────────────────
  // ตัวอย่างตราประทับอัตโนมัติเมื่อเลือกไฟล์
  // ─────────────────────────────
  async function handleRequesterFileChange(file?: File | null) {
    if (!file) { setPreviewUrl(undefined); return; }
    try {
      setPreviewBusy(true);
      const { stampedUrl } = await processIdImage(file, 1280, 0.85, {
        requestId,
        requesterName: methods.getValues("fullname") || "",
        company: methods.getValues("company") || "",
        createdAt
      });
      setPreviewUrl(stampedUrl);
    } catch (e) {
      console.error("preview error", e);
      setPreviewUrl(undefined);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function onSubmit(data: FormShape) {
    if (hp || isSending) return;
    setIsSending(true);
    try {
      // ⬇️ รอ Anonymous login ให้พร้อมก่อน (แก้ permission-denied)
      await authReady;

      // ตรวจพื้นฐาน
      if (!validateThaiCitizenId(data.citizenId)) { alert("เลขบัตรประชาชนผู้ขอไม่ถูกต้อง"); setIsSending(false); return; }
      if (onlyDigits(data.phone).length < 9) { alert("เบอร์โทรไม่ถูกต้อง"); setIsSending(false); return; }
      if (!data.addr.province || !data.addr.district || !data.addr.subdistrict) {
        alert("กรุณาเลือกจังหวัด/อำเภอ/ตำบลให้ครบ"); setIsSending(false); return;
      }
      if (from && to && dayjs(to).isBefore(dayjs(from))) {
        alert("เวลาถึงต้องไม่น้อยกว่าตั้งแต่"); setIsSending(false); return;
      }
      const reqFile = requesterImgRef.current?.files?.[0];
      if (!reqFile) { alert("กรุณาแนบรูปบัตรประชาชนของผู้ยื่นคำขอ"); setIsSending(false); return; }

      // เตรียมรายการไฟล์ของผู้ร่วมงาน (รู้ล่วงหน้าว่ามีไฟล์หรือไม่)
      const workerFiles: (File | null)[] = methods.getValues("workers").map((_, i) => workerFileInputs.current[i]?.files?.[0] ?? null);

      // คำนวณ path เก็บรูปตั้งแต่ตอนนี้ (เพื่อเขียน Firestore แค่ครั้งเดียว)
      const cleanPath = `requests/${requestId}/idcard_clean.jpg`;
      const stampedPath = `requests/${requestId}/idcard_stamped.jpg`;
      const workerPaths = workerFiles.map((wf, i) => ({
        // ใส่ path ล่วงหน้า; ถ้าไฟล์ไม่มี เราจะยังอัปโหลด แต่ path ไม่เป็นอันตราย
        cleanPath: `requests/${requestId}/workers/${i}-clean.jpg`,
        stampedPath: `requests/${requestId}/workers/${i}-stamped.jpg`,
        hasFile: !!wf,
      }));

      // ประมวลผลรูปผู้ยื่น (ไฟล์จริงคุณภาพ 1920px + ลบ EXIF)
      const { cleanBlob, stampedBlob } = await processIdImage(reqFile, 1920, 0.85, {
        requestId, requesterName: data.fullname, company: data.company, createdAt
      });

      // เตรียม object ที่ “ไม่มี undefined”
      const requester: any = {
        title: data.title,
        fullname: data.fullname,
        citizenId: onlyDigits(data.citizenId),
        company: data.company,
        phone: onlyDigits(data.phone)
      };
      if (data.email && data.email.trim() !== "") requester.email = data.email.trim();

      const buildingSystems: any = {
        electric: !!data.building.electric,
        plumbing: !!data.building.plumbing,
        lighting: !!data.building.lighting,
        hvac: !!data.building.hvac,
        water: !!data.building.water,
        gas: !!data.building.gas
      };
      if (data.building.amp && data.building.amp.trim() !== "") {
        buildingSystems.amp = data.building.amp.trim();
      }

      // ✅ ใส่ images path ตั้งแต่สร้างเอกสารครั้งแรก (ไม่มี update รอบสอง)
      const rec: RequestRecord = {
        requestId,
        createdAt,
        requester,
        work: {
          area: data.area,
          floor: data.floor, // ← เก็บเป็น B1/F1..F8 สะอาดและคงที่
          type: data.type,
          from: data.from,
          to: data.to,
          location: { ...data.addr, detail: data.addrDetail || "" },
          buildingSystems,
          hotWork: data.hotWork,
          equipments: {
            has: data.equipments.has === "มี",
            ...(data.equipments.details ? { details: data.equipments.details } : {})
          }
        },
        workers: data.workers.map(w => ({
          name: w.name,
          citizenId: (w.citizenId || "").trim(),
          isSupervisor: !!w.isSupervisor
        })),
        images: {
          idCardCleanPath: cleanPath,
          ...(stampedBlob ? { idCardStampedPath: stampedPath } : {}),
          workers: workerPaths.map(wp => (wp.hasFile ? { cleanPath: wp.cleanPath, stampedPath: wp.stampedPath } : {})),
        },
        status: "รออนุมัติ",
        phoneLast4: last4(data.phone),
        audit: { createdUa: navigator.userAgent }
      };

      // 🔐 เขียน Firestore "ครั้งเดียว" (create)
      const docRef = doc(collection(db, "requests"), requestId);
      await setDoc(docRef, rec);

      // ⬆️ อัปโหลดรูปตาม path ที่กำหนดไว้แล้ว
      await uploadBytes(ref(storage, cleanPath), cleanBlob, { contentType: "image/jpeg", cacheControl: "private, max-age=0" });
      if (stampedBlob) {
        await uploadBytes(ref(storage, stampedPath), stampedBlob, { contentType: "image/jpeg", cacheControl: "private, max-age=0" });
      }

      for (let i = 0; i < workerFiles.length; i++) {
        const wf = workerFiles[i];
        if (!wf) continue;
        const { cleanBlob: wClean, stampedBlob: wStamped } = await processIdImage(
          wf, 1920, 0.85, { requestId, requesterName: data.workers[i].name, company: data.company, createdAt }
        );
        await uploadBytes(ref(storage, workerPaths[i].cleanPath), wClean, { contentType: "image/jpeg", cacheControl: "private, max-age=0" });
        if (wStamped) {
          await uploadBytes(ref(storage, workerPaths[i].stampedPath), wStamped, { contentType: "image/jpeg", cacheControl: "private, max-age=0" });
        }
      }

      // สร้าง QR ไปหน้าสถานะ
      const statusUrl = `${import.meta.env.VITE_APP_BASE_URL || location.origin}/status?rid=${encodeURIComponent(requestId)}`;
      const qrDataUrl = await QRCode.toDataURL(statusUrl, { margin: 1, scale: 6 });
      setQrUrl(qrDataUrl);
      setSubmitted({ requestId });
    } catch (e: any) {
      console.error(e);
      alert(`ส่งคำขอล้มเหลว: ${e?.code || e?.message || String(e)}`);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <FormProvider {...methods}>
      <GlassCard title="แบบฟอร์มขออนุมัติเข้าทำงาน" subtitle="กรอกข้อมูลให้ครบถ้วนและแนบรูปบัตรประชาชน">
        {!submitted ? (
          <form className="grid gap-6" onSubmit={handleSubmit(onSubmit)}>
            <input className="hidden" tabIndex={-1} autoComplete="off" {...register("_hp")} />

            {/* ---------------- ผู้ขออนุมัติ (อยู่บน) ---------------- */}
            <div className="rounded-2xl border border-slate-200 p-4 bg-white/80 space-y-3">
              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <label className="label">คำนำหน้า</label>
                  <select className="select" {...register("title")}>
                    <option>นาย</option><option>นาง</option><option>นางสาว</option><option>อื่นๆ</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="label">ชื่อ-นามสกุล</label>
                  <input className="input" {...register("fullname", { required: true })} placeholder="สมชาย ใจดี" />
                </div>

                <div className="md:col-span-2">
                  <label className="label">เลขบัตรประชาชน (13 หลัก)</label>
                  <input
                    className="input"
                    {...register("citizenId", { required: true })}
                    onChange={(e)=> setValue("citizenId", onlyDigits(e.target.value))}
                    maxLength={13} inputMode="numeric" placeholder="1234567890123"
                  />
                  {errors.citizenId && <p className="text-xs text-red-600 mt-1">กรุณาระบุเลขบัตรประชาชนให้ถูกต้อง</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="label">บริษัท</label>
                  <input className="input" {...register("company", { required: true })} placeholder="ABC Engineering Co., Ltd." />
                </div>
              </div>

              {/* ที่อยู่ */}
              <div className="grid gap-3">
                <div>
                  <label className="label">ที่อยู่ (บ้านเลขที่/ซอย/ถนน) – ไม่บังคับ</label>
                  <input className="input" {...register("addrDetail")} placeholder="บ้านเลขที่ 99 ซอย 9 ถนนสายสวย" />
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">จังหวัด</label>
                    <select className="select" {...register("addr.province")} onChange={(e)=> setValue("addr.province", e.target.value)}>
                      <option value="">-- เลือกจังหวัด --</option>
                      {provList.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">อำเภอ</label>
                    <select className="select" {...register("addr.district")} onChange={(e)=> setValue("addr.district", e.target.value)} disabled={!distList.length}>
                      <option value="">{distList.length ? "-- เลือกอำเภอ --" : "(เลือกจังหวัดก่อน)"}</option>
                      {distList.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">ตำบล</label>
                    <select className="select" {...register("addr.subdistrict")} onChange={(e)=> setValue("addr.subdistrict", e.target.value)} disabled={!subdList.length}>
                      <option value="">{subdList.length ? "-- เลือกตำบล --" : "(เลือกอำเภอก่อน)"}</option>
                      {subdList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ติดต่อ */}
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="label">เบอร์โทรศัพท์</label>
                  <input className="input" {...register("phone", { required: true })} onChange={(e)=> setValue("phone", onlyDigits(e.target.value))} inputMode="numeric" placeholder="0812345678" />
                </div>
                <div>
                  <label className="label">อีเมล (ไม่บังคับ)</label>
                  <input className="input" type="email" {...register("email")} placeholder="name@example.com" />
                  <p className="text-xs text-slate-500 mt-1">หากกรอกจะได้รับอีเมลแจ้งผล</p>
                </div>
              </div>
            </div>

            {/* ---------------- สถานที่ที่จะทำงาน (อยู่ล่าง) ---------------- */}
            <div className="rounded-2xl border border-slate-200 p-4 bg-white/80 space-y-3">
              <div className="grid md:grid-cols-[2fr_1fr_2fr] gap-3">
                <div>
                  <label className="label">พื้นที่ประสงค์เข้าทำงาน/บริเวณ</label>
                  <input className="input" {...register("area", { required: true })} placeholder="โถงลิฟต์โซน A" />
                </div>
                <div>
                  <label className="label">ชั้น</label>
                  <select className="select" {...register("floor")}>
                    {FLOOR_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ประเภทงาน</label>
                  <input className="input" {...register("type", { required: true })} placeholder="เดินสายไฟ / ติดตั้งแอร์ ฯลฯ" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="label">ตั้งแต่ (วันที่-เวลา)</label>
                  <input className="input" type="datetime-local" {...register("from", { required: true })} />
                </div>
                <div>
                  <label className="label">ถึง (วันที่-เวลา)</label>
                  <input className="input" type="datetime-local" {...register("to", { required: true })} min={from || undefined} />
                </div>
              </div>
            </div>

            {/* ระบบอาคาร/เงื่อนไข */}
            <div className="rounded-2xl border border-slate-200 p-4 bg-white/80 space-y-3">
              <div className="label">งานที่เกี่ยวข้องกับระบบอาคาร</div>
              <div className="grid md:grid-cols-6 gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" {...register("building.electric")} />ไฟฟ้า</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...register("building.plumbing")} />ประปา</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...register("building.lighting")} />แสงสว่าง</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...register("building.hvac")} />แอร์</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...register("building.water")} />น้ำ</label>
                <label className="flex items-center gap-2"><input type="checkbox" {...register("building.gas")} />แก๊ส</label>
              </div>
              {building?.electric && (
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">ขนาดแอมป์ไฟฟ้า (ถ้ามี)</label>
                    <input className="input" {...register("building.amp")} placeholder="เช่น 16A, 32A" />
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="label">งานที่เกิดความร้อน (HOT WORK)</label>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" value="ไม่มี" {...register("hotWork")} defaultChecked />ไม่มี</label>
                    <label className="flex items-center gap-2"><input type="radio" value="มี" {...register("hotWork")} />มี</label>
                  </div>
                </div>
                <div>
                  <label className="label">อุปกรณ์นำเข้า-ออก</label>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" value="ไม่มี" {...register("equipments.has")} defaultChecked />ไม่มี</label>
                    <label className="flex items-center gap-2"><input type="radio" value="มี" {...register("equipments.has")} />มี</label>
                  </div>
                  {equipHas === "มี" && (
                    <div className="mt-2">
                      <label className="label">รายการอุปกรณ์ (คั่นด้วยบรรทัด)</label>
                      <textarea className="textarea" {...register("equipments.details")} placeholder="สว่าน, บันได, สายไฟ 3 ม้วน"></textarea>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ผู้ร่วมงาน + แนบรูปผู้ยื่น */}
            <WorkerList fileInputRefs={workerFileInputs} />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">แนบรูปบัตรประชาชน (ผู้ยื่นคำขอ)</label>
                <input
                  className="input"
                  type="file"
                  accept="image/*,.heic"
                  ref={requesterImgRef}
                  onChange={(e)=> handleRequesterFileChange(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-slate-500 mt-2">
                  ระบบจะปรับขนาดไม่เกิน 1920px, แปลง HEIC → JPEG, ลบ EXIF และประทับตราก่อนส่งอัตโนมัติ
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl min-h-[220px] flex items-center justify-center bg-white">
                {previewBusy
                  ? <span className="text-slate-500 text-sm">กำลังสร้างตัวอย่าง…</span>
                  : previewUrl
                    ? <img src={previewUrl} className="max-h-[300px] rounded-lg" />
                    : <span className="text-slate-500 text-sm">เลือกไฟล์เพื่อดูตัวอย่างตราประทับ</span>}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="submit" className="btn btn-primary" disabled={isSending}>
                {isSending ? "กำลังส่ง..." : "ส่งคำขอ"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">ส่งคำขอเรียบร้อย</h3>
              <p className="text-slate-700">
                รหัสคำขอ (RequestId): <span className="font-mono px-2 py-1 bg-slate-100 rounded">{submitted.requestId}</span>
              </p>
              <a className="btn" href={`/status?rid=${encodeURIComponent(submitted.requestId)}`}>ไปหน้าตรวจสอบสถานะ</a>
            </div>
            <div className="flex items-center justify-center">
              {qrUrl ? <img src={qrUrl} alt="QR to status" className="bg-white p-3 rounded-xl border border-slate-200" /> : null}
            </div>
          </div>
        )}
      </GlassCard>
    </FormProvider>
  );
}
