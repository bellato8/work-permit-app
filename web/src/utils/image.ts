// ไฟล์: web/src/utils/image.ts
// เวลา: 2025-08-22 14:20
// แก้อะไร: คง processIdImage เดิม + เพิ่ม makePreviewAndClean และ type PrepResult ให้ตรงกับ StampedPreview.tsx
// Written by: Work Permit System Tutor

import heic2any from "heic2any";

export type StampOptions = {
  requestId: string;
  requesterName: string;
  company: string;
  createdAt: number;
};

export type PrepResult = {
  /** data URL ที่ใช้ <img src=...> แสดงตัวอย่าง */
  previewUrl: string;
  /** ไฟล์ “สะอาด” ที่ลบ EXIF แล้ว (ส่งกลับไปอัปโหลดได้) */
  cleanedBlob: Blob;
  /** ชื่อไฟล์ที่แนะนำสำหรับ cleanedBlob */
  cleanedFileName: string;
};

async function readAsImage(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  await new Promise((r) => setTimeout(r, 0));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

function drawDiagonalWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  ctx.save();
  ctx.translate(w/2, h/2);
  ctx.rotate(-Math.atan(h/w)); // เอียงพอดีแนวทแยง
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(Math.min(w,h)/9)}px sans-serif`;
  ctx.fillStyle = "rgba(240, 46, 46, 0.16)"; // แดงใส
  for (let y=-h; y<=h; y+=Math.min(w,h)/3) {
    ctx.fillText(text, 0, y);
  }
  ctx.restore();
}

function drawInfoBar(ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[]) {
  const pad = 14;
  ctx.save();
  ctx.font = "14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
  const lineHeight = 18;
  const boxW = Math.max(...lines.map((t)=> ctx.measureText(t).width)) + pad*2;
  const boxH = lineHeight*lines.length + pad*2;
  const x = w - boxW - 16;
  const y = h - boxH - 16;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(x+0.5, y+0.5, boxW-1, boxH-1);

  ctx.fillStyle = "white";
  lines.forEach((t, i)=> ctx.fillText(t, x+pad, y+pad + lineHeight*(i+0.8)));
  ctx.restore();
}

/** แปลง HEIC -> JPEG, resize ฝั่ง client, ลบ EXIF, ประทับตรา */
export async function processIdImage(file: File, maxDim=1920, quality=0.85, stamp?: StampOptions) {
  const isHeic = /\.heic$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif";
  let source: Blob = file;
  if (isHeic) {
    source = (await heic2any({ blob: file, toType: "image/jpeg", quality })) as Blob;
  }

  // วาดบนแคนวาสเพื่อลบ EXIF + resize
  const img = await readAsImage(source as File);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  // ผลลัพธ์ภาพ "clean" (ไม่มี EXIF)
  const cleanBlob: Blob = await new Promise((res) => canvas.toBlob((b)=> res(b!), "image/jpeg", quality));

  // ถ้ามีสั่งประทับตรา
  let stampedBlob: Blob | undefined;
  if (stamp) {
    drawDiagonalWatermark(ctx, w, h, `สำหรับขออนุญาตเข้าทำงาน – ${stamp.requestId}`);
    const created = new Date(stamp.createdAt);
    const lines = [
      `บริษัท: ${stamp.company}`,
      `ผู้ยื่น: ${stamp.requesterName}`,
      `RequestId: ${stamp.requestId}`,
      `วันที่ยื่น: ${created.toLocaleString("th-TH")}`
    ];
    drawInfoBar(ctx, w, h, lines);
    stampedBlob = await new Promise((res) => canvas.toBlob((b)=> res(b!), "image/jpeg", quality));
  }

  // preview dataURL (ถ้าต้องการแสดง)
  const cleanUrl = URL.createObjectURL(cleanBlob);
  const stampedUrl = stampedBlob ? URL.createObjectURL(stampedBlob) : undefined;

  return { cleanBlob, stampedBlob, cleanUrl, stampedUrl };
}

/** ฟังก์ชันที่ StampedPreview เรียก: คืนพรีวิว + ไฟล์สะอาด */
export async function makePreviewAndClean(file: File, requestId?: string, requesterName?: string): Promise<PrepResult> {
  const { cleanBlob, stampedBlob, cleanUrl, stampedUrl } = await processIdImage(
    file, 1280, 0.85,
    requestId ? { requestId, requesterName: requesterName || "", company: "", createdAt: Date.now() } : undefined
  );

  const previewUrl = stampedUrl ?? cleanUrl;

  // ตั้งชื่อไฟล์สะอาดให้สื่อความหมาย
  const base = (file.name || "idcard").replace(/\.[^.]+$/,"");
  const cleanedFileName = `${base}-cleaned.jpg`;

  return { previewUrl, cleanedBlob: cleanBlob, cleanedFileName };
}
