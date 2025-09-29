// web/src/lib/authLogger.ts
// ยิง logAuth: login/logout → audit_logs (ผ่าน Cloud Function 'logAuth')

import { getAuth, onAuthStateChanged } from "firebase/auth";

const LOG_URL = import.meta.env.VITE_LOG_AUTH_URL as string;
const APPROVER_KEY = import.meta.env.VITE_APPROVER_KEY as string;

// กันยิงซ้ำในแท็บเดียว
const KEY = "wp.logged-uid";

async function post(action: "login" | "logout", body: Record<string, any>) {
  if (!LOG_URL) return;
  try {
    await fetch(LOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": APPROVER_KEY || "",
      },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    // เงียบไว้ ไม่รบกวน UX
  }
}

export function startAuthLogging() {
  const auth = getAuth();

  onAuthStateChanged(auth, async (user) => {
    const prev = sessionStorage.getItem(KEY);

    // user เข้าสู่ระบบ
    if (user && prev !== user.uid) {
      await post("login", {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
      sessionStorage.setItem(KEY, user.uid);
      return;
    }

    // user ออกจากระบบ (หรือ token หมดอายุ)
    if (!user && prev) {
      await post("logout", { uid: prev });
      sessionStorage.removeItem(KEY);
    }
  });
}
