import React, { useEffect, useRef } from "react";

/** ใยแมงมุมแบบเบาเครื่อง: จุด ~120 จุด ลากเส้นเมื่ออยู่ใกล้กัน และดูดตามเมาส์อย่างนุ่มนวล */
export default function PlexusBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let mouse = { x: innerWidth * 0.65, y: innerHeight * 0.35 };
    let target = { ...mouse };
    const N = 120;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3
    }));

    const resize = () => { c.width = innerWidth; c.height = innerHeight; };
    const onMouse = (e: MouseEvent) => { target = { x: e.clientX, y: e.clientY }; };
    addEventListener("resize", resize);
    addEventListener("mousemove", onMouse);
    resize();

    let raf = 0;
    const loop = () => {
      // ไล่เมาส์แบบ ease
      mouse.x += (target.x - mouse.x) * 0.06;
      mouse.y += (target.y - mouse.y) * 0.06;

      // พื้นหลังฟ้าอ่อน
      const g = ctx.createLinearGradient(0, 0, 0, c.height);
      g.addColorStop(0, "#eef3ff");
      g.addColorStop(1, "#ffffff");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);

      // อัปเดตจุด
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        // ขอบจอสะท้อนกลับ
        if (p.x < 0 || p.x > c.width) p.vx *= -1;
        if (p.y < 0 || p.y > c.height) p.vy *= -1;

        // แรงดึงเข้าหาเมาส์เล็กน้อย
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        const pull = Math.min(0.0006 * dist, 0.06);
        p.vx += dx * pull * 0.001;
        p.vy += dy * pull * 0.001;
      }

      // วาดเส้นเชื่อม (ใยแมงมุม)
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i], b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx*dx + dy*dy;
          if (d2 < 180*180) {
            const alpha = 1 - d2 / (180*180);
            ctx.strokeStyle = `rgba(80,100,200,${0.35 * alpha})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // วาดโหนด
      ctx.fillStyle = "rgba(90,110,210,0.8)";
      for (const p of pts) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); removeEventListener("mousemove", onMouse); };
  }, []);

  return <canvas ref={ref} className="fixed inset-0 -z-10" aria-hidden />;
}
