// ======================================================================
// File: web/src/hooks/useAdminPermissions.ts
// Purpose: Hook สำหรับ Fetch และ Update permissions ของผู้ดูแล
// Created: 2025-10-14
// Notes:
//  - ฟังสถานะผู้ใช้ด้วย onAuthStateChanged / onIdTokenChanged แล้วค่อยยิง API
//  - แนบ Firebase ID Token ใน Authorization: Bearer <token>
//  - รองรับรูปแบบผลลัพธ์ทั้ง {admins: []} หรือ {ok, data: {items: []}}
// ======================================================================

import { useEffect, useState, useCallback } from "react";
import {
  getAuth,
  getIdToken,
  onAuthStateChanged,
  onIdTokenChanged,
  User,
} from "firebase/auth";
import { PagePermissions } from "../types/permissions";

export type Admin = {
  email: string;
  name: string;
  role: string;
  enabled: boolean;
  pagePermissions?: PagePermissions;
};

export function useAdminPermissions() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(getAuth().currentUser);

  const LIST_URL = import.meta.env.VITE_LIST_ADMINS_URL as string | undefined;
  const UPDATE_URL = import.meta.env.VITE_UPDATE_ADMIN_PERMISSIONS_URL as string | undefined;

  // ฟังสถานะล็อกอิน + การรีเฟรชโทเค็น
  useEffect(() => {
    const auth = getAuth();
    const unsubAuth = onAuthStateChanged(auth, setUser);
    const unsubToken = onIdTokenChanged(auth, setUser);
    return () => {
      unsubAuth();
      unsubToken();
    };
  }, []);

  // ดึงรายชื่อผู้ดูแล
  const fetchAdmins = useCallback(async () => {
    if (!LIST_URL) {
      setError("VITE_LIST_ADMINS_URL ไม่ได้ตั้งค่า (.env.local)");
      return;
    }
    if (!user) {
      setError("ไม่ได้ล็อกอิน");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken(user);
      const res = await fetch(LIST_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const d: any = await res.json();
          msg = d?.message ?? d?.data?.message ?? msg;
        } catch {}
        throw new Error(msg);
      }

      const raw: any = await res.json();
      // รองรับหลายรูปแบบ
      const items: Admin[] =
        raw?.admins ??
        raw?.data?.items ??
        raw?.items ??
        (Array.isArray(raw) ? raw : []);
      setAdmins(items);
    } catch (e: any) {
      setError(e?.message ?? "เกิดข้อผิดพลาด");
      console.error("Error fetching admins:", e);
    } finally {
      setLoading(false);
    }
  }, [LIST_URL, user]);

  // มี user แล้วค่อยยิง (และเมื่อโทเค็นเปลี่ยน)
  useEffect(() => {
    if (user) fetchAdmins();
  }, [user, fetchAdmins]);

  // อัปเดตสิทธิ์ผู้ดูแล
  const updatePermissions = useCallback(
    async (email: string, permissions: PagePermissions): Promise<void> => {
      if (!UPDATE_URL) {
        throw new Error("VITE_UPDATE_ADMIN_PERMISSIONS_URL ไม่ได้ตั้งค่า (.env.local)");
      }
      if (!user) {
        throw new Error("ไม่ได้ล็อกอิน");
      }

      const token = await getIdToken(user);
      const res = await fetch(UPDATE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, pagePermissions: permissions }),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const d: any = await res.json();
          msg = d?.message ?? d?.data?.message ?? msg;
        } catch {}
        throw new Error(msg);
      }

      await fetchAdmins();
    },
    [UPDATE_URL, user, fetchAdmins]
  );

  return { admins, loading, error, refreshAdmins: fetchAdmins, updatePermissions };
}
