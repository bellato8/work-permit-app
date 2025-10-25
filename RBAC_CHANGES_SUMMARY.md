# สรุปการเปลี่ยนแปลง: ปรับปรุงระบบ RBAC

**วันที่:** 25 ตุลาคม 2025  
**ผู้พัฒนา:** Manus AI Agent  
**Branch:** `feature/rbac-improvements`

---

## 📋 ภาพรวม

การปรับปรุงนี้มุ่งเน้นการทำให้ระบบจัดการสิทธิ์การเข้าถึง (RBAC - Role-Based Access Control) มีความสอดคล้องและชัดเจนยิ่งขึ้น โดยใช้ `pagePermissions` เป็นหลักในการควบคุมการเข้าถึงหน้าต่างๆ และการกระทำต่างๆ ในระบบ

---

## 🎯 เป้าหมาย

1. ✅ ปรับค่า Default Permissions ให้ตรงตามความต้องการของผู้ใช้
2. ✅ สร้างระบบตรวจสอบสิทธิ์ที่เป็นมาตรฐาน (rbacGuard)
3. ✅ ปรับปรุง UI ให้ซ่อนเมนูและปุ่มตามสิทธิ์ที่กำหนด
4. ✅ รองรับ fallback เมื่อไม่มี pagePermissions

---

## 📁 ไฟล์ที่เปลี่ยนแปลง

### 1. ✏️ `web/src/lib/defaultPermissions.ts`

**การเปลี่ยนแปลง:**
- ปรับค่า default permissions สำหรับทุกบทบาทให้ตรงตามความต้องการ

**สิทธิ์ใหม่ตามบทบาท:**

| บทบาท | หน้าที่เข้าถึงได้ | หมายเหตุ |
|:---|:---|:---|
| **Viewer** | Dashboard, Permits, Daily Operations | ดูได้อย่างเดียว ไม่สามารถอนุมัติ/แก้ไข |
| **Approver** | + Approvals | สามารถอนุมัติ/ปฏิเสธได้ |
| **Admin** | + Reports, Logs, Settings | ไม่เข้า Users, Cleanup |
| **Superadmin** | ทุกหน้า | ทำได้ทุกอย่าง |

**ตัวอย่างโค้ด:**
```typescript
export const VIEWER_DEFAULT: PagePermissions = {
  dashboard: { canView: true },
  approvals: { canView: false, ... }, // ไม่เห็นเมนู Approvals
  permits: { canView: true, canViewDetails: true, canExport: false },
  dailyWork: { canView: true, canCheckIn: false, ... },
  // ที่เหลือทั้งหมด = false
};
```

---

### 2. ✨ `web/src/lib/rbacGuard.ts` (ไฟล์ใหม่)

**วัตถุประสงค์:**
- สร้างฟังก์ชันช่วยตรวจสอบสิทธิ์แบบมาตรฐาน

**ฟังก์ชันหลัก:**
- `canAccessPage(pageKey, pagePermissions, role)` - ตรวจสอบว่าเข้าถึงหน้านี้ได้หรือไม่
- `canPerformAction(pageKey, action, pagePermissions, role)` - ตรวจสอบว่าทำการกระทำนี้ได้หรือไม่
- `isSuperadmin(role, caps)` - ตรวจสอบว่าเป็น Superadmin หรือไม่
- `filterVisibleMenus(menuItems, pagePermissions, role, caps)` - กรองเมนูที่มองเห็นได้
- `hasAnyPageAccess(pagePermissions, role)` - ตรวจสอบว่ามีสิทธิ์อย่างน้อยหนึ่งหน้า

**ตัวอย่างการใช้งาน:**
```typescript
import { canAccessPage, canPerformAction } from '../../lib/rbacGuard';

// ตรวจสอบว่าเข้าหน้า Users ได้หรือไม่
const canViewUsers = canAccessPage('users', pagePermissions, role);

// ตรวจสอบว่าลบผู้ใช้ได้หรือไม่
const canDeleteUser = canPerformAction('users', 'canDelete', pagePermissions, role);
```

---

### 3. ✏️ `web/src/hooks/useAuthzLive.tsx`

**การเปลี่ยนแปลง:**
- เพิ่ม import `getDefaultPermissions` จาก `defaultPermissions.ts`
- เพิ่ม fallback: ถ้าไม่มี `pagePermissions` จาก API/Token ให้ใช้ค่า default จาก role

**โค้ดที่เพิ่ม:**
```typescript
import { getDefaultPermissions } from "../lib/defaultPermissions";

// ในส่วน setState
const finalPagePermissions = fromToken.pagePermissions || 
  (fromToken.role ? getDefaultPermissions(fromToken.role) : undefined);

setSt({ 
  loading: false, 
  userEmail: email, 
  role: fromToken.role, 
  caps: fromToken.caps, 
  pagePermissions: finalPagePermissions 
});
```

**ประโยชน์:**
- รองรับผู้ใช้เก่าที่ยังไม่มี pagePermissions ในฐานข้อมูล
- ระบบจะใช้ค่า default ตาม role โดยอัตโนมัติ

---

### 4. ✏️ `web/src/pages/admin/AdminLayout.tsx`

**การเปลี่ยนแปลง:**
- ลบ `anyOfCaps` ออกจากรายการเมนูทั้งหมด
- ลบการใช้ `RequireCap` component
- ใช้ `filterVisibleMenus()` และ `hasAnyPageAccess()` จาก `rbacGuard`

**ก่อน:**
```typescript
const allowedItems = useMemo(
  () =>
    NAV_ITEMS.filter((it) => {
      if (it.requireSuperadmin && !isSuperadmin) return false;
      if (pagePermissions && it.pageKey) {
        return pagePermissions[it.pageKey]?.canView === true;
      }
      return canAny({ role, caps }, it.anyOfCaps); // ระบบเก่า
    }),
  [role, caps, pagePermissions, isSuperadmin]
);
```

**หลัง:**
```typescript
const allowedItems = useMemo(
  () => filterVisibleMenus(NAV_ITEMS, pagePermissions, role, caps),
  [role, caps, pagePermissions]
);

const hasAccess = useMemo(
  () => hasAnyPageAccess(pagePermissions, role),
  [pagePermissions, role]
);
```

**ผลลัพธ์:**
- โค้ดสะอาดขึ้น ลดความซับซ้อน
- ใช้ระบบเดียวกันทั้งโปรเจกต์
- เมนูถูกซ่อนอัตโนมัติตามสิทธิ์

---

### 5. ✏️ `web/src/pages/admin/PermitDetails.tsx`

**การเปลี่ยนแปลง:**
- เพิ่มการตรวจสอบ `canReject` แยกจาก `canApprove`
- ปรับ logic การแสดงปุ่มอนุมัติ/ไม่อนุมัติให้ใช้ `pagePermissions` เป็นหลัก
- ปรับข้อความแจ้งเตือนสำหรับผู้ที่ไม่มีสิทธิ์ให้สวยงามขึ้น

**โค้ดที่เพิ่ม:**
```typescript
const canApprove = 
  live.role === "superadmin" ||
  live.pagePermissions?.approvals?.canApprove === true;

const canReject = 
  live.role === "superadmin" ||
  live.pagePermissions?.approvals?.canReject === true;

useEffect(() => {
  if (canApprove || canReject) {
    setAllowed(true);
  } else if (live.pagePermissions) {
    setAllowed(false); // มี pagePermissions แต่ไม่มีสิทธิ์
  } else {
    // Fallback สำหรับผู้ใช้เก่า
    canDecide().then(ok => setAllowed(ok));
  }
}, [canApprove, canReject, live.pagePermissions]);
```

**UI ที่ปรับปรุง:**
- Viewer จะเห็นข้อความเตือนสีเหลืองพร้อมไอคอน: "คุณมีสิทธิ์ดูอย่างเดียว"
- ปุ่มอนุมัติ/ไม่อนุมัติจะถูกซ่อนสำหรับผู้ที่ไม่มีสิทธิ์

---

## 🧪 การทดสอบ

### ✅ TypeScript Compilation
```bash
cd web && ./node_modules/.bin/tsc --noEmit
# ผลลัพธ์: ไม่มี errors
```

### 📋 Test Cases ที่ควรทดสอบ

#### 1. **Viewer Role**
- [ ] เห็นเมนู: Dashboard, Permits, Daily Operations
- [ ] **ไม่เห็นเมนู:** Approvals, Reports, Logs, Users, Cleanup, Settings
- [ ] เข้าหน้า `/admin/permits/[RID]` ได้
- [ ] **ไม่เห็นปุ่ม** อนุมัติ/ไม่อนุมัติ
- [ ] เห็นข้อความ "คุณมีสิทธิ์ดูอย่างเดียว"

#### 2. **Approver Role**
- [ ] เห็นเมนู: Dashboard, Approvals, Permits, Daily Operations
- [ ] **ไม่เห็นเมนู:** Reports, Logs, Users, Cleanup, Settings
- [ ] เข้าหน้า `/admin/approvals` ได้
- [ ] **เห็นปุ่ม** อนุมัติ/ไม่อนุมัติ และกดได้
- [ ] สามารถ Export ข้อมูลได้

#### 3. **Admin Role**
- [ ] เห็นเมนู: Dashboard, Approvals, Permits, Daily Operations, Reports, Logs, Settings
- [ ] **ไม่เห็นเมนู:** Users, Cleanup
- [ ] เข้าหน้า `/admin/logs` ได้
- [ ] เข้าหน้า `/admin/settings` ได้และแก้ไขได้
- [ ] **ไม่สามารถเข้า** `/admin/users` และ `/admin/cleanup`

#### 4. **Superadmin Role**
- [ ] เห็นเมนูทุกอัน
- [ ] เข้าได้ทุกหน้า
- [ ] ทำได้ทุกอย่าง (อนุมัติ, แก้ไข, ลบ, ล้างข้อมูล)

---

## 🔄 Migration Guide (สำหรับผู้ดูแลระบบ)

### สำหรับผู้ใช้เก่าที่ยังไม่มี pagePermissions

ระบบจะทำงานได้ปกติโดยอัตโนมัติ เพราะมี fallback mechanism:

1. **ถ้ามี pagePermissions ใน Firestore** → ใช้ค่านั้น
2. **ถ้าไม่มี pagePermissions** → ใช้ค่า default จาก role
3. **ถ้าไม่มีทั้ง pagePermissions และ role** → ใช้ฟังก์ชัน `canDecide()` แบบเก่า

### การอัพเดต pagePermissions ในฐานข้อมูล (Optional)

ถ้าต้องการให้ผู้ใช้มี pagePermissions ที่ชัดเจน สามารถรันสคริปต์นี้:

```javascript
// ตัวอย่าง: อัพเดต pagePermissions สำหรับ admin ทั้งหมด
import { getDefaultPermissions } from './web/src/lib/defaultPermissions';

const admins = await db.collection('admins').where('role', '==', 'admin').get();

for (const doc of admins.docs) {
  const role = doc.data().role;
  const pagePermissions = getDefaultPermissions(role);
  
  await doc.ref.update({ 
    pagePermissions,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system-migration'
  });
}
```

---

## 📊 สรุปผลกระทบ

### ข้อดี ✅
1. **ความสอดคล้อง:** ใช้ระบบเดียวกันทั้งโปรเจกต์
2. **ความปลอดภัย:** ตรวจสอบสิทธิ์อย่างเข้มงวดขึ้น
3. **ความยืดหยุ่น:** เพิ่ม/แก้ไขสิทธิ์ได้ง่ายโดยไม่ต้องแก้โค้ด
4. **UX ที่ดีขึ้น:** ซ่อนเมนู/ปุ่มที่ไม่มีสิทธิ์ ลดความสับสน
5. **Backward Compatible:** รองรับผู้ใช้เก่าด้วย fallback

### ข้อควรระวัง ⚠️
1. **ต้องทดสอบทุกบทบาท** เพื่อให้แน่ใจว่าสิทธิ์ถูกต้อง
2. **ผู้ใช้เก่าอาจเห็นการเปลี่ยนแปลง** ถ้าสิทธิ์เดิมไม่ตรงกับ default ใหม่
3. **ต้องอัพเดต Custom Claims** ใน Firebase ถ้าใช้ระบบ Token-based

---

## 🚀 การ Deploy

### ขั้นตอนที่แนะนำ:

1. **Merge Pull Request** นี้เข้า `main` branch
2. **Deploy ไปยัง Staging** ทดสอบก่อน
3. **ทดสอบทุกบทบาท** ตาม Test Cases ข้างต้น
4. **Deploy ไปยัง Production** เมื่อมั่นใจแล้ว
5. **Monitor Logs** สังเกตว่ามี permission errors หรือไม่

### Environment Variables ที่ต้องตั้ง:

```bash
VITE_LIST_ADMINS_URL=https://...
VITE_UPDATE_ADMIN_PERMISSIONS_URL=https://...
VITE_APPROVER_KEY=...
```

---

## 📞 ติดต่อ

หากพบปัญหาหรือมีคำถาม:
- สร้าง Issue ใน GitHub Repository
- ติดต่อทีมพัฒนา

---

**สถานะ:** ✅ พร้อม Merge  
**ทดสอบแล้ว:** TypeScript Compilation ✅  
**รอการทดสอบ:** Manual Testing ตามบทบาทต่างๆ

