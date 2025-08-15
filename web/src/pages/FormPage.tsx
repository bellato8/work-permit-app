import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import heic2any from 'heic2any';
import { ref, uploadBytes } from 'firebase/storage';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { generateRequestId } from '../util/requestId';
import { useI18n } from '../i18n';
import { format } from 'date-fns';

const workerSchema = z.object({
  fullName: z.string(),
  workerCardNo: z.string(),
});

const formSchema = z.object({
  companyName: z.string(),
  requesterName: z.string(),
  contactPhone: z.string(),
  workArea: z.string(),
  floor: z.string(),
  workDateStart: z.string(),
  workDateEnd: z.string(),
  timeStart: z.string(),
  timeEnd: z.string(),
  hotWork: z.boolean().optional(),
  teamMembers: z.array(workerSchema),
  equipment: z.array(z.string()).max(6),
  photos: z.any(),
});

type FormValues = z.infer<typeof formSchema>;

async function processPhoto(
  file: File,
  requestId: string,
  requester: string,
  area: string
) {
  let blob: Blob = file;
  if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
    blob = (await heic2any({ blob: file, toType: 'image/jpeg' })) as Blob;
  }
  const img = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const text = `ใช้สำหรับขออนุญาตเข้าทำงาน – ${requestId}`;
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-45 * Math.PI) / 180);
  ctx.fillStyle = '#D80000';
  ctx.font = '48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 0, 0);
  ctx.restore();
  ctx.fillStyle = '#D80000';
  ctx.globalAlpha = 1;
  ctx.font = '24px sans-serif';
  const dateStr = format(new Date(), 'yyyy-MM-dd HH:mm');
  const info = `${dateStr}\n${requester}\n${area}`;
  const lines = info.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width - 10, canvas.height - 10 - i * 26);
  });
  const stampedBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg')
  );
  return { original: blob, stamped: stampedBlob };
}

export default function FormPage() {
  const { t } = useI18n();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { teamMembers: [{ fullName: '', workerCardNo: '' }], equipment: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'teamMembers' });
  const { fields: equipFields, append: appendEquip, remove: removeEquip } = useFieldArray({ control, name: 'equipment' });

  const onSubmit = async (values: FormValues) => {
    const requestId = await generateRequestId();
    const originals: string[] = [];
    const stamped: string[] = [];
    const files: FileList = values.photos as FileList;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { original, stamped: stampedBlob } = await processPhoto(
        file,
        requestId,
        values.requesterName,
        values.workArea
      );
      const origRef = ref(storage, `contractor-requests/${requestId}/original/${file.name}`);
      const stampedRef = ref(storage, `contractor-requests/${requestId}/stamped/${file.name}`);
      await uploadBytes(origRef, original);
      await uploadBytes(stampedRef, stampedBlob);
      originals.push(origRef.fullPath);
      stamped.push(stampedRef.fullPath);
    }
    const requestData = {
      requestId,
      createdAt: serverTimestamp(),
      companyName: values.companyName,
      requesterName: values.requesterName,
      contactPhone: values.contactPhone,
      workArea: values.workArea,
      floor: values.floor,
      workDateStart: values.workDateStart,
      workDateEnd: values.workDateEnd,
      timeStart: values.timeStart,
      timeEnd: values.timeEnd,
      hotWork: values.hotWork ?? false,
      teamCount: values.teamMembers.length,
      photoOriginalPaths: originals,
      photoStampedPaths: stamped,
      status: 'Pending',
    };
    await setDoc(doc(db, 'requests', requestId), requestData);
    for (let i = 0; i < values.teamMembers.length; i++) {
      await setDoc(
        doc(collection(db, 'requests', requestId, 'workers'), String(i + 1)),
        values.teamMembers[i]
      );
    }
    alert(`Submitted ${requestId}`);
  };

  return (
    <form className="p-4 space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <h1 className="text-xl font-bold">{t.form.title}</h1>
      <div>
        <label>{t.form.companyName}</label>
        <input className="border" {...register('companyName')} />
      </div>
      <div>
        <label>{t.form.requesterName}</label>
        <input className="border" {...register('requesterName')} />
      </div>
      <div>
        <label>{t.form.contactPhone}</label>
        <input className="border" {...register('contactPhone')} />
      </div>
      <div>
        <label>{t.form.workArea}</label>
        <input className="border" {...register('workArea')} />
      </div>
      <div>
        <label>{t.form.floor}</label>
        <input className="border" {...register('floor')} />
      </div>
      <div>
        <label>{t.form.dateRange}</label>
        <input type="date" {...register('workDateStart')} />
        <input type="date" {...register('workDateEnd')} />
      </div>
      <div>
        <label>{t.form.timeRange}</label>
        <input type="time" {...register('timeStart')} />
        <input type="time" {...register('timeEnd')} />
      </div>
      <div>
        <label>{t.form.hotWork}</label>
        <input type="checkbox" {...register('hotWork')} />
      </div>
      <div>
        <label>{t.form.teamMembers}</label>
        {fields.map((field, index) => (
          <div key={field.id} className="flex space-x-2">
            <input className="border" placeholder="Name" {...register(`teamMembers.${index}.fullName` as const)} />
            <input className="border" placeholder="Card No" {...register(`teamMembers.${index}.workerCardNo` as const)} />
            <button type="button" onClick={() => remove(index)}>{t.form.remove}</button>
          </div>
        ))}
        <button type="button" onClick={() => append({ fullName: '', workerCardNo: '' })}>
          {t.form.addMember}
        </button>
      </div>
      <div>
        <label>{t.form.equipment}</label>
        {equipFields.map((field, index) => (
          <div key={field.id} className="flex space-x-2">
            <input className="border" {...register(`equipment.${index}` as const)} />
            <button type="button" onClick={() => removeEquip(index)}>{t.form.remove}</button>
          </div>
        ))}
        {equipFields.length < 6 && (
          <button type="button" onClick={() => appendEquip('')}>
            +
          </button>
        )}
      </div>
      <div>
        <label>{t.form.photos}</label>
        <input type="file" multiple accept="image/*" {...register('photos')} />
      </div>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2">
        {t.form.submit}
      </button>
    </form>
  );
}
