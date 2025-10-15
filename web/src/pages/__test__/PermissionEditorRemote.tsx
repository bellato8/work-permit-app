import React, { useState } from "react";
import { Button, CircularProgress, Alert, List, ListItem, ListItemText } from "@mui/material";
import PermissionEditor from "../../components/PermissionEditor";
import { useAdminPermissions } from "../../hooks/useAdminPermissions";
import { getDefaultPermissions } from "../../lib/defaultPermissions";
import { PagePermissions } from "../../types/permissions";

export default function PermissionEditorRemote() {
  const { admins, loading, error, refreshAdmins, updatePermissions } = useAdminPermissions();
  const [open, setOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<string>("viewer");

  if (loading) return <div style={{ padding: 20 }}><CircularProgress /></div>;
  if (error) return <div style={{ padding: 20 }}><Alert severity="error">{error}</Alert></div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Admins: {admins.length}</h2>
      <Button onClick={refreshAdmins}>REFRESH</Button>

      <List dense>
        {admins.map((a) => (
          <ListItem
            key={a.email}
            secondaryAction={
              <Button
                variant="outlined"
                onClick={() => {
                  setTargetEmail(a.email);
                  setTargetRole(a.role || "viewer");
                  setOpen(true);
                }}
              >
                แก้ไขสิทธิ์
              </Button>
            }
          >
            <ListItemText primary={a.email} secondary={a.role} />
          </ListItem>
        ))}
      </List>

      {targetEmail && (
        <PermissionEditor
          open={open}
          onClose={() => setOpen(false)}
          email={targetEmail}
          role={targetRole}
          // ตอนนี้ยังไม่มีค่า pagePermissions จริงจาก backend
          // ใช้ค่า default จาก role ไปก่อนเพื่อทดสอบการอัปเดต
          currentPermissions={getDefaultPermissions(targetRole)}
          onSave={async (perms: PagePermissions) => {
            await updatePermissions(targetEmail, perms);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
