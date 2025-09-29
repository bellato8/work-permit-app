# Work Permit Web — Minimal Starter (Vite + React + Firebase init)

## วิธีเริ่ม (ครั้งแรก)
1) แตกไฟล์นี้ไปไว้ในโฟลเดอร์โปรเจกต์คุณ (หรือแทนที่โฟลเดอร์ `web/` เดิม)
2) ก็อปปี้ไฟล์ `.env.local.example` เป็น `.env.local` แล้วใส่ค่าจริงของ Firebase
3) ติดตั้งแพ็กเกจ:
   ```bash
   npm i
   ```
4) รัน dev:
   ```bash
   npm run dev
   ```

## โครงสร้าง
- `src/lib/firebase.ts` — จุด init Firebase **เพียงไฟล์เดียว**
- Routing อยู่ที่ `src/main.tsx` + `src/App.tsx`
- หน้าเดโม่: `/`, `/apply`, `/status`

> ขั้นต่อไป: แม็ปฟิลด์จาก PDF → เชื่อม Firestore/Storage และทำระบบอนุมัติ/อีเมลแจ้งเตือน