# 🧪 คู่มือเซ็ตอัพ Firebase Emulator

## 📋 ขั้นตอนเซ็ตอัพ

### 1. ติดตั้ง Dependencies

```bash
# ติดตั้ง dependencies สำหรับ web app
cd web
npm install

# ติดตั้ง dependencies สำหรับ Cloud Functions
cd ../functions
npm install

# กลับมาที่ root
cd ..
```

### 2. ตั้งค่า Environment Variables

#### 2.1 Web App (web/.env)

```bash
# คัดลอก .env.example ไปเป็น .env
cp web/.env.example web/.env
```

**⚠️ สำคัญ:** ตรวจสอบว่าไฟล์ `web/.env` มีค่าดังนี้:

```bash
VITE_APP_ID=work-permit-app-1e9f0
VITE_FUNCTIONS_REGION=us-central1  # ← ต้องมีบรรทัดนี้!
```

#### 2.2 Cloud Functions (functions/.env)

```bash
# คัดลอก .env.example ไปเป็น .env
cp functions/.env.example functions/.env
```

**⚠️ สำคัญ:** ตรวจสอบว่าไฟล์ `functions/.env` มีค่าดังนี้:

```bash
FUNCTIONS_REGION=us-central1  # ← ต้องตรงกับ VITE_FUNCTIONS_REGION
CONTRACTOR_FORM_BASE_URL=http://localhost:5173/contractor/form
```

### 3. เริ่ม Firebase Emulator

```bash
# เริ่ม Firebase Emulator (Auth, Firestore, Functions, Storage)
npm run emulator
```

**Emulator UI:** [http://localhost:4000](http://localhost:4000)

### 4. เริ่ม Web Dev Server (Terminal ใหม่)

```bash
cd web
npm run dev
```

**Web App:** [http://localhost:5173](http://localhost:5173)

### 5. Seed ข้อมูลทดสอบ

#### 5.1 สร้าง Superadmin

```bash
node scripts/setSuperadmin.js admin@example.com
```

#### 5.2 Seed Locations (สถานที่)

```bash
node scripts/seedLocations.js
```

#### 5.3 Seed Internal Users (พนักงานภายใน)

```bash
node scripts/seedInternalUsers.js
```

#### 5.4 (Optional) Seed Internal Requests

```bash
# สร้าง internal request ตัวอย่างให้ user
node scripts/seedInternalRequests.js somchai@company.com
```

---

## 🧪 ทดสอบ Workflow

### 1. ทดสอบ LP Admin Portal

1. เปิด [http://localhost:5173/admin/lp/login](http://localhost:5173/admin/lp/login)
2. Login ด้วย `admin@example.com` (ต้อง set superadmin ก่อน)
3. ไปที่ **Locations** → ควรเห็นสถานที่ 5 แห่ง
4. ไปที่ **Internal Users** → ควรเห็นพนักงาน 7 คน

### 2. ทดสอบ Internal Portal

1. เปิด [http://localhost:5173/internal/login](http://localhost:5173/internal/login)
2. Login ด้วย `somchai@company.com` (หรือ email อื่นจาก seedInternalUsers)
3. ไปที่ **New Request** → สร้างคำขอใหม่
4. ไปที่ **Dashboard** → ควรเห็นคำขอที่สร้าง

### 3. ทดสอบ LP Internal Requests Queue

1. Login เป็น LP Admin
2. ไปที่ **Internal Requests Queue**
3. ควรเห็นคำขอจากพนักงาน
4. กดปุ่ม **"อนุมัติเบื้องต้น"**
5. ควรเห็น Alert แสดง RID และ URL

**✅ ถ้าเห็น Alert แสดง RID (เช่น INT-2025-0001) แสดงว่า Cloud Function ทำงานถูกต้อง!**

### 4. ทดสอบ Mock Permit Submitted

```bash
# จำลองผู้รับเหมากรอกฟอร์มเสร็จ (ใส่ RID ที่ได้จากขั้นตอนที่ 3)
node scripts/testMockPermitSubmitted.js INT-2025-0001
```

---

## 🐛 Troubleshooting

### ปัญหา: กด "อนุมัติเบื้องต้น" แล้วไม่มี Alert ขึ้น

**สาเหตุ:** Region ไม่ตรงกันระหว่าง web และ functions

**วิธีแก้:**
1. ตรวจสอบ `web/.env` ต้องมี `VITE_FUNCTIONS_REGION=us-central1`
2. ตรวจสอบ `functions/.env` ต้องมี `FUNCTIONS_REGION=us-central1`
3. **Restart ทั้ง Emulator และ Web Dev Server**

```bash
# Stop emulator (Ctrl+C)
# Stop web dev server (Ctrl+C)

# Start emulator ใหม่
npm run emulator

# Start web dev server ใหม่ (terminal ใหม่)
cd web && npm run dev
```

### ปัญหา: ไม่เห็นรายการสถานที่ใน /internal/requests/new

**วิธีแก้:**
1. ตรวจสอบว่า seed locations แล้วหรือยัง: `node scripts/seedLocations.js`
2. เปิด Emulator UI: [http://localhost:4000/firestore](http://localhost:4000/firestore)
3. ดูว่ามีข้อมูลที่ path: `artifacts/work-permit-app-1e9f0/public/data/locations` หรือไม่

### ปัญหา: Cloud Function error

**ตรวจสอบ:**
1. ดู logs ใน terminal ที่รัน emulator
2. เปิด Emulator UI → Functions → ดู logs
3. ตรวจสอบว่า `functions/src/index.ts` export `createContractorLink` แล้วหรือยัง

---

## 📁 โครงสร้างข้อมูล Firestore

```
artifacts/
  {appId}/
    public/
      data/
        locations/          # สถานที่ทั้งหมด
          {docId}
        users_internal/     # พนักงานภายในทั้งหมด
          {docId}
    users/
      {userId}/
        internal_requests/  # คำขอของแต่ละคน
          {docId}
    private/
      system/
        counters/
          rid_internal_2025  # Counter สำหรับสร้าง RID
```

---

## 🔐 Custom Claims

### LP Admin
```json
{
  "role": "lpAdmin",
  "lpAdmin": true,
  "isAdmin": true
}
```

### Superadmin
```json
{
  "role": "superadmin",
  "isSuperadmin": true,
  "isAdmin": true
}
```

สร้างผ่านสคริปต์: `node scripts/setSuperadmin.js {email}`

---

## 📝 Status Flow

```
รอดำเนินการ
  ↓ (LP กดอนุมัติเบื้องต้น → createContractorLink)
LP รับทราบ (รอผู้รับเหมา)
  ↓ (ผู้รับเหมากรอกฟอร์มเสร็จ → mockPermitSubmitted)
รอ LP ตรวจสอบ
  ↓ (LP กดอนุมัติขั้นสุดท้าย)
อนุมัติเข้าทำงาน
  หรือ
ไม่อนุมัติ
```

---

## 🎯 RID Format

`INT-YYYY-####`

ตัวอย่าง: `INT-2025-0001`, `INT-2025-0002`, ...

---

## 📞 ติดต่อ

หากมีปัญหาหรือข้อสงสัย โปรดติดต่อทีมพัฒนา
