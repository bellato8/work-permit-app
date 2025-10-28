# 🚀 Dev Environment Setup Guide

**Development URL:** https://work-permit-app-dev.web.app
**Firebase Project:** work-permit-app-1e9f0

---

## 📋 ขั้นตอนการ Setup (ทำครั้งแรก)

### 1️⃣ Clone โปรเจกต์

```bash
cd D:\
git clone <repository-url> work-permit-app-dev
cd work-permit-app-dev
git checkout claude/lp-locations-crud-011CUXeg7PC75LQGsr9Kca5r
```

### 2️⃣ ติดตั้ง Dependencies

```bash
# Web dependencies
cd web
npm install

# Functions dependencies
cd ../functions
npm install

# กลับมาที่ root
cd ..
```

### 3️⃣ Setup Environment Variables

#### A. Web Environment (ใช้ไฟล์ที่สร้างไว้แล้ว)

ไฟล์ `web/.env.development` มีอยู่แล้ว ✅

**หากต้องการแก้ไข:** เปิดไฟล์ `web/.env.development` และตรวจสอบว่าค่าต่าง ๆ ถูกต้อง

#### B. Functions Environment

สร้างไฟล์ `functions/.env`:

```bash
# คัดลอกจาก template
copy functions\.env.example functions\.env
```

แก้ไขไฟล์ `functions/.env`:

```bash
# Cloud Functions Region (ต้องตรงกับ VITE_FUNCTIONS_REGION)
FUNCTIONS_REGION=asia-southeast1

# Base URL สำหรับ Contractor Form
CONTRACTOR_FORM_BASE_URL=https://work-permit-app-dev.web.app/contractor/form
```

---

## 🔥 Deploy ไป Firebase Dev

### 1️⃣ Login Firebase CLI

```bash
firebase login
```

### 2️⃣ เลือก Project

```bash
firebase use work-permit-app-1e9f0
```

หรือถ้ายังไม่มี alias:

```bash
firebase use --add
# เลือก work-permit-app-1e9f0
# ตั้งชื่อ alias: dev
```

### 3️⃣ Deploy Cloud Functions

```bash
firebase deploy --only functions
```

**Functions ที่จะ deploy:**
- ✅ createContractorLink - สร้าง RID และเปลี่ยนสถานะ
- ✅ mockPermitSubmitted - จำลองผู้รับเหมาส่งฟอร์ม
- ✅ (และ functions อื่น ๆ ที่มีอยู่แล้ว)

### 4️⃣ Deploy Firestore Rules

สร้างไฟล์ `firestore.rules` (ถ้ายังไม่มี):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSuperAdmin() {
      return request.auth != null &&
             (request.auth.token.isSuperadmin == true ||
              request.auth.token.role == 'superadmin');
    }

    function isLPAdmin() {
      return request.auth != null &&
             (request.auth.token.lpAdmin == true ||
              request.auth.token.role == 'lpAdmin' ||
              request.auth.token.role == 'lp_admin' ||
              isSuperAdmin());
    }

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // Artifacts Pattern
    match /artifacts/{appId} {

      // Public Data (อ่านได้ทุกคน แต่แก้ไขได้เฉพาะ LP Admin)
      match /public/data/{document=**} {
        allow read: if request.auth != null;
        allow write: if isLPAdmin();
      }

      // User-specific data
      match /users/{userId}/{document=**} {
        allow read: if isOwner(userId) || isLPAdmin();
        allow create, update: if isOwner(userId);
        allow delete: if isOwner(userId) || isLPAdmin();
      }

      // Private System Data (Server-side only)
      match /private/{document=**} {
        allow read, write: if false;
      }
    }

    // Default: ปฏิเสธทั้งหมด
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy:

```bash
firebase deploy --only firestore:rules
```

### 5️⃣ Build และ Deploy Web App

```bash
# Build
cd web
npm run build

# กลับมา root
cd ..

# Deploy hosting
firebase deploy --only hosting
```

---

## 👤 สร้าง Superadmin (ครั้งแรก)

### วิธีที่ 1: ใช้ Firebase Console (ง่ายที่สุด)

1. เปิด [Firebase Console](https://console.firebase.google.com/project/work-permit-app-1e9f0/authentication/users)
2. สร้าง user ใหม่ (email/password)
3. คัดลอก UID ของ user
4. ไปที่ Cloud Firestore → เพิ่ม document ใน collection `_admin_metadata`:
   ```
   Collection: _admin_metadata
   Document ID: <USER_UID>
   Fields:
     role: "superadmin"
     isSuperadmin: true
     isAdmin: true
     lpAdmin: true
   ```

### วิธีที่ 2: ใช้ Script

```bash
# สร้าง script ชั่วคราว
node scripts/setSuperadmin.js admin@example.com
```

**หมายเหตุ:** Script จะต้องมี Firebase credentials ที่ถูกต้อง

---

## 🌱 Seed ข้อมูลเริ่มต้น

### 1. Seed Locations (สถานที่)

แก้ไขไฟล์ `scripts/seedLocations.js` ให้เชื่อมต่อกับ Firebase จริง:

```javascript
// เพิ่มที่บรรทัดต้น (แทน Emulator connection)
const admin = require('firebase-admin');

// Initialize Firebase Admin (ใช้ default credentials หรือ service account)
admin.initializeApp({
  projectId: 'work-permit-app-1e9f0'
});

const db = admin.firestore();
// ... ส่วนที่เหลือเหมือนเดิม
```

รัน:
```bash
node scripts/seedLocations.js
```

### 2. Seed Internal Users

แก้ไขไฟล์ `scripts/seedInternalUsers.js` เช่นเดียวกัน แล้วรัน:

```bash
node scripts/seedInternalUsers.js
```

---

## 🧪 ทดสอบ Workflow

### 1. เปิดเว็บ Dev

```
https://work-permit-app-dev.web.app
```

### 2. ทดสอบ Internal Portal

**Login:**
```
URL: https://work-permit-app-dev.web.app/internal/login
Email: somchai@company.com (จาก seed script)
Password: <password-ที่ตั้ง>
```

**สร้างคำขอ:**
1. กด "+" Floating Action Button
2. เลือกสถานที่ + ชั้น
3. กรอกรายละเอียด
4. ส่งคำขอ

### 3. ทดสอบ LP Admin Portal

**Login:**
```
URL: https://work-permit-app-dev.web.app/admin/lp/login
Email: admin@example.com (superadmin)
Password: <password-ที่ตั้ง>
```

**ทดสอบฟีเจอร์:**
- ✅ Locations CRUD
- ✅ Internal Users CRUD
- ✅ Internal Requests Queue
- ✅ Permit Approvals

### 4. ทดสอบ Cloud Functions

**อนุมัติเบื้องต้น:**
1. ไปที่ Internal Requests Queue
2. กดปุ่ม "อนุมัติเบื้องต้น"
3. ควรเห็น Alert แสดง RID (เช่น INT-2025-0001)

**จำลองผู้รับเหมาส่งฟอร์ม:**
- ใช้ script: `node scripts/testMockPermitSubmitted.js INT-2025-0001`
- หรือเรียก function ผ่าน Firebase Console

---

## 📊 ตรวจสอบข้อมูลใน Firestore

เปิด [Firestore Console](https://console.firebase.google.com/project/work-permit-app-1e9f0/firestore/data)

**Collections ที่ควรมี:**

```
artifacts/
  work-permit-app-1e9f0/
    public/
      data/
        locations/           ← สถานที่
          {docId}
        users_internal/      ← พนักงานภายใน
          {docId}
    users/
      {userId}/
        internal_requests/   ← คำขอของแต่ละคน
          {docId}
    private/
      system/
        counters/
          rid_internal_2025  ← Counter สำหรับ RID
```

---

## 🔄 Update โค้ดและ Deploy ใหม่

```bash
# Pull โค้ดล่าสุด
git pull origin claude/lp-locations-crud-011CUXeg7PC75LQGsr9Kca5r

# Build web
cd web
npm run build
cd ..

# Deploy
firebase deploy

# หรือ deploy แยกส่วน
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

---

## 🐛 Troubleshooting

### ปัญหา: Functions ใช้ region ผิด

**อาการ:** กด "อนุมัติเบื้องต้น" แล้วไม่เห็น Alert

**วิธีแก้:**
1. ตรวจสอบ `web/.env.development`:
   ```bash
   VITE_FUNCTIONS_REGION=asia-southeast1
   ```
2. ตรวจสอบ `functions/.env`:
   ```bash
   FUNCTIONS_REGION=asia-southeast1
   ```
3. **ต้องตรงกัน!**
4. Rebuild และ deploy ใหม่:
   ```bash
   cd web
   npm run build
   cd ..
   firebase deploy --only hosting,functions
   ```

### ปัญหา: Permission Denied

**วิธีแก้:**
1. ตรวจสอบ Firestore Rules
2. ตรวจสอบ Custom Claims ของ user:
   - Firebase Console → Authentication → Users → คลิก user
   - ดูที่ "Custom Claims"
3. ถ้าไม่มี → ตั้งใหม่ผ่าน script หรือ console

### ปัญหา: Index Required

**อาการ:** Error "The query requires an index"

**วิธีแก้:**
1. คลิกลิงก์ใน error message
2. จะพาไปหน้า Firebase Console
3. กด "Create Index"
4. รอ 2-5 นาที ให้ index สร้างเสร็จ

### ปัญหา: ไม่เห็นข้อมูล Locations

**วิธีแก้:**
1. ตรวจสอบว่า seed ข้อมูลแล้วหรือยัง
2. ตรวจสอบ path ใน Firestore:
   ```
   artifacts/work-permit-app-1e9f0/public/data/locations
   ```
3. ตรวจสอบ VITE_APP_ID ใน `.env.development`

---

## 📝 Git Workflow

```bash
# สร้าง branch ใหม่สำหรับ feature
git checkout -b feature/my-feature

# ทำงาน...
git add .
git commit -m "Add my feature"

# Push
git push origin feature/my-feature

# Merge เข้า main/dev branch
# (ทำผ่าน Pull Request)

# Deploy
git checkout claude/lp-locations-crud-011CUXeg7PC75LQGsr9Kca5r
git pull
firebase deploy
```

---

## 🎯 Next Steps

หลังจาก setup เสร็จแล้ว ต่อไปสามารถ:

1. ✅ พัฒนาฟีเจอร์ใหม่ ๆ
2. ✅ Deploy ขึ้น dev ทดสอบ
3. ✅ เมื่อพร้อม → deploy ขึ้น production
4. ✅ Monitor logs ผ่าน Firebase Console

---

## 📞 สำคัญ

**Dev Environment นี้:**
- ✅ ใช้ Firebase Project จริง (ไม่ใช่ Emulator)
- ✅ URL: https://work-permit-app-dev.web.app
- ✅ Functions Region: asia-southeast1
- ✅ มี Security Rules ป้องกันข้อมูล
- ✅ พร้อมใช้งานจริง

**ข้อแตกต่างจาก Production:**
- Dev ใช้สำหรับทดสอบ
- Production ใช้สำหรับผู้ใช้งานจริง
- แยก Firebase Project กันคนละตัว

---

Happy Coding! 🚀
