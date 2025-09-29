import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Stack, Typography, ImageList, ImageListItem,
  Paper, Link, CircularProgress, Alert, IconButton, Tooltip, Button
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { getStorage, ref, listAll, getDownloadURL, getMetadata } from "firebase/storage";

/** โครงสร้างไฟล์แนบกลาง ๆ ให้ทุกแหล่ง map มาเป็นแบบนี้ */
type AttachItem = {
  name: string;
  url: string;
  contentType?: string;
  size?: number;
  path?: string;        // storage path (ถ้ามี)
};

type Props = {
  /** เลข RID เช่น "WP-20250902-3SCM" */
  rid: string;

  /** ถ้าหน้าหลักโหลด doc มาแล้วมี attachments/files/photos ก็ส่งมาได้ (optional) */
  inlineItems?: any[] | null | undefined;

  /** prefix โฟลเดอร์ใน Storage (default: "permits") => จะสแกนที่ "permits/{rid}" */
  storagePrefix?: string;

  /** ชื่อ collection หลักใน Firestore (default: "permits") */
  permitsCollection?: string;

  /** ชื่อ subcollection ที่เก็บไฟล์ (default: "attachments") */
  attachmentsSub?: string;

  /** หัวข้อกล่อง */
  title?: string;
};

function isImage(contentType?: string, name?: string) {
  if (contentType?.startsWith("image/")) return true;
  if (name && /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name)) return true;
  return false;
}

function normFromInline(x: any): AttachItem | null {
  if (!x) return null;
  // รองรับรูปแบบทั่วไป: {url,name,type,mime,contentType,path}
  const url = String(x.url || x.downloadURL || x.href || "");
  if (!url) return null;
  const name = String(x.name || x.filename || x.fileName || x.path || "file");
  const contentType = String(x.contentType || x.mime || x.type || "");
  const size = typeof x.size === "number" ? x.size : undefined;
  const path = typeof x.path === "string" ? x.path : undefined;
  return { name, url, contentType, size, path };
}

export default function PermitFiles({
  rid,
  inlineItems,
  storagePrefix = "permits",
  permitsCollection = "permits",
  attachmentsSub = "attachments",
  title = "ไฟล์แนบ/รูปภาพ",
}: Props) {
  const [items, setItems] = useState<AttachItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const inlineNorm = useMemo(() => {
    if (!Array.isArray(inlineItems)) return [];
    return inlineItems.map(normFromInline).filter(Boolean) as AttachItem[];
  }, [inlineItems]);

  async function loadFromFirestore(): Promise<AttachItem[]> {
    try {
      const db = getFirestore();
      // 1) ลอง subcollection attachments ก่อน
      const subRef = collection(db, `${permitsCollection}/${rid}/${attachmentsSub}`);
      const subSnap = await getDocs(subRef);
      const list1: AttachItem[] = [];
      subSnap.forEach((d) => {
        const x: any = d.data();
        const it = normFromInline(x) || normFromInline({ url: x.url, name: x.name, type: x.type, path: x.path });
        if (it) list1.push(it);
      });
      if (list1.length > 0) return list1;

      // 2) เผื่อบางระบบเก็บใน field ของ doc หลัก เช่น attachments/files/photos
      const docRef = doc(db as any, permitsCollection, rid);
      const main = await getDoc(docRef);
      if (main.exists()) {
        const data: any = main.data();
        const arrays = [data?.attachments, data?.files, data?.photos].filter(Array.isArray) as any[][];
        for (const arr of arrays) {
          const list2 = arr.map(normFromInline).filter(Boolean) as AttachItem[];
          if (list2.length > 0) return list2;
        }
      }
      return [];
    } catch (e: any) {
      console.error("[PermitFiles] Firestore error:", e);
      return [];
    }
  }

  async function loadFromStorage(): Promise<AttachItem[]> {
    try {
      const storage = getStorage();
      // จะลองทั้ง prefix/rid และ prefix/rid/attachments (กันโครงสร้างต่างกัน)
      const candidates = [
        `${storagePrefix}/${rid}`,
        `${storagePrefix}/${rid}/attachments`,
      ];
      const out: AttachItem[] = [];

      for (const p of candidates) {
        const r = ref(storage, p);
        try {
          const listing = await listAll(r);
          for (const f of listing.items) {
            const [url, md] = await Promise.all([getDownloadURL(f), getMetadata(f).catch(() => undefined)]);
            out.push({
              name: f.name,
              url,
              contentType: md?.contentType,
              size: md?.size ? Number(md.size) : undefined,
              path: f.fullPath,
            });
          }
          if (out.length > 0) break; // เจอแล้วพอ
        } catch (_e) {
          // โฟลเดอร์นี้อาจไม่มี
        }
      }
      return out;
    } catch (e) {
      console.error("[PermitFiles] Storage error:", e);
      return [];
    }
  }

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      // ลำดับ: inline → Firestore → Storage
      if (inlineNorm.length > 0) {
        setItems(inlineNorm);
        return;
      }
      const fsItems = await loadFromFirestore();
      if (fsItems.length > 0) {
        setItems(fsItems);
        return;
      }
      const stItems = await loadFromStorage();
      setItems(stItems);
    } catch (e: any) {
      setErr(e?.message || "โหลดไฟล์แนบล้มเหลว");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  function copy(s: string) {
    navigator.clipboard?.writeText(s).catch(() => {});
  }

  const images = items.filter((x) => isImage(x.contentType, x.name));
  const others = items.filter((x) => !isImage(x.contentType, x.name));

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography fontWeight={700}>{title}</Typography>
        <Button size="small" onClick={loadAll} disabled={loading}>รีเฟรช</Button>
      </Stack>

      {loading && (
        <Stack alignItems="center" sx={{ py: 3 }}>
          <CircularProgress size={24} />
        </Stack>
      )}

      {!!err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}

      {!loading && items.length === 0 && (
        <Box sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
          — ไม่มีรูป/ไฟล์แนบ —
        </Box>
      )}

      {images.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>รูปภาพ</Typography>
          <ImageList cols={3} gap={8} sx={{ m: 0 }}>
            {images.map((it, idx) => (
              <ImageListItem key={idx}>
                <img src={it.url} alt={it.name} loading="lazy" />
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: "center" }}>
                  <Typography variant="caption" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.name}
                  </Typography>
                  <Tooltip title="คัดลอกลิงก์">
                    <IconButton size="small" onClick={() => copy(it.url)}><ContentCopyRoundedIcon fontSize="inherit" /></IconButton>
                  </Tooltip>
                  <Tooltip title="เปิดดู">
                    <IconButton size="small" component={Link} href={it.url} target="_blank" rel="noopener">
                      <OpenInNewRoundedIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </ImageListItem>
            ))}
          </ImageList>
        </Box>
      )}

      {others.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>ไฟล์อื่น ๆ</Typography>
          <Stack spacing={1}>
            {others.map((it, idx) => (
              <Stack key={idx} direction="row" spacing={1} alignItems="center">
                <Link href={it.url} target="_blank" rel="noopener">{it.name}</Link>
                <Tooltip title="คัดลอกลิงก์">
                  <IconButton size="small" onClick={() => copy(it.url)}><ContentCopyRoundedIcon fontSize="inherit" /></IconButton>
                </Tooltip>
                {!!it.contentType && (
                  <Typography variant="caption" color="text.secondary">{it.contentType}</Typography>
                )}
                {!!it.size && (
                  <Typography variant="caption" color="text.secondary">
                    {(it.size / 1024).toFixed(1)} KB
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
