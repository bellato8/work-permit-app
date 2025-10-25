# คู่มือ Deploy ระบบ RBAC ใหม่

**วันที่:** 25 ตุลาคม 2025  
**Branch:** `feature/rbac-improvements`  
**Pull Request:** https://github.com/bellato8/work-permit-app/pull/1

---

## 🎯 สิ่งที่ต้องทำ

เพื่อให้ระบบ RBAC ใหม่ทำงานได้อย่างสมบูรณ์ คุณต้อง **Deploy ทั้ง Frontend และ Backend**

---

## 🚀 วิธี Deploy (สำหรับ Windows PowerShell)

### ขั้นตอนที่ 1: Pull โค้ดล่าสุด

```powershell
cd D:\work-permit-app
git fetch origin
git checkout feature/rbac-improvements
git pull origin feature/rbac-improvements
```

---

### ขั้นตอนที่ 2: Build และ Deploy Functions (Backend)

```powershell
# เข้าโฟลเดอร์ functions
cd functions

# ติดตั้ง dependencies
npm install

# Build TypeScript
npm run build

# กลับไปที่ root
cd ..

# Deploy Functions
firebase deploy --only functions
```

**หมายเหตุ:**
- ถ้าเจอ error เกี่ยวกับ Node version ไม่ต้องกังวล (แค่ warning)
- ถ้า `firebase` command ไม่รู้จัก → ติดตั้งด้วย `npm install -g firebase-tools`

---

### ขั้นตอนที่ 3: Build และ Deploy Hosting (Frontend)

```powershell
# เข้าโฟลเดอร์ web
cd web

# ติดตั้ง dependencies
npm install

# Build production
npm run build

# กลับไปที่ root
cd ..

# Deploy Hosting
firebase deploy --only hosting
```

---

### ขั้นตอนที่ 4: Deploy ทั้งหมดพร้อมกัน (แนะนำ)

```powershell
# ที่ root ของโปรเจกต์
cd D:\work-permit-app

# Deploy ทั้งหมด (ใช้เครื่องหมาย " ครอบ)
firebase deploy --only "functions,hosting"
```

**สำคัญ!** ใน PowerShell ต้องใช้ `"functions,hosting"` (มี quotes) ไม่งั้นจะ error

---

## ✅ ตรวจสอบผลลัพธ์

### 1. เช็ค Functions Deploy สำเร็จ

```powershell
firebase functions:list
```

ควรเห็น:
- `getRequestAdmin`
- `updateStatus`
- ฟังก์ชันอื่นๆ

### 2. เช็ค Hosting Deploy สำเร็จ

เปิดเว็บไซต์ของคุณ (เช่น `https://work-permit-app-1e9f0.web.app`)

---

## 🧪 ทดสอบระบบ

### Test Case 1: Approver เข้าดู Permit

1. Login ด้วย `iwp082025@gmail.com` (Approver)
2. เข้า Dashboard
3. คลิกดู Permit ใดๆ
4. **ผลลัพธ์ที่คาดหวัง:**
   - ✅ เข้าดูได้ (ไม่เกิด Error 403)
   - ✅ เห็นปุ่ม "อนุมัติ" และ "ไม่อนุมัติ"

### Test Case 2: Viewer เข้าดู Permit

1. Login ด้วยบัญชี Viewer
2. เข้า Dashboard
3. คลิกดู Permit ใดๆ
4. **ผลลัพธ์ที่คาดหวัง:**
   - ✅ เข้าดูได้
   - ✅ **ไม่เห็น**ปุ่ม "อนุมัติ" และ "ไม่อนุมัติ"
   - ✅ เห็นข้อความ "คุณมีสิทธิ์ดูอย่างเดียว"

### Test Case 3: Admin เข้าเมนู

1. Login ด้วยบัญชี Admin
2. เช็คเมนูด้านซ้าย
3. **ผลลัพธ์ที่คาดหวัง:**
   - ✅ เห็นเมนู: Dashboard, Permits, Approvals, Daily Work, Reports, Settings
   - ✅ **ไม่เห็น**เมนู: Users, Cleanup, Logs

---

## 🔧 แก้ปัญหาที่พบบ่อย

### 1. Error: `firebase: command not found`

**วิธีแก้:**
```powershell
npm install -g firebase-tools
firebase login
```

### 2. Error: `The token '&&' is not a valid statement separator`

**วิธีแก้:**
- ใช้ `;` แทน `&&` ใน PowerShell
- หรือรันทีละคำสั่ง

### 3. Error: `User code failed to load`

**วิธีแก้:**
```powershell
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### 4. Frontend ไม่อัพเดต

**วิธีแก้:**
- Clear cache ของ browser (Ctrl + Shift + Delete)
- Hard refresh (Ctrl + F5)
- ลอง Incognito mode

### 5. ยัง Error 403 อยู่

**วิธีแก้:**
- เช็คว่า Functions deploy สำเร็จหรือยัง
- เช็ค Firebase Console → Functions → Logs
- ลอง logout แล้ว login ใหม่ (เพื่อ refresh token)

---

## 📊 สิ่งที่เปลี่ยนแปลง

### Frontend
- ✅ เมนูจะถูกกรองตามสิทธิ์
- ✅ ปุ่มอนุมัติ/ไม่อนุมัติจะถูกซ่อนสำหรับ Viewer
- ✅ ข้อความแจ้งเตือนสวยงามขึ้น

### Backend
- ✅ รองรับ `pagePermissions` แบบใหม่
- ✅ Fallback ไปใช้ `caps` แบบเก่าถ้าไม่มี `pagePermissions`
- ✅ แก้ปัญหา Error 403 สำหรับ Approver

### Database
- ✅ **ไม่ต้องแก้ไขอะไร!** ข้อมูลใน Firestore ถูกต้องอยู่แล้ว

---

## 🎉 หลัง Deploy สำเร็จ

1. ✅ Merge Pull Request: https://github.com/bellato8/work-permit-app/pull/1
2. ✅ ลบ branch `feature/rbac-improvements` (ถ้าต้องการ)
3. ✅ แจ้งทีมให้ทดสอบระบบ
4. ✅ Monitor Firebase Console → Functions → Logs เป็นเวลา 1-2 วัน

---

## 📞 ติดปัญหา?

1. เช็ค Firebase Console → Functions → Logs
2. เช็ค Browser Console (F12 → Console tab)
3. เช็ค Network tab (F12 → Network) ดู HTTP status code
4. ส่ง screenshot มาใน GitHub Issue

---

## 📚 เอกสารเพิ่มเติม

- `RBAC_QUICK_START.md` - คู่มือเริ่มต้นใช้งาน
- `RBAC_FINAL_REPORT.md` - รายงานสรุป Frontend
- `BACKEND_RBAC_CHANGES.md` - รายงานสรุป Backend
- `FIRESTORE_CHECK_RESULT.md` - ผลการตรวจสอบฐานข้อมูล

---

**ผู้จัดทำ:** Manus AI Agent  
**สถานะ:** ✅ พร้อม Deploy  
**วันที่:** 25 ตุลาคม 2025

---

## 🎯 Checklist สำหรับ Deploy

- [ ] Pull โค้ดล่าสุดจาก branch `feature/rbac-improvements`
- [ ] Build Functions (`cd functions && npm install && npm run build`)
- [ ] Build Web (`cd web && npm install && npm run build`)
- [ ] Deploy Functions (`firebase deploy --only functions`)
- [ ] Deploy Hosting (`firebase deploy --only hosting`)
- [ ] ทดสอบ Approver เข้าดู Permit
- [ ] ทดสอบ Viewer เข้าดู Permit (ไม่เห็นปุ่มอนุมัติ)
- [ ] ทดสอบ Admin เช็คเมนู
- [ ] Monitor Logs เป็นเวลา 1-2 วัน
- [ ] Merge Pull Request
- [ ] แจ้งทีม

---

**ขอให้ Deploy สำเร็จ!** 🚀

