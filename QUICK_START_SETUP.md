# ⚡ คู่มือตั้งค่าด่วน (Quick Start Setup)

**อัปเดต:** 30 ตุลาคม 2025
**สำหรับ:** แก้ปัญหา localhost:5173 เชื่อมต่อ backend ไม่ได้

---

## 🎯 **สรุป 3 ขั้นตอนหลัก**

### **ขั้นตอนที่ 1: แก้ไขไฟล์ .env.development**

```bash
cd web
```

แก้ไขไฟล์ `web/.env.development` ให้ใส่ค่า Firebase Config จริงสำหรับ Development:

```env
# ⚠️ ต้องแก้ไข 4 ค่านี้
VITE_FIREBASE_API_KEY=YOUR_DEV_API_KEY_HERE
VITE_FIREBASE_APP_ID=YOUR_DEV_APP_ID_HERE
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_DEV_SENDER_ID_HERE
VITE_FIREBASE_MEASUREMENT_ID=YOUR_DEV_MEASUREMENT_ID_HERE
```

**วิธีหาค่า:**
1. เปิด [Firebase Console](https://console.firebase.google.com/)
2. เลือกโปรเจกต์ `work-permit-app-dev`
3. Project Settings > General > Your apps > Web app
4. คัดลอกค่ามาใส่

### **ขั้นตอนที่ 2: รีสตาร์ท Dev Server**

```bash
# กด Ctrl+C เพื่อหยุด server (ถ้ารันอยู่)
npm run dev
```

### **ขั้นตอนที่ 3: ตรวจสอบใน Browser**

เปิด `http://localhost:5173` แล้วกด F12 (DevTools) ไปที่ Console พิมพ์:

```javascript
console.table({
  'Firebase Project': import.meta.env.VITE_FIREBASE_PROJECT_ID,
  'Get Status URL': import.meta.env.VITE_GET_STATUS_URL,
  'Update Status URL': import.meta.env.VITE_UPDATE_STATUS_URL,
})
```

✅ **ถ้าเห็นค่าทั้งหมด (ไม่มี undefined)** = สำเร็จ!

---

## 🧪 **ทดสอบว่าใช้งานได้**

### **Test 1: ทดสอบ API ตรงๆ**

ใน Browser Console:

```javascript
// ทดสอบ getStatus API (ไม่ต้อง login)
fetch('https://getstatus-uwuxgoi2fa-as.a.run.app?rid=TEST&last4=1234')
  .then(r => r.json())
  .then(d => console.log('✅ API works:', d))
  .catch(e => console.error('❌ API error:', e))
```

### **Test 2: ทดสอบผ่าน UI**

1. ไปที่ `/status`
2. ใส่ RID และเบอร์โทร
3. กดตรวจสอบ
4. ✅ ควรได้ผลลัพธ์ (แม้จะ "ไม่พบข้อมูล" ก็ถือว่าทำงาน)

---

## 🐛 **แก้ปัญหาด่วน**

### **ปัญหา: ยังเห็น "undefined"**

**วิธีแก้:**
```bash
# 1. ตรวจสอบไฟล์อยู่ที่ถูกต้อง
ls -la web/.env.development

# 2. รีสตาร์ท dev server
cd web
# กด Ctrl+C
npm run dev
```

### **ปัญหา: CORS error**

**ตรวจสอบ:**
```bash
# ทดสอบว่า Cloud Functions ตอบหรือไม่
curl https://getstatus-uwuxgoi2fa-as.a.run.app
```

ถ้าได้ JSON response แต่ยังมี CORS error:
- ตรวจสอบ `functions/src/corsOrigins.ts`
- ต้องมี `http://localhost:5173` ในรายการ

### **ปัญหา: 401 Unauthorized**

**วิธีแก้:**
1. ตรวจสอบว่า login แล้ว
2. เปิด Anonymous Auth ใน Firebase Console:
   - Authentication > Sign-in method
   - เปิด "Anonymous"

---

## 📝 **Checklist**

- [ ] แก้ไขไฟล์ `web/.env.development`
- [ ] ใส่ Firebase Config จริง (4 ค่า)
- [ ] รีสตาร์ท dev server
- [ ] ตรวจสอบ console ไม่มี "undefined"
- [ ] ทดสอบ API (Test 1)
- [ ] ทดสอบ UI (Test 2)

---

## 💡 **เคล็ดลับ**

### **ต้องการใช้ Production แทน Development?**

แก้ไขไฟล์ `.env.development` เปลี่ยน URLs จาก `uwuxgoi2fa` เป็น `aa5gfxjdmq`:

```env
# Production URLs
VITE_GET_STATUS_URL=https://getstatus-aa5gfxjdmq-as.a.run.app
VITE_UPDATE_STATUS_URL=https://updatestatus-aa5gfxjdmq-as.a.run.app
# ... (เปลี่ยนทุก URL)
```

### **ไฟล์สำคัญที่ต้องรู้จัก**

| ไฟล์ | ใช้เมื่อไหร่ | Vite โหลดเมื่อ |
|------|--------------|----------------|
| `.env.development` | รัน `npm run dev` | Development mode |
| `.env.production` | รัน `npm run build` | Production build |
| `.env.local` | Override ค่าชั่วคราว | ทุก mode |

---

## 📚 **เอกสารเพิ่มเติม**

- **วิเคราะห์ปัญหาแบบละเอียด:** อ่าน `BACKEND_CONNECTION_ANALYSIS.md`
- **Vite Env Docs:** https://vitejs.dev/guide/env-and-mode.html

---

**หมายเหตุ:** ถ้ายังมีปัญหา ให้ดูเอกสารวิเคราะห์แบบละเอียดใน `BACKEND_CONNECTION_ANALYSIS.md`
