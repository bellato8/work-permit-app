// ======================================================================
// File: web/src/pages/admin/PermitDetails.tsx
// เวอร์ชัน: 2025-10-22 (อ่านเข้า–ออกจาก Firestore แล้วฟิวส์กับข้อมูล API)
// หน้าที่: แสดงรายละเอียดใบงาน + อนุมัติ/ไม่อนุมัติ + Export PDF
// ปรับตามนี้:
//  - เรียก updateStatusApi เป็นอ็อบเจ็กต์ { rid, status, reason? } และใช้ "approved"/"rejected"
//  - กันกดซ้ำด้วย decideBusy (เดิมมีอยู่แล้ว)
// ======================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { updateStatusApi } from "../../utils/updateStatus";
import { ref, getDownloadURL } from "firebase/storage";
import { storage, ensureSignedIn, auth } from "../../lib/firebase";
import { canDecide } from "../../lib/getClaims";
import useAuthzLive from "../../hooks/useAuthzLive";
import ImageViewer from "../../components/ImageViewer";
import { useReactToPrint } from "react-to-print";

// MUI Components
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  IconButton,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";

// MUI Icons
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PendingIcon from "@mui/icons-material/Pending";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonIcon from "@mui/icons-material/Person";
import BusinessIcon from "@mui/icons-material/Business";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import BadgeIcon from "@mui/icons-material/Badge";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import WorkIcon from "@mui/icons-material/Work";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import BuildIcon from "@mui/icons-material/Build";
import GroupIcon from "@mui/icons-material/Group";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import CloseIcon from "@mui/icons-material/Close";

// Firestore (อ่านสมุด checkIns / checkOuts)
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; title: string; message?: string };

type AnyRec = Record<string, any>;
type WorkerItem = {
  name?: string;
  citizenId?: string;
  isSupervisor?: boolean;
  photoPath?: string;
  photoUrl?: string;
};

const GET_DETAIL_URL = import.meta.env.VITE_GET_REQUEST_ADMIN_URL as string;

// ---------- เวลา/รูปแบบสตริง ----------
function tsToMillis(input: any): number | undefined {
  if (input == null) return undefined;
  if (typeof input === "object") {
    if (typeof (input as any)._seconds === "number") {
      const secs = (input as any)._seconds as number;
      const nanos = Number((input as any)._nanoseconds || 0);
      return secs * 1000 + Math.round(nanos / 1e6);
    }
    if (typeof (input as any).seconds === "number") {
      const secs = (input as any).seconds as number;
      const nanos = Number((input as any).nanoseconds || 0);
      return secs * 1000 + Math.round(nanos / 1e6);
    }
  }
  if (typeof input === "number") return input > 1e12 ? input : input * 1000;
  if (typeof input === "string") {
    const t = Date.parse(input);
    if (!Number.isNaN(t)) return t;
  }
  return undefined;
}

function fmtDateTimeBE(input: any): string {
  const ms = tsToMillis(input);
  if (!ms) return "-";
  try {
    const d = new Date(ms);
    const fmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    return fmt.format(d).replace(/\u200f/g, "");
  } catch {
    return "-";
  }
}

function thaiStatus(s?: string): string {
  const t = (s || "").toLowerCase();
  if (t.includes("approve")) return "อนุมัติแล้ว";
  if (t.includes("reject")) return "ไม่อนุมัติ";
  if (t.includes("return")) return "ตีกลับ/แก้ไข";
  return "รอดำเนินการ";
}
const text = (v: any): string => {
  if (v == null) return "-";
  if (typeof v === "string") return v || "-";
  try { return JSON.stringify(v); } catch { return String(v); }
};

// ---------- สกัดข้อมูล ----------
const firstOf = (obj: AnyRec | undefined, keys: string[]): string | undefined => {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
};
const toFullId = (p: AnyRec): string =>
  firstOf(p, ["citizenId", "documentId", "idNumber", "docNo", "cardNo", "id"]) ||
  p?.citizenIdMasked || p?.documentIdMasked || "-";

const sysMap: Record<string, string> = {
  electric: "ระบบไฟฟ้า",
  electricity: "ระบบไฟฟ้า",
  amp: "กำลังไฟ/แอมป์",
  lighting: "ระบบแสงสว่าง",
  hvac: "ระบบปรับอากาศ",
  air: "ระบบปรับอากาศ",
  water: "ระบบน้ำ",
  plumbing: "ระบบประปา",
  gas: "ระบบแก๊ส",
  fire: "ระบบป้องกันอัคคีภัย",
};
const normalizeSystemKey = (s: string) => s.toLowerCase().trim().replace(/[^a-z]/g, "");
const systemsToThai = (data: AnyRec | string | undefined): string => {
  if (!data) return "-";
  const out = new Set();
  if (typeof data === "string") {
    for (const raw of data.split(",")) {
      const k = normalizeSystemKey(raw);
      if (sysMap[k]) out.add(sysMap[k]);
    }
  } else if (typeof data === "object") {
    Object.entries(data).forEach(([k, v]) => {
      if (v === true || String(v).toLowerCase() === "true") {
        const key = normalizeSystemKey(k);
        if (sysMap[key]) out.add(sysMap[key]);
      }
    });
  }
  return out.size ? Array.from(out).join(", ") : "-";
};
const joinAddress = (detail?: AnyRec, requester?: AnyRec): string => {
  const fromString = typeof requester?.address === "string" ? requester?.address : "";
  const detailStr = firstOf(detail, ["detail", "address"]) || "";
  const sub = firstOf(detail, ["subdistrict", "subDistrict", "tambon"]) || "";
  const dist = firstOf(detail, ["district", "amphoe"]) || "";
  const prov = firstOf(detail, ["province"]) || "";
  const joined = [detailStr, sub, dist, prov].filter(Boolean).join(" ");
  return (joined || fromString || "-").trim();
};

const urlCache = new Map<string, string>();
async function pathToUrl(path?: string, url?: string): Promise<string | null> {
  if (url && /^https?:\/\//i.test(url)) return url;
  if (!path) return null;
  if (urlCache.has(path)) return urlCache.get(path)!;
  try {
    await ensureSignedIn();
    const storageRef = ref(storage, path);
    const dl = await getDownloadURL(storageRef);
    urlCache.set(path, dl);
    return dl;
  } catch (e) {
    console.error("getDownloadURL failed:", path, e);
    return null;
  }
}

// ---------- ช่วยหยิบค่าหลายชื่อฟิลด์ (สำหรับเข้า-ออก) ----------
const pickAny = (root: AnyRec | undefined, keys: string[]): any => {
  if (!root) return undefined;
  for (const k of keys) {
    const v = root[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};
const formatWho = (by: any, altEmail?: string): string => {
  if (!by) return altEmail || "-";
  if (typeof by === "string") return by;
  const name = by.displayName || by.name || by.fullname || "";
  const email = by.email || altEmail || "";
  return [name, email ? `(${email})` : ""].filter(Boolean).join(" ").trim() || "-";
};
const toDateParam = (ms?: number) => {
  if (!ms) return "";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// ----------------------------- คอมโพเนนต์หลัก -----------------------------
export default function PermitDetails() {
  const params = useParams<{ rid?: string; id?: string }>();
  const ridParam = (params.rid || params.id || "").trim();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnyRec | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const [decideBusy, setDecideBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  function pushToast(kind: ToastKind, title: string, message?: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((xs) => [...xs, { id, kind, title, message }]);
    setTimeout(() => setToasts((xs) => xs.filter((t) => t.id !== id)), 3000);
  }

  const [requesterPhotoUrl, setRequesterPhotoUrl] = useState<string | null>(null);
  const [workerThumbUrls, setWorkerThumbUrls] = useState<string[]>([]);

  // เก็บผลอ่านจาก Firestore (ล่าสุด) เพื่อมาฟิวส์กับของ API
  const [externalCheckIn, setExternalCheckIn] = useState<{ at?: number; by?: any; email?: string; note?: string } | null>(null);
  const [externalCheckOut, setExternalCheckOut] = useState<{ at?: number; by?: any; email?: string; note?: string } | null>(null);

  const printAreaRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printAreaRef,
    documentTitle: `work-permit_${ridParam || "details"}`,
    pageStyle: `
      @page { size: A4; margin: 12mm }
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      a[href]:after { content: "" !important; }
    `,
  });

  // โหลดสิทธิ์ (ไว้ซ่อนปุ่ม)
  const live = useAuthzLive() ?? {};
  
  // ตรวจสอบว่ามีสิทธิ์ดูรายละเอียดหรือไม่
  const canViewDetails = 
    live.role === "superadmin" ||
    live.pagePermissions?.permits?.canViewDetails === true;
  
  // ตรวจสอบว่ามีสิทธิ์อนุมัติ/ไม่อนุมัติหรือไม่
  const canApprove = 
    live.role === "superadmin" ||
    live.pagePermissions?.approvals?.canApprove === true;

  const canReject = 
    live.role === "superadmin" ||
    live.pagePermissions?.approvals?.canReject === true;

  useEffect(() => {
    let alive = true;
    // ใช้ pagePermissions เป็นหลัก ถ้าไม่มีให้ fallback ไปใช้ canDecide
    if (canApprove || canReject) {
      setAllowed(true);
    } else if (live.pagePermissions) {
      // ถ้ามี pagePermissions แล้วแต่ไม่มีสิทธิ์อนุมัติ แสดงว่าไม่มีสิทธิ์
      setAllowed(false);
    } else {
      // Fallback: ใช้ canDecide สำหรับผู้ใช้เก่าที่ยังไม่มี pagePermissions
      canDecide()
        .then(ok => { if (alive) setAllowed(ok); })
        .catch(() => { if (alive) setAllowed(false); });
    }
    return () => { alive = false; };
  }, [canApprove, canReject, live.pagePermissions]);

  // ---------- โหลดรายละเอียด (ใช้ Bearer token) ----------
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function run() {
      setErr(null); setLoading(true); setData(null);

      if (!ridParam) { setErr("ไม่พบ RID ใน URL"); setLoading(false); return; }
      if (!GET_DETAIL_URL) { setErr("ยังไม่ได้ตั้งค่า VITE_GET_REQUEST_ADMIN_URL"); setLoading(false); return; }

      try {
        await ensureSignedIn();
        const token = await auth.currentUser?.getIdToken();
        const base = GET_DETAIL_URL.replace(/\/+$/, "");
        const url = `${base}?requestId=${encodeURIComponent(ridParam)}`;

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });

        if (res.status === 401) throw new Error("ไม่ได้รับอนุญาต (ต้องเข้าสู่ระบบ)");
        if (res.status === 403) {
          const j = await res.json().catch(()=>null);
          if (j?.code === "need_view_permits") {
            throw new Error("บัญชีนี้ยังไม่มีสิทธิ์ดูรายละเอียดใบงาน (ติดต่อผู้ดูแลให้เพิ่มสิทธิ์ viewPermits/viewAll/approve)");
          }
          throw new Error("ถูกปฏิเสธการเข้าถึง");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const json = await res.json().catch(() => ({}));
        if (!json?.success && !json?.data) throw new Error(json?.error || json?.message || `ไม่พบข้อมูล RID: ${ridParam}`);

        if (!alive) return;
        setData(json.data || json);
      } catch (e:any) {
        if (!alive || e?.name === "AbortError") return;
        console.error("[getRequestAdmin] error:", e);
        setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();

    return () => { alive = false; controller.abort(); };
  }, [ridParam]);

  // โหลดเข้า–ออกจาก Firestore (เอาล่าสุดของ RID นี้แบบไม่ใช้ orderBy)
  useEffect(() => {
    let alive = true;

    // ตัวช่วย: คืนค่าเวลาเป็นเลข ms จาก doc (ลองหลายคีย์)
    const pickMs = (doc: any, keys: string[]) => {
      for (const k of keys) {
        const v = doc?.[k];
        const ms =
          v && typeof v === "object" && ("seconds" in v || "_seconds" in v)
            ? (v.seconds ?? v._seconds) * 1000 +
              Math.round(((v.nanoseconds ?? v._nanoseconds) || 0) / 1e6)
            : typeof v === "number"
            ? (v > 1e12 ? v : v * 1000)
            : typeof v === "string"
            ? Date.parse(v)
            : undefined;
        if (ms && !Number.isNaN(ms)) return ms;
      }
      return undefined;
    };

    async function fetchAttendance() {
      try {
        if (!ridParam) return;
        await ensureSignedIn();
        const db = getFirestore();

        // IN: where requestId == RID (ไม่ orderBy เพื่อเลี่ยงดัชนีผสม)
        const inSnap = await getDocs(
          query(collection(db, "checkIns"), where("requestId", "==", ridParam))
        );
        const inDocs = inSnap.docs.map(d => d.data());
        // คัดตัวที่เวลาใหญ่สุด (ล่าสุด)
        const inBest =
          inDocs
            .map((doc) => ({
              raw: doc,
              at: pickMs(doc, ["checkedInAt", "checkInAt", "createdAt"]),
            }))
            .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0] || null;

        // OUT: where requestId == RID (ไม่ orderBy)
        const outSnap = await getDocs(
          query(collection(db, "checkOuts"), where("requestId", "==", ridParam))
        );
        const outDocs = outSnap.docs.map(d => d.data());
        const outBest =
          outDocs
            .map((doc) => ({
              raw: doc,
              at: pickMs(doc, ["checkedOutAt", "checkOutAt", "createdAt"]),
            }))
            .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0] || null;

        if (!alive) return;

        setExternalCheckIn(
          inBest
            ? {
                at: inBest.at,
                by: inBest.raw?.checkedInBy ?? inBest.raw?.inBy ?? null,
                email:
                  inBest.raw?.checkedInBy?.email ??
                  inBest.raw?.inByEmail ??
                  inBest.raw?.email,
                note: inBest.raw?.notes ?? inBest.raw?.note ?? "",
              }
            : null
        );

        setExternalCheckOut(
          outBest
            ? {
                at: outBest.at,
                by: outBest.raw?.checkedOutBy ?? outBest.raw?.outBy ?? null,
                email:
                  outBest.raw?.checkedOutBy?.email ??
                  outBest.raw?.outByEmail ??
                  outBest.raw?.email,
                note: outBest.raw?.notes ?? outBest.raw?.note ?? "",
              }
            : null
        );
      } catch (e) {
        console.warn("[PermitDetails] fetchAttendance (no-orderBy):", e);
      }
    }

    fetchAttendance();
    return () => {
      alive = false;
    };
  }, [ridParam]);

  // สกัดฟิลด์เพื่อแสดงผล
  const detail = data || {};
  const w = detail?.work ?? {};
  const loc = w?.location ?? detail?.location ?? {};
  const bs = w?.buildingSystems ?? detail?.buildingSystems ?? detail?.systems ?? {};
  const req = detail?.requester ?? {};

  const systemsThai = useMemo(() => systemsToThai(bs || w?.systems || detail?.systems), [bs, w?.systems, detail?.systems]);
  const addressFull = useMemo(() => joinAddress(loc, req), [loc, req]);

  const workersRaw = useMemo(() => {
    const arr =
      (Array.isArray(detail?.workers) && detail.workers) ||
      (Array.isArray(detail?.team) && detail.team) ||
      (Array.isArray(detail?.members) && detail.members) ||
      [];
    return arr.map((w:any) => {
      if (!w) return {};
      if (typeof w === "string") return { name: w };
      return {
        name: w.name || w.fullname || [w.firstname, w.lastname].filter(Boolean).join(" "),
        citizenId: w.citizenId || w.idCard || w.cid || w.documentId || w.idNumber || w.docNo || w.cardNo,
        isSupervisor: !!(w.isSupervisor || w.supervisor),
        photoPath: w.photoPath || w.idcardPath || w.storagePath || w.imagePath,
        photoUrl: w.photoUrl || w.imageUrl || w.avatar,
      } as WorkerItem;
    }).filter((x:any)=>x && (x.name || x.citizenId || x.photoPath || x.photoUrl));
  }, [detail]);

  const [workersResolved, setWorkersResolved] = useState<(WorkerItem & { __idFull?: string })[]>([]);
  useEffect(() => {
    const rows = workersRaw.map((p) => ({ ...p, __idFull: toFullId(p) }));
    setWorkersResolved(rows);
  }, [workersRaw]);

  const statusText = thaiStatus(detail?.status || detail?.decision?.status);

  // ---------- จัดรูปสำหรับแสดง (ใช้ Signed URL ก่อน ถ้ามี) ----------
  useEffect(() => {
    let alive = true;
    async function resolvePreviewImages() {
      // ผู้ยื่นคำขอ: ใช้ URL ที่ API แนบมาก่อน
      const idStamped = detail?.images?.idCardStampedUrl;
      const idClean   = detail?.images?.idCardCleanUrl;
      if (idStamped || idClean) {
        if (!alive) return;
        setRequesterPhotoUrl(idStamped || idClean);
      } else {
        // fallback storage path
        const candidates: { path?: string; url?: string }[] = [
          { path: detail?.images?.idCardStampedPath },
          { path: detail?.images?.idCardCleanPath },
          { path: req?.photoPath, url: req?.photoUrl },
        ];
        for (const c of candidates) {
          const u = await pathToUrl(c.path, c.url);
          if (!alive) return;
          if (u) { setRequesterPhotoUrl(u); break; }
        }
      }

      // ผู้ร่วมงาน: ถ้า API แนบ cleanUrl/stampedUrl มา ให้ใช้ก่อน
      const imgs: string[] = [];
      const workersImgFromApi = Array.isArray(detail?.images?.workers) ? detail.images.workers : [];
      for (let i = 0; i < workersResolved.length; i++) {
        const apiDef = workersImgFromApi[i] || {};
        let got: string | null = null;
        if (apiDef?.cleanUrl || apiDef?.stampedUrl) {
          got = apiDef.cleanUrl || apiDef.stampedUrl || null;
        } else {
          const cands: { path?: string; url?: string }[] = [
            { path: apiDef?.cleanPath }, { path: apiDef?.stampedPath },
            { path: workersResolved[i]?.photoPath, url: workersResolved[i]?.photoUrl },
          ];
          for (const c of cands) { got = await pathToUrl(c.path, c.url); if (got) break; }
        }
        imgs.push(got || "");
      }
      if (!alive) return;
      setWorkerThumbUrls(imgs);
    }
    if (data) resolvePreviewImages();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, workersResolved.length]);

  // รวมรูปสำหรับ ImageViewer (รวม workers + attachments/photos)
  const workerImageItems = useMemo(() => {
    const items: { label: string; path?: string; url?: string }[] = [];
    const arr = Array.isArray(detail?.images?.workers) ? detail.images.workers : [];
    arr.forEach((w:any, i:number) => {
      const idx = i + 1;
      if (w?.cleanUrl)   items.push({ label: `ผู้ร่วมงาน #${idx} (ก่อนประทับ)`, url: w.cleanUrl });
      if (w?.stampedUrl) items.push({ label: `ผู้ร่วมงาน #${idx} (หลังประทับ)`, url: w.stampedUrl });
      if (w?.cleanPath && !w?.cleanUrl)     items.push({ label: `ผู้ร่วมงาน #${idx} (ก่อนประทับ)`, path: w.cleanPath });
      if (w?.stampedPath && !w?.stampedUrl) items.push({ label: `ผู้ร่วมงาน #${idx} (หลังประทับ)`, path: w.stampedPath });
    });
    return items;
  }, [detail?.images?.workers]);

  const attachmentImageItems = useMemo(() => ([
    ...(detail?.attachments || []).map((att: any, i: number) => ({
      label: att.label || `ไฟล์แนบ ${i + 1}`,
      url: att.url,
      path: att.path,
    })),
    ...(detail?.photos || []).map((photo: any, i: number) => ({
      label: photo.label || `ภาพ ${i + 1}`,
      url: photo.url,
      path: photo.path,
    })),
    ...(detail?.images?.idCardCleanUrl ? [{ label: "บัตรประชาชน (ก่อนประทับ)", url: detail.images.idCardCleanUrl }] : []),
    ...(detail?.images?.idCardStampedUrl ? [{ label: "บัตรประชาชน (หลังประทับ)", url: detail.images.idCardStampedUrl }] : []),
  ]), [detail?.attachments, detail?.photos, detail?.images?.idCardCleanUrl, detail?.images?.idCardStampedUrl]);

  // ---------- ค่าจาก API (ถ้ามี) ----------
  const attendance = detail?.attendance || detail?.check || {};
  const checkInAtRaw   = pickAny(detail, ["checkInAt","checkinAt","check_in_at"])   ?? pickAny(attendance, ["checkInAt","inAt","checkinAt"]);
  const checkOutAtRaw  = pickAny(detail, ["checkOutAt","checkoutAt","check_out_at"]) ?? pickAny(attendance, ["checkOutAt","outAt","checkoutAt"]);
  const checkInByObj   = pickAny(detail, ["checkInBy","checkinBy","check_in_by"])   ?? pickAny(attendance, ["checkInBy","inBy"]);
  const checkOutByObj  = pickAny(detail, ["checkOutBy","checkoutBy","check_out_by"]) ?? pickAny(attendance, ["checkOutBy","outBy"]);
  const checkInEmail   = pickAny(detail, ["checkInByEmail","checkinByEmail"])       ?? pickAny(attendance, ["checkInByEmail","inByEmail"]);
  const checkOutEmail  = pickAny(detail, ["checkOutByEmail","checkoutByEmail"])     ?? pickAny(attendance, ["checkOutByEmail","outByEmail"]);
  const checkInNoteApi = pickAny(detail, ["checkInNote","checkinNote","check_in_note"]) ?? pickAny(attendance, ["checkInNote","inNote"]);
  const checkOutNoteApi= pickAny(detail, ["checkOutNote","checkoutNote","check_out_note"]) ?? pickAny(attendance, ["checkOutNote","outNote"]);

  // ฟิวส์: ใช้ของ API ก่อน ถ้าไม่มีค่อยใช้ Firestore
  const checkInAtFinal  = tsToMillis(checkInAtRaw) ?? externalCheckIn?.at;
  const checkOutAtFinal = tsToMillis(checkOutAtRaw) ?? externalCheckOut?.at;

  const whoInFinal  = (formatWho(checkInByObj,  String(checkInEmail || "")) !== "-" ?
                      formatWho(checkInByObj,  String(checkInEmail || "")) :
                      formatWho(externalCheckIn?.by,  externalCheckIn?.email));
  const whoOutFinal = (formatWho(checkOutByObj, String(checkOutEmail || "")) !== "-" ?
                      formatWho(checkOutByObj, String(checkOutEmail || "")) :
                      formatWho(externalCheckOut?.by, externalCheckOut?.email));

  const checkInNoteFinal  = (checkInNoteApi  ?? externalCheckIn?.note)  || "";
  const checkOutNoteFinal = (checkOutNoteApi ?? externalCheckOut?.note) || "";

  const plannedStart = tsToMillis(detail?.work?.from || detail?.time?.start || detail?.from || detail?.startAt);
  const opDateParam  = toDateParam(checkInAtFinal || plannedStart);

  // ---------- ฟังก์ชันอนุมัติ/ไม่อนุมัติ ----------
  async function doApprove() {
    if (!ridParam || decideBusy) return;
    setDecideBusy(true);
    try {
      // เรียกแบบอ็อบเจ็กต์ให้ตรงกับยูทิล + ใช้คำที่ระบบเดิมรองรับ
      await updateStatusApi({ rid: ridParam, status: "approved" });
      pushToast("success", "อนุมัติสำเร็จ");
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      pushToast("error", "อนุมัติไม่สำเร็จ", e?.message || String(e));
    } finally {
      setDecideBusy(false);
    }
  }

  async function doReject() {
    if (!ridParam || !reason.trim() || decideBusy) return;
    setDecideBusy(true);
    try {
      // เรียกแบบอ็อบเจ็กต์ให้ตรงกับยูทิล + ใช้คำที่ระบบเดิมรองรับ
      await updateStatusApi({ rid: ridParam, status: "rejected", reason: reason.trim() });
      pushToast("success", "ไม่อนุมัติสำเร็จ");
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      pushToast("error", "ไม่อนุมัติไม่สำเร็จ", e?.message || String(e));
    } finally {
      setDecideBusy(false);
      setShowReject(false);
      setReason("");
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            รายละเอียดคำขอ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            RID: {detail?.rid || detail?.requestId || detail?.id || ridParam || "-"}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Chip
            icon={
              statusText === "อนุมัติแล้ว" ? (
                <CheckCircleIcon />
              ) : statusText === "ไม่อนุมัติ" ? (
                <CancelIcon />
              ) : (
                <PendingIcon />
              )
            }
            label={statusText}
            color={
              statusText === "อนุมัติแล้ว"
                ? "success"
                : statusText === "ไม่อนุมัติ"
                ? "error"
                : "warning"
            }
            sx={{ fontWeight: 600 }}
          />

          <Button
            onClick={() => handlePrint()}
            disabled={!data}
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            size="small"
            title={!data ? "กำลังโหลดข้อมูล..." : "บันทึกเป็น PDF"}
          >
            Export PDF
          </Button>

          <Button
            component={Link}
            to="/admin/permits"
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            size="small"
          >
            กลับรายการ
          </Button>
        </Stack>
      </Stack>

      {loading && (
        <Alert severity="info" icon={<CircularProgress size={20} />} sx={{ mb: 3 }}>
          กำลังโหลดข้อมูลจาก API...
        </Alert>
      )}

      {err && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              ลองใหม่
            </Button>
          }
        >
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            เกิดข้อผิดพลาด:
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {err}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            URL: {GET_DETAIL_URL}
          </Typography>
        </Alert>
      )}

      {/* ปุ่มตัดสินใจ (โชว์เฉพาะคนที่มีสิทธิ์ และสถานะกำลังรอดำเนินการ) */}
      {!loading && !err && data && thaiStatus(detail?.status || detail?.decision?.status) === "รอดำเนินการ" && allowed && (
        <Stack direction="row" spacing={2} sx={{ mb: 3 }} className="no-print">
          <Button
            onClick={async () => { await doApprove(); }}
            disabled={decideBusy}
            variant="contained"
            color="success"
            size="large"
            startIcon={decideBusy ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
            sx={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              "&:hover": { background: "linear-gradient(135deg, #059669 0%, #047857 100%)" },
            }}
          >
            {decideBusy ? "กำลังบันทึก..." : "อนุมัติ"}
          </Button>
          <Button
            onClick={() => setShowReject(true)}
            disabled={decideBusy}
            variant="contained"
            color="error"
            size="large"
            startIcon={<CancelIcon />}
            sx={{
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              "&:hover": { background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" },
            }}
          >
            ไม่อนุมัติ
          </Button>
        </Stack>
      )}
      {!loading && !err && data && thaiStatus(detail?.status || detail?.decision?.status) === "รอดำเนินการ" && allowed === false && (
        <Alert severity="warning" sx={{ mb: 3 }} className="no-print">
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            คุณมีสิทธิ์ดูอย่างเดียว
          </Typography>
          <Typography variant="body2">
            คุณสามารถดูรายละเอียดใบงานได้ แต่ไม่สามารถอนุมัติหรือปฏิเสธได้ หากต้องการสิทธิ์เพิ่มเติม กรุณาติดต่อผู้ดูแลระบบ
          </Typography>
        </Alert>
      )}

      {/* เนื้อหา */}
      {!loading && !err && data && (
        <Grid container spacing={3} ref={printAreaRef}>
          {/* ซ้าย: ข้อมูลหลัก */}
          <Grid item xs={12} lg={8}>
            <Stack spacing={3}>
              {/* 1) ผู้ยื่นคำขอ */}
              <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PersonIcon color="primary" /> 1) ผู้ยื่นคำขอ
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={7}>
                      <Stack spacing={2}>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <PersonIcon fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">ชื่อ-นามสกุล</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {detail?.requester?.fullname || detail?.requester?.name || detail?.contractorName || detail?.requesterName || "-"}
                          </Typography>
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <BusinessIcon fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">บริษัท</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {detail?.requester?.company || detail?.company || detail?.contractorCompany || "-"}
                          </Typography>
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <EmailIcon fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">อีเมล</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {detail?.requester?.email || detail?.email || "-"}
                          </Typography>
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <PhoneIcon fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">เบอร์โทร</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {detail?.requester?.phone || detail?.phone || "-"}
                          </Typography>
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <LocationOnIcon fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">ที่อยู่</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {addressFull}
                          </Typography>
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            <BadgeIcon fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">เลขบัตร/เอกสาร</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={600}>
                            {toFullId(detail?.requester || {})}
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={5}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "flex-start",
                        }}
                      >
                        <Box
                          sx={{
                            width: 160,
                            height: 160,
                            borderRadius: 2,
                            border: "2px dashed",
                            borderColor: "divider",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            bgcolor: "grey.50",
                          }}
                        >
                          {requesterPhotoUrl ? (
                            <img
                              src={requesterPhotoUrl}
                              alt="ผู้ยื่นคำขอ"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              loading="eager"
                              decoding="async"
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary" align="center">
                              รูปผู้ขอ<br />(ดูในไฟล์แนบ)
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* 2) รายละเอียดงาน/สถานที่/เวลา */}
              <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <WorkIcon color="primary" /> 2) รายละเอียดงาน/สถานที่/เวลา
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <WorkIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">ประเภทงาน</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {detail?.work?.type || detail?.jobType || detail?.workType || detail?.type || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <LocationOnIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">พื้นที่ปฏิบัติงาน</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {detail?.work?.area || detail?.area || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <LocationOnIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">ชั้น/โซน</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {detail?.work?.floor || detail?.floor || "-"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">ช่วงเวลา</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {text(detail?.work?.from || detail?.time?.start || detail?.from || detail?.startAt)} —{" "}
                        {text(detail?.work?.to || detail?.time?.end || detail?.to || detail?.endAt)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <LocalFireDepartmentIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">งานร้อน (Hot Work)</Typography>
                      </Stack>
                      <Chip
                        label={detail?.work?.hotWork || detail?.hotWork ? "มี" : "ไม่มี"}
                        color={detail?.work?.hotWork || detail?.hotWork ? "error" : "default"}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <BuildIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">ระบบอาคารที่เกี่ยวข้อง</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {systemsThai}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <BuildIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">อุปกรณ์นำเข้า/ออก</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {(detail?.work?.equipments?.has ? detail?.work?.equipments?.details || "มี (ไม่ได้ระบุ)" : "ไม่มี") || detail?.equipment || "-"}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* 3) ผู้ร่วมงาน */}
              <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <GroupIcon color="primary" /> 3) รายชื่อผู้ร่วมงาน ({workersResolved.length} คน)
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {workersResolved.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                      — ไม่มีข้อมูลผู้ร่วมงาน —
                    </Typography>
                  ) : (
                    <Grid container spacing={2}>
                      {workersResolved.map((p, i) => (
                        <Grid item xs={12} sm={6} key={i}>
                          <Card variant="outlined" sx={{ borderRadius: 2, bgcolor: "grey.50" }}>
                            <CardContent>
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Box
                                  sx={{
                                    width: 56,
                                    height: 56,
                                    flexShrink: 0,
                                    borderRadius: 2,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    overflow: "hidden",
                                    bgcolor: "grey.200",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {workerThumbUrls[i] ? (
                                    <img
                                      src={workerThumbUrls[i]}
                                      alt={`ผู้ร่วมงาน ${p.name || ""}`}
                                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                      loading="eager"
                                      decoding="async"
                                    />
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">
                                      รูปถ่าย
                                    </Typography>
                                  )}
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography variant="body2" fontWeight={700} noWrap>
                                    {p.name || "-"}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap>
                                    เลขเอกสาร: {p.__idFull || "-"}
                                  </Typography>
                                  {p.isSupervisor && (
                                    <Chip
                                      label="ผู้ควบคุม"
                                      size="small"
                                      color="primary"
                                      sx={{ mt: 0.5, height: 20, fontSize: 10 }}
                                    />
                                  )}
                                </Box>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </CardContent>
              </Card>

              {/* 4) เวลา/ผู้ตัดสิน */}
              <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AccessTimeIcon color="primary" /> 4) บันทึกเวลา/ผู้ตัดสิน
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">สร้างเมื่อ</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {fmtDateTimeBE(detail?.createdAt)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">อัปเดตล่าสุด</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {fmtDateTimeBE(detail?.updatedAt || detail?.decision?.at)}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">ผู้ตัดสิน</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {detail?.decision?.by?.displayName
                          ? `${detail.decision.by.displayName} (${detail.decision.by.email || "-"})`
                          : (detail?.decision?.byEmail || detail?.approvedByEmail || detail?.rejectedByEmail || "-")}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">ผลล่าสุด</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {thaiStatus(detail?.status || detail?.decision?.status)}
                      </Typography>
                    </Grid>
                    {(detail?.decision?.reason || detail?.rejectionReason) && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">เหตุผล</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {detail?.decision?.reason || detail?.rejectionReason}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>

              {/* 5) ประวัติการเข้า-ออกหน้างาน */}
              <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <LoginIcon color="primary" /> 5) ประวัติการเข้า-ออกหน้างาน
                    </Typography>
                    {opDateParam && (
                      <Button
                        component={Link}
                        to={`/admin/daily-operations?date=${opDateParam}`}
                        size="small"
                        variant="outlined"
                        title="ไปดูวันนั้นในงานประจำวัน"
                      >
                        ดูงานประจำวัน
                      </Button>
                    )}
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LoginIcon fontSize="small" color="success" />
                          <Typography variant="caption" color="text.secondary">เข้าเมื่อ</Typography>
                        </Stack>
                        <Typography variant="body2" fontWeight={700}>
                          {fmtDateTimeBE(checkInAtFinal)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {whoInFinal || "-"}
                        </Typography>
                        {checkInNoteFinal && (
                          <Typography variant="caption" color="text.secondary">
                            เหตุผล: {String(checkInNoteFinal)}
                          </Typography>
                        )}
                      </Stack>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LogoutIcon fontSize="small" color="error" />
                          <Typography variant="caption" color="text.secondary">ออกเมื่อ</Typography>
                        </Stack>
                        <Typography variant="body2" fontWeight={700}>
                          {fmtDateTimeBE(checkOutAtFinal)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {whoOutFinal || "-"}
                        </Typography>
                        {checkOutNoteFinal && (
                          <Typography variant="caption" color="text.secondary">
                            เหตุผล: {String(checkOutNoteFinal)}
                          </Typography>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* ขวา: ImageViewer */}
          <Grid item xs={12} lg={4}>
            <ImageViewer
              images={[...workerImageItems, ...attachmentImageItems]}
              idCardCleanPath={detail?.images?.idCardCleanPath}
              idCardStampedPath={detail?.images?.idCardStampedPath}
              idCardCleanUrl={detail?.images?.idCardCleanUrl}
              idCardStampedUrl={detail?.images?.idCardStampedUrl}
            />
          </Grid>
        </Grid>
      )}

      {!loading && !err && !data && (
        <Card sx={{ mt: 4, textAlign: "center", py: 6 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              ไม่พบข้อมูล
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              RID: {ridParam}
            </Typography>
            <Button
              onClick={() => window.location.reload()}
              variant="contained"
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            >
              โหลดข้อมูลใหม่
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal ไม่อนุมัติ */}
      <Dialog
        open={showReject}
        onClose={() => !decideBusy && setShowReject(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
        className="no-print"
      >
        <DialogTitle sx={{ bgcolor: "error.light", color: "error.contrastText" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CancelIcon />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                เหตุผลที่ไม่อนุมัติ
              </Typography>
              <Typography variant="caption">
                กรุณาระบุเหตุผลอย่างน้อย 1 บรรทัด
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="เอกสารไม่ครบ / ต้องแนบแบบแปลน / ฯลฯ"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
            variant="outlined"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: "grey.50" }}>
          <Button
            onClick={() => setShowReject(false)}
            disabled={decideBusy}
            variant="outlined"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={async () => { await doReject(); }}
            disabled={decideBusy || !reason.trim()}
            variant="contained"
            color="error"
            startIcon={decideBusy ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
            sx={{
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              "&:hover": { background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" },
            }}
          >
            {decideBusy ? "กำลังบันทึก..." : "ยืนยันไม่อนุมัติ"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar สำหรับแจ้งเตือน */}
      {toasts.map((t) => (
        <Snackbar
          key={t.id}
          open={true}
          autoHideDuration={3000}
          onClose={() => setToasts((xs) => xs.filter((x) => x.id !== t.id))}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={t.kind}
            onClose={() => setToasts((xs) => xs.filter((x) => x.id !== t.id))}
            sx={{ width: "100%", minWidth: 300 }}
          >
            <Typography variant="subtitle2" fontWeight={600}>
              {t.title}
            </Typography>
            {t.message && (
              <Typography variant="body2">{t.message}</Typography>
            )}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
}
