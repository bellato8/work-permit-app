# 🔍 วิเคราะห์และแก้ไขปัญหา Backend Connection

**วันที่:** 30 ตุลาคม 2025
**โปรเจกต์:** Work Permit App (React + Firebase + Google Cloud Functions)
**ปัญหา:** localhost:5173 ไม่สามารถเรียกใช้ backend APIs ได้

---

## 📊 **สรุปสาเหตุหลัก (Root Cause Analysis)**

### ✅ **ปัญหาที่พบ:**

1. **ไม่มีไฟล์ Environment Configuration**
   - ❌ ไม่มีไฟล์ `.env.development` และ `.env.production` ใน `/web` directory
   - ✅ มีเพียง `.env.example` ซึ่งเป็นตัวอย่างเท่านั้น
   - **ผลกระทบ:** Vite ไม่สามารถโหลดค่า environment variables ได้ ทำให้:
     - Firebase config ไม่ถูกโหลด
     - API URLs ทั้งหมดเป็น `undefined`
     - Authentication ไม่ทำงาน

2. **ขาด API Endpoint URLs**
   - โค้ดต้องการ environment variables ดังนี้:
     ```
     VITE_GET_STATUS_URL
     VITE_GET_REQUEST_ADMIN_URL
     VITE_UPDATE_STATUS_URL
     VITE_LIST_REQUESTS_URL
     VITE_LIST_LOGS_URL
     VITE_LIST_ADMINS_URL
     VITE_ADD_ADMIN_URL
     VITE_REMOVE_ADMIN_URL
     VITE_UPDATE_ADMIN_ROLE_URL
     VITE_INVITE_ADMIN_URL
     VITE_DECISION_PORTAL_URL
     ```
   - **ผลกระทบ:** ทุกครั้งที่เรียก API จะได้ข้อผิดพลาด:
     - `Failed to fetch` (ไม่มี URL)
     - `CORS errors` (ถ้าใช้ URL ผิด)
     - `401 Unauthorized` (ถ้า Firebase Auth ไม่ทำงาน)

3. **ขาดการตั้งค่า Firebase Storage Bucket**
   - โค้ดใน `web/src/auth.ts:32` ต้องการ `VITE_FIREBASE_STORAGE_BUCKET_GS`
   - แต่ไม่มีในไฟล์ `.env.example`

---

## 🏗️ **โครงสร้างระบบ**

### **Environment ทั้ง 2 ชุด:**

| Environment | Firebase Project | Cloud Run ID | สถานะ |
|------------|------------------|--------------|-------|
| **Development** | `work-permit-app-dev` | `uwuxgoi2fa` | ใช้งานได้ |
| **Production** | `work-permit-app-1e9f0` | `aa5gfxjdmq` | ไม่ทราบ |

### **รูปแบบ Cloud Functions URLs:**

```
Development:  https://{function-name}-uwuxgoi2fa-as.a.run.app
Production:   https://{function-name}-aa5gfxjdmq-as.a.run.app
```

**ตัวอย่าง:**
- Dev: `https://getstatus-uwuxgoi2fa-as.a.run.app`
- Prod: `https://getstatus-aa5gfxjdmq-as.a.run.app`

### **Cloud Functions ที่มีทั้งหมด:**

จากไฟล์ `functions/src/index.ts`:

**Admin Management:**
- `listadmins`, `addadmin`, `removeadmin`
- `updateAdminRole`, `updateAdminPermissions`
- `inviteAdmin`

**Request Management:**
- `getStatus` - ตรวจสอบสถานะคำขอ (ไม่ต้อง auth)
- `getRequestAdmin` - ดูรายละเอียดคำขอ (ต้อง auth)
- `listRequests` - ดูรายการคำขอทั้งหมด
- `updateStatus` - อนุมัติ/ปฏิเสธคำขอ

**Daily Operations:**
- `getDailyWorkByDate`, `checkInRequest`, `checkOutRequest`, `getCalendarView`

**Logs:**
- `listLogs`, `deleteLogs`

**Triggers & Others:**
- `onRequestCreated`, `onRequestCreatedNotifyApprovers`, `onRequestUpdatedNotifyRequester`
- `createContractorLink`, `logAuth`, `ensureCreatedAt`

---

## ✅ **วิธีแก้ไข (Step-by-Step Solution)**

### **ขั้นตอนที่ 1: สร้างไฟล์ .env**

ผมสร้างไฟล์ให้แล้ว 2 ไฟล์:

1. **`/web/.env.development`** - สำหรับรัน `npm run dev` (localhost)
2. **`/web/.env.production`** - สำหรับรัน `npm run build` (deploy)

### **ขั้นตอนที่ 2: ตรวจสอบและแก้ไขค่า Firebase Config**

**สำหรับ Development Environment:**

```bash
cd web
```

แก้ไขไฟล์ `.env.development` ให้ใส่ค่า Firebase Config จาก Firebase Console:

```env
VITE_FIREBASE_API_KEY=YOUR_DEV_API_KEY_HERE
VITE_FIREBASE_APP_ID=YOUR_DEV_APP_ID_HERE
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_DEV_SENDER_ID_HERE
VITE_FIREBASE_MEASUREMENT_ID=YOUR_DEV_MEASUREMENT_ID_HERE
```

**วิธีหาค่า Firebase Config:**
1. เปิด [Firebase Console](https://console.firebase.google.com/)
2. เลือกโปรเจกต์ `work-permit-app-dev`
3. ไปที่ Project Settings > General > Your apps
4. เลือก Web app แล้วคัดลอกค่าต่างๆ มาใส่

**สำหรับ Production Environment:**

ไฟล์ `.env.production` ใส่ค่าไว้ให้แล้ว (จาก `.env.example`)

### **ขั้นตอนที่ 3: ทดสอบการเชื่อมต่อ Backend**

#### **3.1 ตรวจสอบว่า Cloud Functions ทำงานหรือไม่:**

**ทดสอบ Development:**
```bash
curl https://getstatus-uwuxgoi2fa-as.a.run.app
```

**ทดสอบ Production:**
```bash
curl https://getstatus-aa5gfxjdmq-as.a.run.app
```

**ผลที่คาดหวัง:** ได้ JSON response (แม้จะ error ก็ยังดีกว่า connection refused)

#### **3.2 ทดสอบ CORS:**

```bash
# ทดสอบจาก localhost
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://getstatus-uwuxgoi2fa-as.a.run.app -v
```

**ผลที่คาดหวัง:** เห็น headers `Access-Control-Allow-Origin: *` หรือ `http://localhost:5173`

### **ขั้นตอนที่ 4: รัน Development Server**

```bash
cd web
npm run dev
```

Vite จะอ่านค่าจาก `.env.development` โดยอัตโนมัติ

### **ขั้นตอนที่ 5: ตรวจสอบใน Browser Console**

เปิด Browser DevTools (F12) แล้วไปที่ Console Tab พิมพ์:

```javascript
// ตรวจสอบว่า environment variables โหลดหรือไม่
console.log('Firebase Project:', import.meta.env.VITE_FIREBASE_PROJECT_ID)
console.log('Get Status URL:', import.meta.env.VITE_GET_STATUS_URL)
console.log('Update Status URL:', import.meta.env.VITE_UPDATE_STATUS_URL)
```

**ผลที่คาดหวัง:** ต้องเห็นค่า URLs ไม่ใช่ `undefined`

---

## 🧪 **Testing Strategy (กลยุทธ์การทดสอบ)**

### **Level 1: ทดสอบ Environment Variables**

```bash
cd web
npm run dev
```

ใน Browser Console:
```javascript
console.table({
  'Site Name': import.meta.env.VITE_SITE_NAME,
  'Firebase Project': import.meta.env.VITE_FIREBASE_PROJECT_ID,
  'Get Status URL': import.meta.env.VITE_GET_STATUS_URL,
  'Firebase Auth Domain': import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
})
```

✅ **Pass:** เห็นค่าทั้งหมด ไม่มี `undefined`
❌ **Fail:** มีค่าเป็น `undefined` → ตรวจสอบไฟล์ `.env.development` อีกครั้ง

### **Level 2: ทดสอบ Firebase Authentication**

ใน Browser Console:
```javascript
// ทดสอบ Firebase init
import { auth } from './src/auth'
console.log('Firebase Auth:', auth)
console.log('Current User:', auth.currentUser)
```

✅ **Pass:** ไม่มี error, auth object ถูกสร้าง
❌ **Fail:** มี error เกี่ยวกับ Firebase config → ตรวจสอบค่า `VITE_FIREBASE_*`

### **Level 3: ทดสอบ API Calls**

**3.1 ทดสอบ Public API (ไม่ต้อง auth):**

```javascript
// ทดสอบ getStatus API
fetch('https://getstatus-uwuxgoi2fa-as.a.run.app?rid=TEST&last4=1234')
  .then(r => r.json())
  .then(d => console.log('API Response:', d))
  .catch(e => console.error('API Error:', e))
```

✅ **Pass:** ได้ JSON response (แม้จะ error ก็ถือว่าติดต่อได้)
❌ **Fail:** CORS error → ตรวจสอบ CORS config ใน Cloud Functions

**3.2 ทดสอบ Authenticated API:**

```javascript
// ต้อง login ก่อน
import { auth } from './src/auth'
import { signInAnonymously } from 'firebase/auth'

// Login
await signInAnonymously(auth)

// ได้ token
const token = await auth.currentUser.getIdToken()
console.log('ID Token:', token.substring(0, 50) + '...')

// ทดสอบเรียก API
fetch('https://listrequests-uwuxgoi2fa-as.a.run.app', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
  .then(r => r.json())
  .then(d => console.log('Authenticated API Response:', d))
  .catch(e => console.error('Auth API Error:', e))
```

✅ **Pass:** ได้ข้อมูลกลับมา
❌ **Fail:** 401 Unauthorized → ตรวจสอบ Firebase Authentication settings

### **Level 4: ทดสอบผ่าน UI**

1. **ทดสอบหน้า Status Check** (Public - ไม่ต้อง login)
   - ไปที่ `/status`
   - ใส่ RID และเบอร์โทร 4 ตัวท้าย
   - กด "ตรวจสอบสถานะ"
   - ✅ **Pass:** ได้ผลลัพธ์ (แม้จะ "ไม่พบข้อมูล" ก็ถือว่า API ทำงาน)

2. **ทดสอบหน้า Admin** (ต้อง login)
   - ไปที่ `/admin`
   - Login ด้วย Firebase Auth
   - ดูรายการคำขอ
   - ✅ **Pass:** เห็นรายการหรือ "ไม่มีข้อมูล"
   - ❌ **Fail:** "ยังตั้งค่า URL/KEY ไม่ครบ" → ตรวจสอบ `.env.development`

---

## 🎯 **คำแนะนำเพิ่มเติม**

### **1. Development vs Production**

| สถานการณ์ | ใช้ Environment | คำสั่ง |
|-----------|----------------|--------|
| พัฒนาบนเครื่อง (localhost) | Development | `npm run dev` |
| Build เพื่อ deploy | Production | `npm run build` |
| ทดสอบ production build | Production | `npm run preview` |

### **2. การจัดการ Environment Variables**

**ไฟล์ที่ Vite โหลด:**
- `npm run dev` → โหลด `.env.development` (ถ้ามี) และ `.env.local` (ถ้ามี)
- `npm run build` → โหลด `.env.production` (ถ้ามี) และ `.env.local` (ถ้ามี)

**ลำดับความสำคัญ:**
```
.env.local > .env.development > .env
```

**⚠️ คำเตือน:**
- ห้าม commit `.env.local` ใน git (มี sensitive data)
- `.env.development` และ `.env.production` สามารถ commit ได้ (ถ้าไม่มี secrets)

### **3. CORS Configuration**

ถ้ายังเจอ CORS errors ให้ตรวจสอบ:

**ในไฟล์ Cloud Functions:**
- `functions/src/corsOrigins.ts` - ต้องมี `http://localhost:5173` ในรายการ allowed origins
- ตรวจสอบว่า CORS middleware ถูก apply ในทุก function

**ตัวอย่างใน Cloud Functions:**
```typescript
// functions/src/corsOrigins.ts
export const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'https://work-permit-app-dev.web.app',
  'https://work-permit-app-1e9f0.web.app',
]
```

### **4. Fallback Strategy**

โค้ดมี fallback ไปยัง Local Storage (ตาม `web/src/lib/validateEnv.ts`):

```javascript
// วิธีตั้งค่าชั่วคราวใน Browser Console (สำหรับทดสอบ)
localStorage.setItem('approver_key', 'dev-key-2025')
localStorage.setItem('list_url', 'https://listrequests-uwuxgoi2fa-as.a.run.app')
```

แต่วิธีนี้ไม่แนะนำสำหรับ production ควรใช้ `.env` files เท่านั้น

---

## 🐛 **Common Issues & Solutions**

### **Issue 1: "VITE_XXX is undefined"**

**สาเหตุ:** Vite ไม่โหลด .env file

**วิธีแก้:**
1. ตรวจสอบว่าไฟล์อยู่ใน `/web/.env.development` (ไม่ใช่ root)
2. รีสตาร์ท dev server: `Ctrl+C` แล้ว `npm run dev` ใหม่
3. Clear browser cache และรีโหลด

### **Issue 2: "CORS policy error"**

**สาเหตุ:** Cloud Functions ไม่อนุญาต origin จาก localhost

**วิธีแก้:**
1. ตรวจสอบ `functions/src/corsOrigins.ts`
2. เพิ่ม `http://localhost:5173` ถ้ายังไม่มี
3. Deploy functions ใหม่: `firebase deploy --only functions`

### **Issue 3: "401 Unauthorized"**

**สาเหตุ:** Firebase Authentication ไม่ทำงาน หรือ token ไม่ valid

**วิธีแก้:**
1. ตรวจสอบว่า login แล้ว: `console.log(auth.currentUser)`
2. ตรวจสอบว่า anonymous auth เปิดใช้งานใน Firebase Console
3. รีเฟรช token: `await auth.currentUser.getIdToken(true)`

### **Issue 4: "Failed to fetch"**

**สาเหตุ:** Network error หรือ URL ผิด

**วิธีแก้:**
1. ตรวจสอบ URL ใน .env file
2. ทดสอบ URL ใน browser หรือ curl
3. ตรวจสอบ internet connection

---

## 📝 **Checklist สำหรับผู้ใช้**

### **สำหรับ Development (localhost:5173):**

- [ ] สร้างไฟล์ `/web/.env.development`
- [ ] ใส่ Firebase Config สำหรับ `work-permit-app-dev`
- [ ] ใส่ Cloud Functions URLs (uwuxgoi2fa)
- [ ] รีสตาร์ท dev server
- [ ] ตรวจสอบ console ว่าไม่มี "undefined"
- [ ] ทดสอบเรียก API
- [ ] ตรวจสอบ CORS

### **สำหรับ Production:**

- [ ] ตรวจสอบไฟล์ `/web/.env.production`
- [ ] ยืนยัน Firebase Config สำหรับ `work-permit-app-1e9f0`
- [ ] ยืนยัน Cloud Functions URLs (aa5gfxjdmq)
- [ ] ทดสอบ build: `npm run build`
- [ ] ทดสอบ preview: `npm run preview`
- [ ] Deploy: `firebase deploy`

---

## 📚 **เอกสารอ้างอิง**

- Vite Environment Variables: https://vitejs.dev/guide/env-and-mode.html
- Firebase Web Setup: https://firebase.google.com/docs/web/setup
- Cloud Functions: https://firebase.google.com/docs/functions
- Cloud Run: https://cloud.google.com/run/docs

---

**สรุป:** ปัญหาหลักคือ **ขาดไฟล์ .env** ทำให้ระบบไม่รู้ว่าจะเชื่อมต่อ backend ที่ไหน และ Firebase config ไม่ถูกโหลด ตอนนี้สร้างไฟล์ให้แล้ว ต้องแก้ไขค่า Firebase config สำหรับ development environment แล้วทดสอบตาม checklist ด้านบน
