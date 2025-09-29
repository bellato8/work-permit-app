// functions/src/deleteLogs.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getApps, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  FieldPath,
} from "firebase-admin/firestore";
import { emitAudit } from "./lib/emitAudit";

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = "asia-southeast1";

// ตรวจสิทธิ์แบบเดียวกับฝั่งเว็บ
function isSuperAdminLike(t: any): boolean {
  const role = String(t?.role || "").toLowerCase();
  const caps: string[] = Array.isArray(t?.caps)
    ? t.caps.map((x: any) => String(x).toLowerCase())
    : [];
  return (
    role === "superadmin" ||
    t?.superadmin === true ||
    t?.superAdmin === true ||
    caps.includes("superadmin")
  );
}

type Mode = "all" | "byRid" | "before";
type Input = { mode: Mode; rid?: string; ts?: number | string };
type Output = {
  ok: boolean;
  collectionPath: string;
  mode: Mode;
  deleted: number;
};

async function deleteByQuery(
  label: string,
  q: FirebaseFirestore.Query,
  step = 300
): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await q.limit(step).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();

    deleted += snap.size;
    if (snap.size < step) break;
  }
  logger.info(`[deleteLogs] ${label} deleted=${deleted}`);
  return deleted;
}

export const deleteLogs = onCall<Output>(
  { region: REGION, timeoutSeconds: 540, memory: "512MiB" },
  async (req) => {
    // --- auth guard ---
    const token = req.auth?.token;
    if (!token) throw new HttpsError("unauthenticated", "auth_required");
    if (!isSuperAdminLike(token))
      throw new HttpsError("permission-denied", "superadmin_required");

    const { mode, rid, ts } = (req.data as Input) || {};
    if (!mode) throw new HttpsError("invalid-argument", "mode_required");

    let total = 0;

    if (mode === "all") {
      total += await deleteByQuery(
        "auditLogs",
        db.collection("auditLogs").orderBy(FieldPath.documentId())
      );
      total += await deleteByQuery(
        "audit_logs",
        db.collection("audit_logs").orderBy(FieldPath.documentId())
      );
      total += await deleteByQuery(
        "logs",
        db.collection("logs").orderBy(FieldPath.documentId())
      );
    }

    if (mode === "byRid") {
      if (!rid?.trim())
        throw new HttpsError("invalid-argument", "rid_required");

      // auditLogs เก็บ rid อยู่ใน target.rid (ตามตัวรวม logs)
      total += await deleteByQuery(
        "auditLogs.byRid",
        db.collection("auditLogs").where("target.rid", "==", rid.trim())
      );
      // audit_logs ใช้ requestId / rid
      total += await deleteByQuery(
        "audit_logs.byRid",
        db.collection("audit_logs").where("requestId", "==", rid.trim())
      );
      total += await deleteByQuery(
        "audit_logs.byRid2",
        db.collection("audit_logs").where("rid", "==", rid.trim())
      );
      // logs มีทั้ง rid บน root และใน details.rid
      total += await deleteByQuery(
        "logs.byRid",
        db.collection("logs").where("rid", "==", rid.trim())
      );
      total += await deleteByQuery(
        "logs.byRid.details",
        db.collection("logs").where("details.rid", "==", rid.trim())
      );
    }

    if (mode === "before") {
      let ms: number | null = null;
      if (typeof ts === "number") {
        ms = ts < 2e12 ? Math.round(ts * 1000) : Math.round(ts);
      } else if (typeof ts === "string") {
        const t = Date.parse(ts);
        ms = Number.isNaN(t) ? null : t;
      }
      if (ms == null) throw new HttpsError("invalid-argument", "ts_invalid");
      const T = Timestamp.fromMillis(ms);

      // auditLogs: เผื่อหลายชื่อฟิลด์เวลา
      for (const f of ["at", "createdAt", "timestamp", "time", "date"]) {
        total += await deleteByQuery(
          `auditLogs.before.${f}`,
          db.collection("auditLogs").where(f, "<=", T)
        );
      }
      // audit_logs: พบใช้ timestamp/at/createdAt
      for (const f of ["timestamp", "at", "createdAt"]) {
        total += await deleteByQuery(
          `audit_logs.before.${f}`,
          db.collection("audit_logs").where(f, "<=", T)
        );
      }
      // logs: timestamp / at / details.timestamp
      total += await deleteByQuery(
        "logs.before.timestamp",
        db.collection("logs").where("timestamp", "<=", T)
      );
      total += await deleteByQuery(
        "logs.before.at",
        db.collection("logs").where("at", "<=", T)
      );
      total += await deleteByQuery(
        "logs.before.details.timestamp",
        db.collection("logs").where("details.timestamp", "<=", T)
      );
    }

    // บันทึก audit
    try {
      await emitAudit(
        "delete_logs",
        { email: (token as any)?.email || "unknown" },
        { type: "logs" },
        `mode=${mode}`,
        { rid, ts }
      );
    } catch (e: any) {
      logger.warn("[deleteLogs] emitAudit failed", { err: e?.message });
    }

    return {
      ok: true,
      collectionPath: "auditLogs|audit_logs|logs",
      mode,
      deleted: total,
    };
  }
);
