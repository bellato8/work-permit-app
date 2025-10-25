# 🚀 Quick Start Guide: ระบบ RBAC ใหม่

**สำหรับ:** เจ้าของโปรเจกต์และทีมพัฒนา  
**เวลาอ่าน:** 5 นาที

---

## 📌 TL;DR (สรุปสั้นๆ)

ระบบ RBAC ถูกปรับปรุงให้ใช้ `pagePermissions` เป็นหลัก ซ่อนเมนูและปุ่มตามสิทธิ์ที่กำหนด รองรับผู้ใช้เก่าด้วย fallback

**Pull Request:** https://github.com/bellato8/work-permit-app/pull/1

---

## 🎯 สิทธิ์แต่ละบทบาท (ฉบับย่อ)

### 👁️ Viewer
- **เห็น:** Dashboard, Permits, Daily Operations
- **ทำได้:** ดูอย่างเดียว
- **ทำไม่ได้:** อนุมัติ, แก้ไข, ลบ

### ✅ Approver
- **เห็น:** + Approvals
- **ทำได้:** + อนุมัติ/ปฏิเสธ, Export

### 👔 Admin
- **เห็น:** + Reports, Logs, Settings
- **ไม่เห็น:** Users, Cleanup

### 🔑 Superadmin
- **เห็น:** ทุกอย่าง
- **ทำได้:** ทุกอย่าง

---

## ✅ ขั้นตอนการใช้งาน

### 1. Review Pull Request (5 นาที)

```bash
# เปิด PR ใน browser
https://github.com/bellato8/work-permit-app/pull/1

# อ่านสรุปการเปลี่ยนแปลง
# ตรวจสอบไฟล์ที่แก้ไข
```

### 2. ทดสอบบน Local (15 นาที)

```bash
# Clone branch
git fetch origin
git checkout feature/rbac-improvements

# ติดตั้ง dependencies
cd web
npm install

# รัน dev server
npm run dev
```

### 3. ทดสอบแต่ละบทบาท (20 นาที)

#### Viewer
- [ ] เห็นเมนู 3 อัน (Dashboard, Permits, Daily Operations)
- [ ] เข้าหน้า Permit Details ได้
- [ ] **ไม่เห็น**ปุ่มอนุมัติ/ไม่อนุมัติ

#### Approver
- [ ] เห็นเมนู 4 อัน (+ Approvals)
- [ ] **เห็น**ปุ่มอนุมัติ/ไม่อนุมัติ
- [ ] กดอนุมัติได้

#### Admin
- [ ] เห็นเมนู 7 อัน (+ Reports, Logs, Settings)
- [ ] เข้าหน้า Logs ได้
- [ ] **ไม่เห็น**เมนู Users และ Cleanup

#### Superadmin
- [ ] เห็นเมนูทุกอัน (9 เมนู)
- [ ] เข้าได้ทุกหน้า
- [ ] ทำได้ทุกอย่าง

### 4. Merge และ Deploy (10 นาที)

```bash
# ถ้าทดสอบผ่าน
# 1. Approve PR ใน GitHub
# 2. Merge เข้า main
# 3. Deploy ไปยัง Staging
# 4. ทดสอบอีกครั้งบน Staging
# 5. Deploy ไปยัง Production
```

---

## 🐛 หากพบปัญหา

### ปัญหา: เมนูไม่ถูกซ่อน

**วิธีแก้:**
1. เช็ค Console: `console.log(authz.pagePermissions)`
2. ตรวจสอบว่ามี `pagePermissions` หรือไม่
3. ถ้าไม่มี ให้เช็คว่า `role` ถูกต้องหรือไม่

### ปัญหา: ปุ่มอนุมัติยังแสดงสำหรับ Viewer

**วิธีแก้:**
1. Clear cache และ reload
2. เช็ค `pagePermissions.approvals.canApprove`
3. ตรวจสอบว่า role เป็น "viewer" จริงหรือไม่

### ปัญหา: ผู้ใช้เก่าไม่สามารถเข้าระบบได้

**วิธีแก้:**
1. ระบบมี fallback รองรับอยู่แล้ว
2. ถ้ายังมีปัญหา ให้รันสคริปต์อัพเดต pagePermissions

```javascript
// สคริปต์อัพเดต (รันใน Firebase Console)
const admins = await db.collection('admins').get();
for (const doc of admins.docs) {
  const role = doc.data().role;
  if (!doc.data().pagePermissions && role) {
    const defaults = {
      viewer: VIEWER_DEFAULT,
      approver: APPROVER_DEFAULT,
      admin: ADMIN_DEFAULT,
      superadmin: SUPERADMIN_DEFAULT
    };
    await doc.ref.update({ 
      pagePermissions: defaults[role] || VIEWER_DEFAULT
    });
  }
}
```

---

## 📚 เอกสารเพิ่มเติม

- **รายละเอียดเต็ม:** `RBAC_CHANGES_SUMMARY.md`
- **รายงานสรุป:** `RBAC_FINAL_REPORT.md`
- **แผนการปรับปรุง:** `RBAC_IMPROVEMENT_PLAN.md`

---

## 💬 คำถามที่พบบ่อย (FAQ)

### Q: ต้องอัพเดตฐานข้อมูลหรือไม่?
**A:** ไม่จำเป็น ระบบมี fallback รองรับผู้ใช้เก่าอยู่แล้ว

### Q: ผู้ใช้เก่าจะได้รับผลกระทบหรือไม่?
**A:** ไม่ ระบบจะใช้ค่า default จาก role โดยอัตโนมัติ

### Q: จะเพิ่มหน้าใหม่ยังไง?
**A:** 
1. เพิ่ม pageKey ใน `types/permissions.ts`
2. เพิ่มใน `defaultPermissions.ts`
3. เพิ่มเมนูใน `AdminLayout.tsx`

### Q: จะปรับสิทธิ์ของบทบาทใดๆ ยังไง?
**A:** แก้ไขที่ `web/src/lib/defaultPermissions.ts` เท่านั้น

### Q: TypeScript มี errors หรือไม่?
**A:** ไม่มี ทดสอบแล้วผ่าน ✅

---

## ⏱️ Timeline แนะนำ

| ขั้นตอน | เวลา | ผู้รับผิดชอบ |
|:---|:---:|:---|
| Review PR | 5 นาที | Tech Lead |
| ทดสอบ Local | 15 นาที | Developer |
| ทดสอบทุกบทบาท | 20 นาที | QA/Developer |
| Merge PR | 2 นาที | Tech Lead |
| Deploy Staging | 5 นาที | DevOps |
| ทดสอบ Staging | 15 นาที | QA |
| Deploy Production | 5 นาที | DevOps |
| Monitor | 30 นาที | ทีมทั้งหมด |
| **รวม** | **~1.5 ชั่วโมง** | |

---

## ✨ ประโยชน์ที่ได้รับ

1. ✅ เมนูซ่อนอัตโนมัติตามสิทธิ์
2. ✅ ปุ่มซ่อนอัตโนมัติตามสิทธิ์
3. ✅ ลด bugs เรื่องสิทธิ์
4. ✅ UX ดีขึ้น (ไม่เห็นสิ่งที่ทำไม่ได้)
5. ✅ โค้ดสะอาดขึ้น
6. ✅ ปรับแต่งง่ายขึ้น

---

## 🎉 พร้อมแล้ว!

ระบบ RBAC ใหม่พร้อมใช้งาน เพียงแค่:
1. Review PR
2. ทดสอบ
3. Merge
4. Deploy

**Pull Request:** https://github.com/bellato8/work-permit-app/pull/1

---

*มีคำถามเพิ่มเติม? สร้าง Issue ใน GitHub หรืออ่านเอกสารเพิ่มเติมใน `RBAC_CHANGES_SUMMARY.md`*

