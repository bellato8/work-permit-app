import React, { useEffect, useRef } from "react";

/** ปรับความเร็ว/แรงดึง ให้ช้าลงนุ่มขึ้น */
const CONFIG = {
  COUNT: 80,
  SPEED: 0.08,            // เดิมเร็วกว่านี้ -> ลดให้เคลื่อนช้าลง
  LINK_DIST: 150,
  POINTER_FORCE: 0.05,    // แรงดึงจากเมาส์ เบาลง
  POINTER_STICK: 0.92,    // ค่าลดแรง (decay) สูงขึ้น = เกาะนานขึ้น ปล่อยช้าลง
  THICKNESS: 0.9,
  COLOR: "rgba(61, 92, 184, 0.45)" // ฟ้าอ่อนสุภาพ
};

type P = { x: number; y: number; vx: number; vy: number };

export default function PlexusBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const mouse = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);

    let points: P[] = Array.from({ length: CONFIG.COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * CONFIG.SPEED,
      vy: (Math.random() - 0.5) * CONFIG.SPEED
    }));

    const onResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      mouse.current.vx += (nx - mouse.current.x) * CONFIG.POINTER_FORCE;
      mouse.current.vy += (ny - mouse.current.y) * CONFIG.POINTER_FORCE;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const frame = () => {
      // อัปเดตตำแหน่ง mouse แบบ “เกาะ” แล้วค่อย ๆ คลาย
      mouse.current.x += mouse.current.vx;
      mouse.current.y += mouse.current.vy;
      mouse.current.vx *= CONFIG.POINTER_STICK;
      mouse.current.vy *= CONFIG.POINTER_STICK;

      ctx.clearRect(0, 0, w, h);

      // อัปเดตจุด
      for (const p of points) {
        // แรงดึงเล็ก ๆ เข้าหาเมาส์
        const dx = mouse.current.x - p.x;
        const dy = mouse.current.y - p.y;
        p.vx += dx * CONFIG.POINTER_FORCE * 0.0006;
        p.vy += dy * CONFIG.POINTER_FORCE * 0.0006;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;

        // ขอบ
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // วาดเส้น
      ctx.lineWidth = CONFIG.THICKNESS;
      ctx.strokeStyle = CONFIG.COLOR;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i], b = points[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < CONFIG.LINK_DIST) {
            ctx.globalAlpha = 1 - d / CONFIG.LINK_DIST;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div className="absolute inset-0 -z-10">
      <canvas ref={ref} className="w-full h-full block" />
    </div>
  );
}
