// ============================================================
// ไฟล์: web/src/components/ImageViewer.tsx
// หน้าที่: แสดงรูปภาพ ID Card + รูปอื่นๆ (รองรับทั้ง URL ที่เซ็นแล้ว และ path)
// จุดเน้น:
//  - ถ้ามี URL ที่เซ็นมาแล้ว (…Url) จะใช้ก่อน → โหลดไว ไม่ต้องขอใหม่
//  - ถ้าไม่มี URL ค่อย fallback ไปขอจาก path
//  - คงเลย์เอาต์เดิม, คง loading="eager" เหมือนเดิม
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { storage, ensureSignedIn } from "../lib/firebase";

// ------- ชนิดข้อมูล -------
interface ImageData {
  label: string;
  path?: string;
  url?: string;
}

export interface ImageViewerProps {
  images?: ImageData[];
  // เดิมมีแค่ path
  idCardCleanPath?: string;
  idCardStampedPath?: string;
  // ➕ ใหม่: รองรับ URL ที่เซ็นแล้ว
  idCardCleanUrl?: string;
  idCardStampedUrl?: string;

  className?: string;
}

interface ResolvedImage {
  label: string;
  url: string;
  isLoaded: boolean;
  hasError: boolean;
}

// ---- in-memory cache กันเรียก URL ซ้ำ ๆ ----
const urlCache = new Map<string, string>();

async function pathToUrl(path: string): Promise<string | null> {
  if (urlCache.has(path)) return urlCache.get(path)!;
  try {
    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);
    urlCache.set(path, url);
    return url;
  } catch (err) {
    console.error(`Failed to get download URL for path: ${path}`, err);
    return null;
  }
}

// แปลง path/url ให้กลายเป็น URL พร้อมใช้
async function resolveImageUrl(path?: string, existingUrl?: string): Promise<string | null> {
  // ถ้าให้ URL มาตรง ๆ และดูเป็น http/https ก็ใช้เลย
  if (existingUrl && /^https?:\/\//i.test(existingUrl)) return existingUrl;

  // เผื่อกรณีเผลอส่ง path ที่จริง ๆ เป็น URL มาในช่อง path
  if (path && /^https?:\/\//i.test(path)) return path;

  // กรณีเหลือเป็น path จริง ๆ
  if (path) return await pathToUrl(path);

  return null;
}

export default function ImageViewer({
  images = [],
  idCardCleanPath,
  idCardStampedPath,
  idCardCleanUrl,
  idCardStampedUrl,
  className = "",
}: ImageViewerProps) {
  const [resolvedImages, setResolvedImages] = useState<ResolvedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    let alive = true;

    async function loadImages() {
      setLoading(true);

      // ล็อกอินครั้งเดียวก่อนดึง URL ทั้งชุด (กรณีต้องไปขอจาก path)
      await ensureSignedIn();

      const allImages: ImageData[] = [];

      // --- ID Card: ให้ URL (ที่เซ็นแล้ว) มาก่อน ถ้าไม่มีค่อยใช้ path ---
      if (idCardStampedUrl || idCardStampedPath) {
        allImages.push({
          label: "บัตรประชาชน (หลังประทับ)",
          url: idCardStampedUrl,
          path: idCardStampedUrl ? undefined : idCardStampedPath,
        });
      }
      if (idCardCleanUrl || idCardCleanPath) {
        allImages.push({
          label: "บัตรประชาชน (ก่อนประทับ)",
          url: idCardCleanUrl,
          path: idCardCleanUrl ? undefined : idCardCleanPath,
        });
      }

      // --- รูปอื่น ๆ ต่อท้ายตามเดิม ---
      allImages.push(...images);

      // แปลงทั้งหมดเป็น URL แบบขนาน
      const resolved = await Promise.all(
        allImages.map(async (img) => {
          const url = await resolveImageUrl(img.path, img.url);
          return {
            label: img.label,
            url: url || "",
            isLoaded: false,
            hasError: !url,
          } as ResolvedImage;
        })
      );

      // เก็บเฉพาะรูปที่มี url จริง + กันซ้ำด้วย URL
      const uniq = new Map<string, ResolvedImage>();
      for (const r of resolved) {
        if (!r.url) continue;
        if (!uniq.has(r.url)) uniq.set(r.url, r);
      }

      if (!alive) return;
      setResolvedImages(Array.from(uniq.values()));
      setLoading(false);
    }

    // กันการยิงซ้ำบน dev/strict mode
    if (firstRun.current) {
      firstRun.current = false;
      loadImages();
    } else {
      loadImages();
    }

    return () => {
      alive = false;
    };
    // ➕ เพิ่ม dependency ของ URL ใหม่ด้วย
  }, [images, idCardCleanPath, idCardStampedPath, idCardCleanUrl, idCardStampedUrl]);

  const handleImageLoad = (index: number) => {
    setResolvedImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, isLoaded: true } : img))
    );
  };

  const handleImageError = (index: number) => {
    setResolvedImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, hasError: true } : img))
    );
  };

  if (loading) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-white p-4 ${className}`}>
        <div className="text-base font-semibold mb-2">ไฟล์แนบ/รูปภาพ</div>
        <div className="text-sm text-gray-500 p-8 text-center">กำลังโหลดรูปภาพ...</div>
      </div>
    );
  }

  if (resolvedImages.length === 0) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-white p-4 ${className}`}>
        <div className="text-base font-semibold mb-2">ไฟล์แนบ/รูปภาพ</div>
        <div className="text-sm text-gray-500 p-8 text-center">
          — ไม่มีรูป/ไฟล์แนบ —
          <div className="text-xs mt-2 opacity-70">(ตรวจสอบสิทธิ์หรือ path/URL)</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-2xl border border-gray-200 bg-white p-4 ${className}`}>
        <div className="text-base font-semibold mb-2">
          ไฟล์แนบ/รูปภาพ ({resolvedImages.length})
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resolvedImages.map((img, idx) => (
            <figure
              key={`${img.url}-${idx}`}
              className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedImage(img.url)}
            >
              <figcaption className="text-[12px] px-2 py-1 text-gray-600 truncate bg-gray-100">
                {img.label}
              </figcaption>

              <div className="aspect-[4/3] bg-white relative">
                {!img.isLoaded && !img.hasError && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                    กำลังโหลด...
                  </div>
                )}

                {img.hasError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                    <div>⚠️</div>
                    <div>ไม่สามารถโหลดรูปได้</div>
                  </div>
                ) : (
                  <img
                    src={img.url}
                    alt={img.label}
                    className={`w-full h-full object-contain transition-opacity ${
                      img.isLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    // โหลดทันที (คงพฤติกรรมเดิม)
                    loading="eager"
                    decoding="async"
                    fetchPriority={idx < 2 ? ("high" as any) : ("auto" as any)}
                    onLoad={() => handleImageLoad(idx)}
                    onError={() => handleImageError(idx)}
                  />
                )}
              </div>
            </figure>
          ))}
        </div>
      </div>

      {/* Modal ดูรูปใหญ่ */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="รูปขยาย"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
