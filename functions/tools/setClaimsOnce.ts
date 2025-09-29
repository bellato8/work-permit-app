import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) initializeApp();

async function main() {
  const uid = "zVhLu8Fe5qh6HQauJPBQJjgGdAp1"; // ใส่ UID ของบัญชีคุณ
  await getAuth().setCustomUserClaims(uid, {
    role: "superadmin",
    caps: { approve: true, decide: true, manage_requests: true },
  });
  console.log("✅ set claims done for uid:", uid);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
