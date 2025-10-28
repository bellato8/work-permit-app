# 🚀 คู่มือ Deploy ไป Firebase Production

## ✅ ข่าวดี: โค้ดพร้อมใช้งานจริงอยู่แล้ว!

โค้ดที่เราเขียนมา**ไม่มี Emulator connection** เลย จึงพร้อมใช้กับ Firebase Production ทันที

---

## 📋 ขั้นตอนการ Setup (Production/Dev)

### 1️⃣ Setup Environment Variables

#### สำหรับ **Production** (เว็บจริง)

สร้างไฟล์ `web/.env.production`:

```bash
# Firebase Production Config
VITE_FIREBASE_API_KEY=YOUR_PRODUCTION_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-production-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-production-project.firebasestorage.app
VITE_FIREBASE_STORAGE_BUCKET_GS=gs://your-production-project.firebasestorage.app
VITE_FIREBASE_APP_ID=YOUR_PRODUCTION_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_PRODUCTION_SENDER_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_PRODUCTION_MEASUREMENT_ID

# App Settings
VITE_APP_ID=your-production-project-id
VITE_FUNCTIONS_REGION=asia-southeast1
VITE_APP_BASE_URL=https://your-domain.com
```

#### สำหรับ **Development** (เว็บ dev)

สร้างไฟล์ `web/.env.development`:

```bash
# Firebase Dev Config
VITE_FIREBASE_API_KEY=YOUR_DEV_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=your-dev-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-dev-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-dev-project.firebasestorage.app
VITE_FIREBASE_STORAGE_BUCKET_GS=gs://your-dev-project.firebasestorage.app
VITE_FIREBASE_APP_ID=YOUR_DEV_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_DEV_SENDER_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_DEV_MEASUREMENT_ID

# App Settings
VITE_APP_ID=your-dev-project-id
VITE_FUNCTIONS_REGION=asia-southeast1
VITE_APP_BASE_URL=https://your-dev-domain.com
```

**📌 หา Firebase Config:**
1. เปิด [Firebase Console](https://console.firebase.google.com)
2. เลือก Project → Project Settings → General
3. เลื่อนลงมาที่ "Your apps" → เลือก Web app
4. คัดลอกค่า `firebaseConfig` มาใส่

---

### 2️⃣ Deploy Cloud Functions

#### Setup Functions Environment

สร้างไฟล์ `functions/.env` (สำหรับ production):

```bash
FUNCTIONS_REGION=asia-southeast1
CONTRACTOR_FORM_BASE_URL=https://your-domain.com/contractor/form
```

#### Deploy Functions

```bash
# ไปที่โฟลเดอร์โปรเจกต์
cd D:\work-permit-app-dev

# Login Firebase CLI (ถ้ายังไม่ได้ login)
firebase login

# เลือก project ที่จะ deploy
firebase use your-production-project-id

# Deploy เฉพาะ Functions
firebase deploy --only functions

# หรือ deploy ทั้งหมด (functions + firestore rules + hosting)
firebase deploy
```

**📌 ตรวจสอบว่า deploy สำเร็จ:**
- เปิด [Firebase Console](https://console.firebase.google.com)
- ไปที่ Functions
- ควรเห็น:
  - `createContractorLink`
  - `mockPermitSubmitted`
  - (และ functions อื่น ๆ ที่มีอยู่แล้ว)

---

### 3️⃣ Firestore Security Rules

**⚠️ สำคัญมาก!** ต้องมี Security Rules ป้องกันข้อมูล

สร้างไฟล์ `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: เช็ค superadmin
    function isSuperAdmin() {
      return request.auth != null &&
             (request.auth.token.isSuperadmin == true ||
              request.auth.token.role == 'superadmin');
    }

    // Helper function: เช็ค LP Admin
    function isLPAdmin() {
      return request.auth != null &&
             (request.auth.token.lpAdmin == true ||
              request.auth.token.role == 'lpAdmin' ||
              request.auth.token.role == 'lp_admin' ||
              isSuperAdmin());
    }

    // Helper function: เช็คว่าเป็นเจ้าของ
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // ========================
    // Artifacts Pattern
    // ========================
    match /artifacts/{appId} {

      // Public Data (อ่านได้ทุกคน แต่แก้ไขได้เฉพาะ LP Admin)
      match /public/data/{document=**} {
        allow read: if request.auth != null;
        allow write: if isLPAdmin();
      }

      // User-specific data
      match /users/{userId}/{document=**} {
        // อ่านได้เฉพาะเจ้าของ หรือ LP Admin
        allow read: if isOwner(userId) || isLPAdmin();
        // เขียนได้เฉพาะเจ้าของ
        allow create, update: if isOwner(userId);
        // ลบได้เฉพาะเจ้าของ หรือ LP Admin
        allow delete: if isOwner(userId) || isLPAdmin();
      }

      // Private System Data (เฉพาะ Server-side)
      match /private/{document=**} {
        allow read, write: if false; // Server-side only
      }
    }

    // ========================
    // Legacy Collections (ถ้ามี)
    // ========================
    match /locations/{docId} {
      allow read: if request.auth != null;
      allow write: if isLPAdmin();
    }

    match /users_internal/{docId} {
      allow read: if request.auth != null;
      allow write: if isLPAdmin();
    }

    // Default: ปฏิเสธทั้งหมด
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Deploy Security Rules:**

```bash
firebase deploy --only firestore:rules
```

---

### 4️⃣ สร้าง Composite Index

เมื่อรันครั้งแรก ถ้า query ใช้ `orderBy` หลายฟิลด์ จะต้องสร้าง Index

**วิธีสร้าง:**
1. เปิด Browser Console
2. รัน query ที่ต้องการ (เช่น orderBy createdAt)
3. จะเห็น error พร้อม link สร้าง index
4. คลิก link → จะไปหน้า Firebase Console
5. กด Create Index
6. รอสักครู่ให้สร้างเสร็จ

**หรือสร้างผ่าน `firestore.indexes.json`:**

```json
{
  "indexes": [
    {
      "collectionGroup": "internal_requests",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "internal_requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy:
```bash
firebase deploy --only firestore:indexes
```

---

### 5️⃣ สร้าง Superadmin (Production)

**⚠️ สำคัญ:** ต้องสร้าง superadmin บน Production

```bash
# ไปที่โฟลเดอร์ functions
cd functions

# ติดตั้ง dependencies (ถ้ายังไม่ได้ติดตั้ง)
npm install

# รัน script สร้าง superadmin (แก้ email เป็นของคุณ)
# ต้องรันจากเครื่องที่มี Firebase credentials
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json \
node -e "
const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'your-production-project-id'
});
admin.auth().getUserByEmail('admin@example.com')
  .then(user => {
    return admin.auth().setCustomUserClaims(user.uid, {
      role: 'superadmin',
      isSuperadmin: true,
      isAdmin: true,
      lpAdmin: true
    });
  })
  .then(() => console.log('✅ Superadmin created'))
  .catch(err => console.error('❌ Error:', err));
"
```

**หรือใช้ Cloud Function** (แนะนำ):
- สร้าง HTTP Function พิเศษสำหรับสร้าง superadmin
- ป้องกันด้วย Secret key
- เรียกใช้ครั้งเดียวแล้วลบทิ้ง

---

### 6️⃣ Build และ Deploy Web App

#### Build สำหรับ Production

```bash
cd web

# Build แบบ production
npm run build

# Preview ก่อน deploy (ถ้าต้องการ)
npm run preview
```

#### Deploy ไป Firebase Hosting

```bash
cd ..

# Deploy hosting
firebase deploy --only hosting

# หรือ deploy ทั้งหมด
firebase deploy
```

---

## 🌐 URL ที่ได้หลัง Deploy

### Firebase Hosting (Default)
```
https://your-project-id.web.app
https://your-project-id.firebaseapp.com
```

### Custom Domain (ถ้าต้องการ)
1. ไปที่ Firebase Console → Hosting
2. คลิก "Add custom domain"
3. ใส่ domain ของคุณ (เช่น `work-permit.your-company.com`)
4. ทำตาม DNS verification steps
5. รอ SSL certificate (ประมาณ 24 ชม.)

---

## 🔐 สิทธิ์ผู้ใช้ที่ต้องสร้าง

### 1. Superadmin (ทำทุกอย่างได้)
```javascript
{
  role: 'superadmin',
  isSuperadmin: true,
  isAdmin: true,
  lpAdmin: true
}
```

### 2. LP Admin (จัดการ Module 2)
```javascript
{
  role: 'lpAdmin',
  lpAdmin: true,
  isAdmin: true
}
```

### 3. Internal User (พนักงานทั่วไป)
- ไม่ต้องมี custom claims
- Login ด้วย email/password ธรรมดา

---

## 📊 ตรวจสอบหลัง Deploy

### ✅ Checklist

- [ ] Web app เปิดได้ (URL จาก Hosting)
- [ ] Login ได้ทั้ง Internal และ LP Admin
- [ ] Cloud Functions ทำงานได้
  - [ ] `createContractorLink` สร้าง RID ได้
  - [ ] `mockPermitSubmitted` เปลี่ยนสถานะได้
- [ ] Firestore เขียน/อ่านข้อมูลได้
- [ ] Security Rules ทำงานถูกต้อง (ไม่ให้คนอื่นอ่านข้อมูลที่ไม่ใช่ของตัวเอง)
- [ ] สร้าง Superadmin แล้ว
- [ ] Seed master data (Locations, Internal Users)

---

## 🐛 Troubleshooting

### ปัญหา: Functions ไม่ทำงาน
```bash
# ดู logs
firebase functions:log

# หรือดูใน Console
# Firebase Console → Functions → Logs
```

### ปัญหา: Permission Denied
- ตรวจสอบ Firestore Security Rules
- ตรวจสอบ Custom Claims ของ user
- ดู Console → Firestore → Rules → Playground

### ปัญหา: Index not found
- คลิก link สร้าง index ที่แสดงใน error
- หรือ deploy indexes: `firebase deploy --only firestore:indexes`

---

## 🔄 Deploy ครั้งต่อไป

```bash
# Update โค้ด
git pull origin main

# Build
cd web && npm run build && cd ..

# Deploy
firebase deploy

# หรือ deploy เฉพาะส่วนที่เปลี่ยน
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

---

## 💾 Backup ข้อมูล

```bash
# Export Firestore data
firebase firestore:export gs://your-bucket/backups/$(date +%Y%m%d)

# Export Auth users
firebase auth:export users.json --format=JSON
```

---

## 📞 ติดต่อ

หากมีปัญหาหรือข้อสงสัย โปรดติดต่อทีมพัฒนา
