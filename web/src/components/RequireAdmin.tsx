// ไฟล์: web/src/components/RequireAdmin.tsx (ทั้งไฟล์)
// เวลา: 2025-08-22 08:30 (แก้ไขโดย Gemini)
// เหตุผลที่แก้:
//  - คอมเมนต์ส่วนตรวจสอบสิทธิ์วิธีที่ 2 (listAdmins) ที่มีปัญหาออกไปก่อน
//  - บังคับให้ใช้การตรวจสอบจาก Firestore (วิธีที่ 3) เป็นหลักแทน

import React, { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase"; // auth (ออธ) = โมดูลล็อกอิน, db = Firestore
import {
  onAuthStateChanged,
  getIdTokenResult,
  signOut,
  User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

type Props = { children: JSX.Element };

export default function RequireAdmin({ children }: Props) {
  // ok: null = กำลังตรวจ, true = ผ่าน, false = ไม่ผ่าน
  const [ok, setOk] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setEmail("");
        setOk(false);
        return;
      }
      const e = (u.email ?? "").trim().toLowerCase();
      setEmail(e);
      const allowed = await checkIsAdmin(u, e, false);
      setOk(allowed);
    });
    return () => unsub();
  }, []);

  if (ok === null) {
    return <div className="p-6 text-slate-500">กำลังตรวจสิทธิ์ผู้ดูแล…</div>;
  }

  if (!ok) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-bold text-red-700 mb-3">
          บัญชีของคุณไม่มีสิทธิ์ผู้ดูแลระบบ
        </h1>
        <p className="text-slate-700 mb-4">อีเมล: <b>{email || "-"}</b></p>
        <div className="flex gap-3">
          <button
            className="rounded-2xl px-4 py-2 bg-amber-600 text-white"
            onClick={async () => {
              const u = auth.currentUser;
              if (!u) return;
              const e = (u.email ?? "").trim().toLowerCase();
              const allowed = await checkIsAdmin(u, e, true);
              setOk(allowed);
            }}
            title="ตรวจสิทธิ์อีกครั้ง (Refresh Token)"
          >
            ตรวจสิทธิ์อีกครั้ง
          </button>
          <a
            className="rounded-2xl px-4 py-2 bg-slate-200"
            href="/logout"
            onClick={(ev) => {
              ev.preventDefault();
              signOut(auth).finally(() => (window.location.href = "/logout"));
            }}
          >
            ออกจากระบบ
          </a>
        </div>
      </div>
    );
  }

  return children;
}

async function checkIsAdmin(u: User, emailLower: string, force: boolean): Promise<boolean> {
  // 1) Custom Claims บนโทเคน
  try {
    const token = await getIdTokenResult(u, force);
    const claims: any = token.claims;
    if (claims?.admin === true) return true;
    if (claims?.isAdmin === true) return true;
    if (claims?.role === "admin") return true;
  } catch {}

  // ★ [แก้ไข] ข้ามการตรวจสอบวิธีที่ 2 (listAdmins) ที่มีปัญหา CORS ไปก่อน
  // เราจะใช้วิธีที่ 3 (Firestore) เป็นหลักแทน
  /*
  // 2) เรียก Cloud Function listAdmins (GET + key) → เทียบอีเมล
  try {
    const base = import.meta.env.VITE_LIST_ADMINS_URL;
    const key = import.meta.env.VITE_APPROVER_KEY || "";
    if (base && key) {
      const url = `${base}?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        const list: string[] = data?.items || data?.emails || data || [];
        const normalized = list.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
        if (normalized.includes(emailLower)) return true;
      }
    }
  } catch {}
  */

  // 3) เช็ก Firestore คอลเลกชัน "admins" → id=UID หรือ id=อีเมล
  try {
    const byUid = await getDoc(doc(db, "admins", u.uid));
    if (byUid.exists()) return true;
    if (emailLower) {
      const byEmail = await getDoc(doc(db, "admins", emailLower));
      if (byEmail.exists()) return true;
    }
  } catch {}

  return false;
}