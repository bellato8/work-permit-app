// web/src/pages/__test__/TestCheckboxGroup.tsx
import { useState } from "react";
import PermissionCheckboxGroup from "../../components/PermissionCheckboxGroup";
// ถ้ายังไม่ได้ย้ายไฟล์คอมโพเนนต์มาไว้ที่ src/components
// ให้เปลี่ยนบรรทัดบนเป็น:
// import PermissionCheckboxGroup from "../../constants/PermissionCheckboxGroup";

export default function TestCheckboxGroup() {
  const [perms, setPerms] = useState({
    canView: true,
    canViewDetails: true,
    canApprove: false,
    canReject: false,
    canExport: false,
  });

  const handleChange = (key: string, value: boolean) => {
    setPerms((prev) => ({ ...prev, [key]: value }));
    console.log(key, value);
  };

  return (
    <div style={{ padding: 16 }}>
      <PermissionCheckboxGroup
        page="approvals"
        permissions={perms}
        onChange={handleChange}
      />
    </div>
  );
}
