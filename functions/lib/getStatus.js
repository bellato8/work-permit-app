"use strict";
// ======================================================================
// File: functions/src/getStatus.ts
// วันที่/เวลา: 2025-09-12 14:05
// ผู้เขียน: AI + สุทธิรักษ์ วิเชียรศรี
// หน้าที่: HTTP Cloud Function getStatus — รวม/แมปข้อมูลจาก Firestore
// หมายเหตุ: รวมฟิลด์ "เหตุผลการไม่อนุมัติ" จากหลายแหล่งให้เป็น out.rejectionReason
//            + คง compat โครงสร้างเดิม, mask เบอร์/อีเมลในโหมดปกติ, รองรับ pdf=1
// ======================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatus = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const _cors_1 = require("./_cors");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
/* -------------------------- helpers (mask & misc) -------------------------- */
const last4 = (s) => (s ?? "").replace(/\D/g, "").slice(-4);
const maskPhone = (s) => {
    const digits = (s ?? "").replace(/\D/g, "");
    if (!digits)
        return "";
    const l4 = digits.slice(-4).padStart(4, "•");
    return `***-***-${l4}`;
};
const maskEmail = (s) => {
    if (!s)
        return "";
    const [u, d] = s.split("@");
    if (!u || !d)
        return s;
    const uMask = u.length <= 2 ? u[0] + "********" : u[0] + "********" + u.slice(-1);
    const dMask = d.replace(/^(.)(.*)(\..*)$/, (_m, a, mid, tld) => (a ?? "") + "*".repeat(Math.max(1, String(mid).length)) + (tld ?? ""));
    return `${uMask}@${dMask}`;
};
const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
/** "มี/true/1/hot" → true, "ไม่มี/false/0" → false */
function normalizeHotWork(v) {
    const s = String(v ?? "").trim().toLowerCase();
    if (!s)
        return false;
    if (["true", "1", "hot", "hotwork", "มี", "yes"].includes(s))
        return true;
    if (["false", "0", "no", "ไม่มี"].includes(s))
        return false;
    return Boolean(v);
}
/** รับ "2025-09-02T20:41" หรือ timestamp {seconds} → คืน "HH:mm" */
function toHHmm(v) {
    if (typeof v === "string") {
        const m = v.match(/T(\d{2}):(\d{2})/);
        if (m)
            return `${m[1]}:${m[2]}`;
        const m2 = v.match(/^(\d{2}):(\d{2})$/);
        if (m2)
            return v;
    }
    const sec = v?.seconds ?? v?._seconds;
    if (typeof sec === "number") {
        const d = new Date(sec * 1000);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    }
    return undefined;
}
/** รวมส่วนที่อยู่เป็นบรรทัดเดียว */
function joinAddress(detail, subdistrict, district, province) {
    return [detail, subdistrict, district, province].filter(Boolean).join(" • ");
}
/** แปลง flags ระบบอาคาร → label ภาษาไทย พร้อม amp ถ้ามี */
function buildingFlagsToLabels(flags) {
    if (!flags || typeof flags !== "object")
        return [];
    const m = {
        electric: "ไฟฟ้า",
        plumbing: "ประปา",
        lighting: "แสงสว่าง",
        hvac: "แอร์",
        water: "น้ำ",
        gas: "แก๊ส",
    };
    const labels = [];
    for (const k of Object.keys(m)) {
        if (flags[k])
            labels.push(m[k]);
    }
    if (flags.electric && flags.amp) {
        const idx = labels.indexOf("ไฟฟ้า");
        if (idx >= 0)
            labels[idx] = `ไฟฟ้า (${String(flags.amp)})`;
    }
    return labels;
}
/* ----------------------------- compose payload ----------------------------- */
function composePayload(docData) {
    const d = docData ?? {};
    const work = d.work ?? {}; // โครงสร้างใหม่
    // requester / company / contact
    const requester = d.requester ?? {};
    const flatCompany = d.company ?? requester.company ?? work.company;
    const flatContractorName = d.contractorName ?? requester.fullname;
    const flatPhone = d.phone ?? requester.phone;
    const flatEmail = d.email ?? requester.email;
    // location + address
    const loc = work.location ?? d.location ?? {};
    const addressFromLoc = joinAddress(loc.detail, loc.subdistrict, loc.district, loc.province);
    const flatAddress = d.address ??
        requester.address ??
        requester.addressLine ??
        loc.addressLine ??
        addressFromLoc;
    // area/floor/type/time
    const area = work.area ?? d.area ?? "";
    const floor = work.floor ?? d.floor ?? d.floorLabel ?? "";
    const jobType = work.type ?? loc.type ?? d.jobType ?? d.workType ?? "";
    const timeFrom = toHHmm(work.from ?? d.timeFrom ?? d.timeStart);
    const timeTo = toHHmm(work.to ?? loc.to ?? d.timeTo ?? d.timeEnd);
    // building systems
    const bs = work.buildingSystems ?? d.buildingSystems ?? {};
    const sysFromFlags = buildingFlagsToLabels(bs);
    const sysFromLabels = Array.isArray(bs.labels) ? bs.labels : [];
    const buildingSystemWork = d.buildingSystemWork ??
        (sysFromFlags.length || sysFromLabels.length ? [...sysFromFlags, ...sysFromLabels] : null);
    // equipments
    const eq = work.equipments ?? d.equipments ?? {};
    let equipmentList = [];
    if (Array.isArray(d.equipmentList))
        equipmentList = d.equipmentList;
    else if (Array.isArray(eq.items))
        equipmentList = eq.items;
    // team
    const workersFromWork = toArray(work.workers);
    const workersFromRoot = toArray(d.workers);
    const teamArrLegacy = toArray(d.team);
    let teamNames = Array.isArray(d.teamNames) && d.teamNames.length
        ? d.teamNames
        : workersFromWork.length
            ? workersFromWork.map((w) => w?.name).filter(Boolean)
            : workersFromRoot.length
                ? workersFromRoot.map((w) => w?.name).filter(Boolean)
                : teamArrLegacy.length
                    ? teamArrLegacy.map((m) => m?.name).filter(Boolean)
                    : [];
    const teamCount = typeof d.teamCount === "number"
        ? d.teamCount
        : (workersFromWork.length ||
            workersFromRoot.length ||
            teamArrLegacy.length ||
            teamNames.length ||
            0);
    // citizen mask
    const citizenFromRequester = requester.citizenId;
    const citizenFromWorkers = workersFromWork?.[0]?.citizenId ?? workersFromRoot?.[0]?.citizenId;
    const citizenId = citizenFromRequester ?? citizenFromWorkers;
    const citizenIdMasked = requester.citizenIdMasked ??
        (typeof citizenId === "string" && citizenId.length >= 4
            ? "•".repeat(Math.max(0, citizenId.length - 4)) + citizenId.slice(-4)
            : undefined);
    // ----- decision / rejectionReason -----
    const rawDecision = d.decision ?? d.latestDecision ?? d.approval ?? null;
    let decision = null;
    if (rawDecision && typeof rawDecision === "object") {
        const actionRaw = rawDecision.action ?? rawDecision.status ?? rawDecision.type ?? null;
        const action = String(actionRaw ?? "").toLowerCase().startsWith("rej")
            ? "reject"
            : String(actionRaw ?? "").toLowerCase().startsWith("app")
                ? "approve"
                : null;
        const atRaw = rawDecision.at ?? rawDecision.time ?? rawDecision.ts ?? rawDecision.timestamp ?? null;
        const at = typeof atRaw === "number"
            ? atRaw
            : typeof atRaw?.seconds === "number"
                ? atRaw.seconds * 1000
                : null;
        const reason = rawDecision.reason ??
            d.rejectionReason ??
            d.rejectReason ??
            d.reasonReject ??
            d.reason ??
            rawDecision.note ??
            rawDecision.message;
        decision = { action, at, reason };
    }
    // หา reason จาก workers[] ด้วย (ในเอกสารของเพื่อนมีเก็บไว้)
    const workerRejectReason = workersFromWork?.[0]?.rejectionReason ??
        workersFromRoot?.[0]?.rejectionReason ??
        undefined;
    const rejectionReason = (decision?.action === "reject" && decision?.reason
        ? String(decision.reason)
        : undefined) ??
        d.rejectionReason ??
        d.rejectReason ??
        d.reasonReject ??
        d.reject_note ??
        d.rejectDetail ??
        d.reject_details ??
        d.nonApprovalReason ??
        d.nonApproveReason ??
        workerRejectReason;
    const requesterOut = {
        ...requester,
        addressLine: requester.addressLine ?? flatAddress ?? addressFromLoc ?? "",
        citizenIdMasked,
    };
    return {
        // หลัก
        rid: d.rid ?? d.requestId,
        status: d.status ?? "-",
        // แบบแบน
        company: flatCompany ?? "",
        contractorName: flatContractorName ?? "",
        phone: flatPhone ?? "",
        email: flatEmail ?? "",
        address: flatAddress ?? "",
        area,
        floor,
        jobType,
        timeFrom: timeFrom ?? undefined,
        timeTo: timeTo ?? undefined,
        timeStart: d.timeStart ?? undefined,
        timeEnd: d.timeEnd ?? undefined,
        hotWork: normalizeHotWork(work.hotWork ?? d.hotWork ?? d.isHotWork),
        buildingSystemWork,
        equipmentList,
        teamCount,
        teamNames,
        requester: requesterOut,
        location: loc,
        buildingSystems: bs,
        equipments: eq,
        // NEW: decision + rejectionReason
        decision,
        rejectionReason,
        requireLast4: true,
        updatedAt: d.updatedAt ?? d._updatedAt ?? admin.firestore.FieldValue.serverTimestamp(),
    };
}
/* --------------------------------- handler -------------------------------- */
async function core(req, res) {
    const isPost = req.method === "POST";
    const q = isPost ? (req.body ?? {}) : req.query;
    const rid = String(q.rid ?? "").trim();
    const pdf = String(q.pdf ?? "").trim() === "1";
    const last4Input = String(q.last4 ?? "").trim();
    if (!rid) {
        res.status(400).json({ ok: false, error: "missing rid" });
        return;
    }
    const snap = await db.collection("requests").doc(rid).get();
    if (!snap.exists) {
        res.status(404).json({ ok: false, error: "not_found" });
        return;
    }
    const data = snap.data() || {};
    const payload = composePayload(data);
    // ตรวจ 4 ตัวท้าย
    const needLast4 = true;
    const phone4 = last4(payload.phone);
    if (needLast4 && (!last4Input || phone4 !== last4Input)) {
        res.status(403).json({ ok: false, error: "last4_mismatch" });
        return;
    }
    // non-pdf → mask เบอร์/อีเมล
    const out = { ...payload };
    if (!pdf) {
        out.maskedPhone = maskPhone(payload.phone);
        out.maskedEmail = maskEmail(payload.email);
        delete out.phone;
        delete out.email;
    }
    // แนบเวอร์ชันเพื่อ debug ว่า deploy ตรงตัวจริงไหม
    out.__apiVersion = "getStatus/2025-09-12-rj-reason-v1";
    res.json({ ok: true, data: out });
}
exports.getStatus = (0, https_1.onRequest)({ region: "asia-southeast1" }, (0, _cors_1.withCors)(core));
