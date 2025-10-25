# แผนการปรับปรุงระบบ RBAC สำหรับ Work Permit App

**วันที่:** 25 ตุลาคม 2025  
**ผู้จัดทำ:** Manus AI Agent

---

## 1. สรุปการวิเคราะห์โครงสร้างปัจจุบัน

### ✅ สิ่งที่มีอยู่แล้ว (ดีมาก!)

โปรเจกต์นี้มีระบบ RBAC ที่ออกแบบมาอย่างดีอยู่แล้ว ประกอบด้วย:

1. **โครงสร้าง Type Definitions** (`src/types/permissions.ts`)
   - กำหนด `AdminRole`: `viewer`, `approver`, `admin`, `superadmin`
   - กำหนด `PagePermissions` ที่ละเอียดสำหรับทุกหน้า
   - แต่ละหน้ามีสิทธิ์เฉพาะ เช่น `canView`, `canEdit`, `canApprove`, `canReject`

2. **Default Permissions** (`src/lib/defaultPermissions.ts`)
   - `VIEWER_DEFAULT`: ดูได้บางหน้า ไม่มีสิทธิ์แก้ไข/อนุมัติ
   - `APPROVER_DEFAULT`: เพิ่มสิทธิ์อนุมัติ/ปฏิเสธ
   - `ADMIN_DEFAULT`: เพิ่มสิทธิ์จัดการผู้ใช้
   - `SUPERADMIN_DEFAULT`: ทำได้ทุกอย่าง

3. **Hook สำหรับอ่านสิทธิ์** (`src/hooks/useAuthzLive.tsx`)
   - อ่านจาก Firebase ID Token (custom claims) เป็นหลัก
   - Fallback ไปที่ API `listAdmins` ถ้าไม่มี claims
   - รองรับ `pagePermissions` และ `caps` แบบเก่า

4. **ระบบเก่า** (`src/lib/authz.ts`)
   - ใช้ `Caps` แบบ object: `{ approve, reject, delete, export, viewAll, manageUsers, settings }`
   - มีฟังก์ชัน `capsForRole()` และ `mergeCaps()`

### ⚠️ ปัญหาที่พบ

1. **การใช้งานไม่สอดคล้องกัน**
   - `AdminLayout.tsx` ยังใช้ `anyOfCaps` (ระบบเก่า) ผสมกับ `pagePermissions` (ระบบใหม่)
   - บางที่เช็ค `role === "superadmin"` โดยตรง แทนที่จะใช้ permissions

2. **ไม่ครอบคลุมตามความต้องการ**
   - ยังไม่มีการซ่อนปุ่ม "อนุมัติ/ไม่อนุมัติ" สำหรับ `viewer` ในหน้า `PermitDetails`
   - เมนูบางอันยังไม่ถูกซ่อนตามสิทธิ์ที่ถูกต้อง

3. **ค่า Default ไม่ตรงตามความต้องการ**
   - ตามที่ผู้ใช้ระบุ:
     - `admin` ไม่ควรเข้า `/admin/cleanup` และ `/admin/users`
     - `approver` ไม่ควรเข้า `/admin/logs`, `/admin/users`, `/admin/settings`, `/admin/reports`, `/admin/cleanup`
     - `viewer` เข้าได้แค่ `/admin`, `/admin/permits`, `/admin/daily-operations` และดูรายละเอียดได้ แต่ไม่สามารถอนุมัติ/ไม่อนุมัติ

---

## 2. ความต้องการของผู้ใช้

### สิทธิ์ตามบทบาท (ตามที่ผู้ใช้กำหนด)

| หน้า (Route) | Superadmin | Admin | Approver | Viewer |
|:---|:---:|:---:|:---:|:---:|
| `/admin` (Dashboard) | ✅ | ✅ | ✅ | ✅ |
| `/admin/approvals` | ✅ | ✅ | ✅ | ❌ |
| `/admin/permits` | ✅ | ✅ | ✅ | ✅ |
| `/admin/daily-operations` | ✅ | ✅ | ✅ | ✅ |
| `/admin/permits/[RID]` (ดู) | ✅ | ✅ | ✅ | ✅ |
| **ปุ่มอนุมัติ/ไม่อนุมัติ** | ✅ | ✅ | ✅ | ❌ |
| `/admin/reports` | ✅ | ✅ | ❌ | ❌ |
| `/admin/logs` | ✅ | ✅ | ❌ | ❌ |
| `/admin/settings` | ✅ | ✅ | ❌ | ❌ |
| `/admin/users` | ✅ | ❌ | ❌ | ❌ |
| `/admin/cleanup` | ✅ | ❌ | ❌ | ❌ |

---

## 3. แผนการปรับปรุง

### Phase 2: ออกแบบและปรับปรุง Default Permissions

**ไฟล์ที่ต้องแก้:** `src/lib/defaultPermissions.ts`

ปรับค่า default ให้ตรงตามตารางข้างต้น:

- **Viewer:**
  - `dashboard.canView = true`
  - `permits.canView = true`, `permits.canViewDetails = true`
  - `dailyWork.canView = true`
  - `approvals.canView = false` (เปลี่ยนจากเดิม)
  - ที่เหลือทั้งหมด = `false`

- **Approver:**
  - เหมือน Viewer + เพิ่ม:
  - `approvals.canView = true`, `approvals.canApprove = true`, `approvals.canReject = true`
  - `permits.canExport = true`
  - `dailyWork` ครบทุกอัน
  - **ไม่มีสิทธิ์:** `reports`, `logs`, `settings`, `users`, `cleanup`

- **Admin:**
  - เหมือน Approver + เพิ่ม:
  - `reports.canView = true`, `reports.canExport = true`
  - `logs.canView = true`
  - `settings.canView = true`, `settings.canEdit = true`
  - **ไม่มีสิทธิ์:** `users`, `cleanup`

- **Superadmin:**
  - ทุกอย่าง = `true`

### Phase 3: พัฒนาระบบ RBAC และ Middleware

**ไฟล์ที่ต้องแก้:**

1. **`src/hooks/useAuthzLive.tsx`**
   - ตรวจสอบว่า `pagePermissions` ถูกโหลดและใช้งานถูกต้อง
   - ถ้าไม่มี `pagePermissions` ให้ fallback ไปใช้ `getDefaultPermissions(role)`

2. **สร้างไฟล์ใหม่: `src/lib/rbacGuard.ts`**
   - ฟังก์ชัน `canAccessPage(pageKey, pagePermissions)` → คืน `boolean`
   - ฟังก์ชัน `canPerformAction(pageKey, action, pagePermissions)` → คืน `boolean`

### Phase 4: ปรับปรุง UI

**ไฟล์ที่ต้องแก้:**

1. **`src/pages/admin/AdminLayout.tsx`**
   - ลบการใช้ `anyOfCaps` ออกทั้งหมด
   - ใช้ `pagePermissions[pageKey].canView` แทน
   - ซ่อนเมนูที่ไม่มีสิทธิ์เข้าถึง

2. **`src/pages/admin/PermitDetails.tsx`**
   - ซ่อนปุ่ม "อนุมัติ/ไม่อนุมัติ" เมื่อ `pagePermissions.approvals.canApprove === false`
   - แสดงข้อความแจ้งเตือนว่า "คุณมีสิทธิ์ดูเท่านั้น" สำหรับ viewer

3. **หน้าอื่นๆ ที่มีปุ่ม Action:**
   - `Approvals.tsx`, `Permits.tsx`, `Users.tsx`, `Settings.tsx`
   - ตรวจสอบและซ่อนปุ่มตาม `pagePermissions`

### Phase 5: ทดสอบและสร้าง Pull Request

- ทดสอบการเข้าถึงแต่ละหน้าด้วยบทบาทต่างๆ
- ตรวจสอบว่าเมนูถูกซ่อนถูกต้อง
- ตรวจสอบว่าปุ่มต่างๆ ถูกซ่อน/ปิดการใช้งานถูกต้อง
- สร้าง Pull Request พร้อมเอกสารอธิบายการเปลี่ยนแปลง

---

## 4. ไฟล์ที่จะถูกแก้ไข

1. ✏️ `src/lib/defaultPermissions.ts` - ปรับค่า default
2. ✏️ `src/hooks/useAuthzLive.tsx` - เพิ่ม fallback
3. ✨ `src/lib/rbacGuard.ts` - สร้างใหม่
4. ✏️ `src/pages/admin/AdminLayout.tsx` - ใช้ pagePermissions แทน anyOfCaps
5. ✏️ `src/pages/admin/PermitDetails.tsx` - ซ่อนปุ่มอนุมัติ/ไม่อนุมัติ
6. ✏️ `src/pages/admin/Approvals.tsx` - ตรวจสอบสิทธิ์
7. ✏️ `src/pages/admin/Users.tsx` - ตรวจสอบสิทธิ์
8. ✏️ `src/pages/admin/Settings.tsx` - ตรวจสอบสิทธิ์

---

## 5. ข้อดีของการปรับปรุงนี้

✅ **ความชัดเจน:** ใช้ `pagePermissions` เป็นหลักทั้งหมด ไม่ปนกัน  
✅ **ความยืดหยุ่น:** สามารถปรับสิทธิ์แต่ละคนได้โดยไม่ต้องแก้โค้ด  
✅ **ความปลอดภัย:** ตรวจสอบสิทธิ์ทั้งฝั่ง UI และ Backend  
✅ **ง่ายต่อการดูแล:** มีจุดเดียวในการกำหนดสิทธิ์ (`defaultPermissions.ts`)  
✅ **รองรับอนาคต:** เพิ่มบทบาทใหม่ได้ง่าย โดยไม่ต้องแก้โค้ดเก่า

---

**สถานะ:** กำลังดำเนินการ Phase 2...

