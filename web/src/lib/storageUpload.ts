// ======================================================================
// ไฟล์: src/lib/storageUpload.ts
// หน้าที่: ตัวช่วยอัปโหลดไฟล์ขึ้น Firebase Storage แบบเสถียรด้วย SDK
// หมายเหตุ:
//   - ต้องล็อกอิน (แม้แบบ anonymous) ก่อนอัปโหลดตามกติกา Storage Rules ใหม่
//   - ใช้ instance ของ storage จาก src/lib/firebase เพื่อให้ config ตรงกันทั้งแอป
// ======================================================================

import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, ensureSignedIn } from "./firebase";

/**
 * อัปโหลดไฟล์ขึ้น Storage แล้วคืนลิงก์ดาวน์โหลด
 * @param path เส้นทางไฟล์ปลายทาง เช่น "requests/WP-20250901-AAAA/idcard_clean.jpg"
 * @param file ไฟล์จาก <input type="file">
 * @param onProgress (ไม่บังคับ) ฟังก์ชันรับเปอร์เซ็นต์ความคืบหน้า 0-100
 */
export function uploadImageToStorage(
  path: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    try {
      // 1) ต้องมีผู้ใช้ล็อกอินก่อน (จะล็อกอิน anonymous ให้โดยอัตโนมัติถ้ายังไม่ได้)
      await ensureSignedIn();

      // 2) เคลียร์ path ให้ปลอดภัย (ตัด / นำหน้าออก)
      const cleanPath = String(path || "").replace(/^\/+/, "");
      if (!cleanPath) {
        reject(new Error("ไม่พบปลายทางในการอัปโหลด (path ว่าง)"));
        return;
      }

      // 3) อ้างอิงตำแหน่งปลายทาง
      const objectRef = ref(storage, cleanPath);

      // 4) ตั้ง metadata ขั้นพื้นฐาน
      const metadata: Record<string, string> = {
        contentType: file?.type || "application/octet-stream",
        cacheControl: "public, max-age=31536000, immutable",
      };

      // 5) สร้างงานอัปโหลดแบบ resumable
      const task = uploadBytesResumable(objectRef, file, metadata);

      task.on(
        "state_changed",
        (snap) => {
          if (onProgress && snap.totalBytes > 0) {
            const percent = (snap.bytesTransferred / snap.totalBytes) * 100;
            onProgress(Math.round(percent));
          }
        },
        (err) => {
          reject(
            new Error(
              `อัปโหลดล้มเหลว: ${err?.message || err || "unknown_error"}`
            )
          );
        },
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (e: any) {
            reject(
              new Error(
                `ดึงลิงก์ดาวน์โหลดไม่สำเร็จ: ${e?.message || e || "unknown_error"}`
              )
            );
          }
        }
      );
    } catch (e: any) {
      reject(
        new Error(
          `เตรียมอัปโหลดไม่สำเร็จ: ${e?.message || e || "unknown_error"}`
        )
      );
    }
  });
}
