// ======================================================================
// File: web/src/pages/Landing.tsx
// Purpose: Splash/Loading แสดงความคืบหน้า แล้วพาไปหน้า /rules อัตโนมัติ
// Notes:
//  - รองรับ ARIA progressbar + aria-live
//  - มีปุ่ม "ไปต่อเลย" เพื่อข้ามการรอ
//  - เคารพ prefers-reduced-motion (ลดแอนิเมชันอัตโนมัติ)
//  - ไม่พึ่งไลบรารีเพิ่มเติม (CSS Module เท่านั้น)
// Updated: 2025-10-13
// ======================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Landing.module.css";

const REDIRECT_DELAY_MS = 1600; // หน่วงสั้นๆ ให้รู้สึก “กำลังพาไป...”
const TICK_MS = 20;             // ความถี่อัปเดตแถบโหลด

export default function Landing() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const jumpedRef = useRef(false);

  // ช่วยคำนวณก้าวเพิ่มต่อ tick ให้วิ่งทันเวลาเป้าหมาย
  const step = useMemo(() => {
    const ticks = Math.max(1, Math.floor(REDIRECT_DELAY_MS / TICK_MS));
    return 100 / ticks;
  }, []);

  // ตัวจับเวลา: เพิ่มเปอร์เซ็นต์ และนำทางเมื่อครบเวลา
  useEffect(() => {
    const inc = setInterval(() => {
      setProgress((p) => Math.min(100, p + step));
    }, TICK_MS);

    const timer = setTimeout(() => {
      if (!jumpedRef.current) {
        jumpedRef.current = true;
        navigate("/rules", { replace: true });
      }
    }, REDIRECT_DELAY_MS);

    return () => {
      clearInterval(inc);
      clearTimeout(timer);
    };
  }, [navigate, step]);

  const skipNow = () => {
    if (!jumpedRef.current) {
      jumpedRef.current = true;
      navigate("/rules", { replace: true });
    }
  };

  return (
    <div className={styles.shell}>
      {/* พื้นหลังแบบนุ่มหรู + เคารพ reduced motion */}
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.blobA} />
        <div className={styles.blobB} />
      </div>

      <main className={styles.card} role="dialog" aria-label="กำลังโหลด">
        <header className={styles.header}>
          <div className={styles.badge}>Imperial World Asia</div>
          <h1 className={styles.title}>Work Permit App</h1>
          <p className={styles.subtitle} id="status" aria-live="polite">
            กำลังพาไปยัง “กฎระเบียบการเข้าพื้นที่” …
          </p>
        </header>

        <div
          className={styles.progress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-labelledby="status"
        >
          <div className={styles.bar} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.actions}>
          <button className={styles.primary} onClick={skipNow}>
            ไปต่อเลย
          </button>
          <span className={styles.hint}>
            ถ้ารอเกิน 2 วินาที คลิก “ไปต่อเลย”
          </span>
        </div>
      </main>
    </div>
  );
}
