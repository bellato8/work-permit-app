# Permission Matrix - Work Permit App

**Project**: Work Permit App (work-permit-app-1e9f0)  
**Created**: 2025-10-14  
**Last Updated**: 2025-10-14  
**Version**: 1.0.0

---

## 📋 Overview

ระบบสิทธิ์แบบละเอียด (Granular Permissions) ที่แยกสิทธิ์ตามหน้าและ action ต่างๆ

### Roles
1. **Viewer**: ดูได้เกือบทุกอย่าง แต่ไม่สามารถแก้ไขหรืออนุมัติ
2. **Approver**: ทำได้เหมือน Viewer + อนุมัติ/ปฏิเสธงาน + เช็คอิน/เอาท์
3. **Admin**: ทำได้เหมือน Approver + จัดการผู้ใช้ + ดูงานทุกวัน
4. **Super Admin**: ทำได้ทุกอย่างรวมถึงลบข้อมูลและแก้ไขการตั้งค่า

---

## 🔐 Role Hierarchy

Super Admin (ระดับสูงสุด)
↑
Admin
↑
Approver
↑
Viewer (ระดับต่ำสุด)

---

## 📊 สิทธิ์ตาม Role (Summary)

| Feature Area | Viewer | Approver | Admin | Super Admin |
|--------------|--------|----------|-------|-------------|
| Dashboard | ✅ View | ✅ View | ✅ View | ✅ View |
| Approvals | ✅ View | ✅ View + Approve | ✅ View + Approve | ✅ View + Approve |
| Permits | ✅ View | ✅ View + Export | ✅ View + Export | ✅ View + Export |
| Daily Work | ❌ | ✅ Today Only | ✅ All Days | ✅ All Days |
| Reports | ❌ | ✅ View + Export | ✅ View + Export | ✅ View + Export |
| Users | ❌ | ❌ | ✅ Manage | ✅ Manage + Delete |
| Logs | ❌ | ❌ | ❌ | ✅ View |
| Cleanup | ❌ | ❌ | ❌ | ✅ Delete Data |
| Settings | ❌ | ❌ | ❌ | ✅ Edit |

---

## 📄 สิทธิ์แบบละเอียด (Detailed)

### 1. Dashboard

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ✅ | ✅ | ✅ | ✅ |

**คำอธิบาย**: ทุก Role สามารถเข้าดู Dashboard ได้

---

### 2. Approvals (รออนุมัติ)

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ✅ | ✅ | ✅ | ✅ |
| `canViewDetails` | ✅ | ✅ | ✅ | ✅ |
| `canApprove` | ❌ | ✅ | ✅ | ✅ |
| `canReject` | ❌ | ✅ | ✅ | ✅ |
| `canExport` | ❌ | ✅ | ✅ | ✅ |

**คำอธิบาย**:
- Viewer ดูรายการและรายละเอียดได้ แต่กดอนุมัติ/ปฏิเสธไม่ได้
- Approver ขึ้นไปอนุมัติ/ปฏิเสธและ Export ได้

---

### 3. Permits (ใบงาน)

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ✅ | ✅ | ✅ | ✅ |
| `canViewDetails` | ✅ | ✅ | ✅ | ✅ |
| `canExport` | ❌ | ✅ | ✅ | ✅ |

**คำอธิบาย**:
- Viewer ดูได้แต่ Export ไม่ได้
- Approver ขึ้นไป Export PDF/CSV ได้

---

### 4. Daily Work (งานประจำวัน)

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ❌ | ✅ | ✅ | ✅ |
| `canCheckIn` | ❌ | ✅ | ✅ | ✅ |
| `canCheckOut` | ❌ | ✅ | ✅ | ✅ |
| `canViewOtherDays` | ❌ | ❌ | ✅ | ✅ |

**คำอธิบาย**:
- Viewer เข้าไม่ได้
- Approver เข้าได้และเช็คอิน/เอาท์ได้ แต่ดูได้เฉพาะ “วันนี้”
- Admin ขึ้นไปดูวันอื่นได้ด้วย

---

### 5. Reports (รายงาน)

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ❌ | ✅ | ✅ | ✅ |
| `canExport` | ❌ | ✅ | ✅ | ✅ |

**คำอธิบาย**:
- เฉพาะ Approver ขึ้นไปถึงเข้าได้
- ดูและ Export ได้

---

### 6. Users (จัดการผู้ใช้)

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ❌ | ❌ | ✅ | ✅ |
| `canEdit` | ❌ | ❌ | ✅ | ✅ |
| `canAdd` | ❌ | ❌ | ✅ | ✅ |
| `canDelete` | ❌ | ❌ | ❌ | ✅ |
| `canInvite` | ❌ | ❌ | ✅ | ✅ |

**คำอธิบาย**:
- Admin ขึ้นไปถึงเข้าได้
- ลบผู้ใช้ได้เฉพาะ Super Admin

---

### 7. Logs

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ❌ | ❌ | ❌ | ✅ |

**คำอธิบาย**:
- ดู Logs ได้เฉพาะ Super Admin

---

### 8. Cleanup

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ❌ | ❌ | ❌ | ✅ |
| `canDelete` | ❌ | ❌ | ❌ | ✅ |

**คำอธิบาย**:
- ใช้ลบข้อมูลทดสอบ/ข้อมูลเก่า เฉพาะ Super Admin

---

### 9. Settings (ตั้งค่า)

| Action | Viewer | Approver | Admin | Super Admin |
|--------|--------|----------|-------|-------------|
| `canView` | ❌ | ❌ | ❌ | ✅ |
| `canEdit` | ❌ | ❌ | ❌ | ✅ |

**คำอธิบาย**:
- ดูและแก้ค่าระบบได้เฉพาะ Super Admin

---

## 🔄 การเปลี่ยนแปลงจาก Legacy Capabilities

| Legacy Capability | → | New Page Permission |
|-------------------|---|---------------------|
| `view_dashboard` | → | `pagePermissions.dashboard.canView` |
| `view_reports` | → | `pagePermissions.reports.canView` |
| `approve_requests` | → | `pagePermissions.approvals.canApprove` |
| `review_requests` | → | `pagePermissions.approvals.canViewDetails` |
| `view_permits` | → | `pagePermissions.permits.canView` |
| `view_logs` | → | `pagePermissions.logs.canView` |
| `manage_users` | → | `pagePermissions.users.canEdit` |
| `manage_settings` | → | `pagePermissions.settings.canEdit` |
| `viewTodayWork` | → | `pagePermissions.dailyWork.canView` |
| `viewOtherDaysWork` | → | `pagePermissions.dailyWork.canViewOtherDays` |
| `checkInOut` | → | `pagePermissions.dailyWork.canCheckIn` + `canCheckOut` |
| `superadmin` | → | `role: "superadmin"` |

---

## 📦 โครงสร้างข้อมูลใน Firestore

```javascript
admins/{email}
{
  email: "user@example.com",
  name: "ชื่อผู้ใช้",
  role: "approver",
  enabled: true,
  
  // ✨ Granular Permissions
  pagePermissions: {
    dashboard: { canView: true },
    approvals: {
      canView: true,
      canViewDetails: true,
      canApprove: true,
      canReject: true,
      canExport: true
    },
    permits: {
      canView: true,
      canViewDetails: true,
      canExport: true
    },
    dailyWork: {
      canView: true,
      canCheckIn: true,
      canCheckOut: true,
      canViewOtherDays: false
    },
    reports: {
      canView: true,
      canExport: true
    },
    users: {
      canView: false,
      canEdit: false,
      canAdd: false,
      canDelete: false,
      canInvite: false
    },
    logs: {
      canView: false
    },
    cleanup: {
      canView: false
      , canDelete: false
    },
    settings: {
      canView: false,
      canEdit: false
    }
  },
  
  updatedAt: Timestamp,
  updatedBy: "admin@example.com"
}
