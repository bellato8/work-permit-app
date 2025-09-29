// ============================================================
// ไฟล์: src/data/store.ts
// หน้าที่: สตอร์เล็กๆ สำหรับ mock data + hook กระตุ้น re-render
// Persist: PERMITS / USERS / LOGS / DEPARTMENTS / LOCATIONS / WORKTYPES + CRUD
// ============================================================
import { useEffect, useState } from "react";
import {
  PERMITS_MOCK,
  USERS_MOCK,
  LOGS_MOCK,
  DEPARTMENTS_MOCK,
  LOCATIONS_MOCK,
  WORKTYPES_MOCK,
} from "./mock";
import type {
  Permit,
  PermitStatus,
  User,
  Role,
  LogRow,
  Department,
  Location,
  WorkType,
} from "./mock";

const STORAGE_PERMITS = "wp_permits_v1";
const STORAGE_USERS   = "wp_users_v1";
const STORAGE_LOGS    = "wp_logs_v1";
const STORAGE_DEPTS   = "wp_depts_v1";
const STORAGE_LOCS    = "wp_locs_v1";
const STORAGE_TYPES   = "wp_types_v1";

const nowISO = () => new Date().toISOString();

// ปรับปรุง: ตรวจสอบ role ให้ปลอดภัยขึ้น
const currentActor = (): { name: string; role: Role } => {
  const rawRole = localStorage.getItem("wp_role");
  const validRoles: Role[] = ["admin", "manager", "employee"];
  const role = validRoles.includes(rawRole as Role) ? (rawRole as Role) : "admin";
  
  return {
    name: localStorage.getItem("wp_name") || "System",
    role,
  };
};

// ฟังก์ชันตรวจสอบ data integrity
function validateArray<T>(
  data: unknown,
  validator: (item: any) => item is T
): data is T[] {
  return Array.isArray(data) && data.every(validator);
}

// Validators สำหรับแต่ละ type
const isPermit = (item: any): item is Permit => {
  return (
    typeof item?.rid === "string" &&
    typeof item?.applicant === "string" &&
    typeof item?.type === "string" &&
    typeof item?.location === "string" &&
    typeof item?.date === "string" &&
    typeof item?.status === "string" &&
    ["pending", "approved", "rejected", "returned"].includes(item.status)
  );
};

const isUser = (item: any): item is User => {
  return (
    typeof item?.uid === "string" &&
    typeof item?.name === "string" &&
    typeof item?.email === "string" &&
    typeof item?.role === "string" &&
    typeof item?.active === "boolean" &&
    ["admin", "manager", "employee"].includes(item.role)
  );
};

const isLogRow = (item: any): item is LogRow => {
  return (
    typeof item?.at === "string" &&
    typeof item?.action === "string" &&
    typeof item?.by?.name === "string" &&
    typeof item?.by?.role === "string" &&
    typeof item?.target === "string"
  );
};

const isMasterData = (item: any): item is { id: string; name: string } => {
  return typeof item?.id === "string" && typeof item?.name === "string";
};

// ---------- Storage Functions ----------
function loadFromStorage<T>(
  key: string,
  targetArray: T[],
  validator: (data: unknown) => data is T[]
): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    
    const data = JSON.parse(raw);
    if (!validator(data)) {
      console.warn(`Invalid data format in ${key}, using defaults`);
      return false;
    }
    
    targetArray.splice(0, targetArray.length, ...data);
    return true;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return false;
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
}

// Load functions
const loadPermitsFromLS = () => 
  loadFromStorage(STORAGE_PERMITS, PERMITS_MOCK as Permit[], 
    (data): data is Permit[] => validateArray(data, isPermit));

const loadUsersFromLS = () => 
  loadFromStorage(STORAGE_USERS, USERS_MOCK as User[], 
    (data): data is User[] => validateArray(data, isUser));

const loadLogsFromLS = () => 
  loadFromStorage(STORAGE_LOGS, LOGS_MOCK as LogRow[], 
    (data): data is LogRow[] => validateArray(data, isLogRow));

const loadDeptsFromLS = () => 
  loadFromStorage(STORAGE_DEPTS, DEPARTMENTS_MOCK as Department[], 
    (data): data is Department[] => validateArray(data, isMasterData));

const loadLocsFromLS = () => 
  loadFromStorage(STORAGE_LOCS, LOCATIONS_MOCK as Location[], 
    (data): data is Location[] => validateArray(data, isMasterData));

const loadTypesFromLS = () => 
  loadFromStorage(STORAGE_TYPES, WORKTYPES_MOCK as WorkType[], 
    (data): data is WorkType[] => validateArray(data, isMasterData));

// Save functions
const savePermitsToLS = () => saveToStorage(STORAGE_PERMITS, PERMITS_MOCK);
const saveUsersToLS = () => saveToStorage(STORAGE_USERS, USERS_MOCK);
const saveLogsToLS = () => saveToStorage(STORAGE_LOGS, LOGS_MOCK);
const saveDeptsToLS = () => saveToStorage(STORAGE_DEPTS, DEPARTMENTS_MOCK);
const saveLocsToLS = () => saveToStorage(STORAGE_LOCS, LOCATIONS_MOCK);
const saveTypesToLS = () => saveToStorage(STORAGE_TYPES, WORKTYPES_MOCK);

class MockStore {
  private _version = 1;
  private listeners = new Set<(v: number) => void>();

  constructor() {
    if (typeof window !== "undefined") {
      this.loadAllData();
    }
  }

  private loadAllData(): void {
    loadPermitsFromLS();
    loadUsersFromLS();
    loadLogsFromLS();
    loadDeptsFromLS();
    loadLocsFromLS();
    loadTypesFromLS();
  }

  get version() { return this._version; }
  
  private bump(): void { 
    this._version++; 
    this.listeners.forEach(cb => cb(this._version)); 
  }
  
  on(cb: (v: number) => void): () => void { 
    this.listeners.add(cb); 
    return () => this.listeners.delete(cb); 
  }

  // ===== Enhanced Logging =====
  addLog(action: string, target: string, note?: string, ip?: string): void {
    const logEntry: LogRow = {
      at: nowISO(),
      action,
      by: currentActor(),
      target,
      note,
      ip: ip || "local"
    };
    
    LOGS_MOCK.unshift(logEntry);
    
    // Keep only last 1000 logs to prevent storage bloat
    if (LOGS_MOCK.length > 1000) {
      LOGS_MOCK.splice(1000);
    }
    
    saveLogsToLS();
    this.bump();
  }

  // ----- Permits -----
  updatePermitStatus(rid: string, status: PermitStatus, note?: string): boolean {
    const rec = PERMITS_MOCK.find((p) => p.rid === rid);
    if (!rec) {
      console.warn(`Permit ${rid} not found`);
      return false;
    }

    const oldStatus = rec.status;
    rec.status = status;
    savePermitsToLS();
    
    const action = {
      approved: "PERMIT_APPROVE",
      rejected: "PERMIT_REJECT", 
      returned: "PERMIT_RETURN",
      pending: "PERMIT_STATUS_UPDATE"
    }[status] || "PERMIT_STATUS_UPDATE";
    
    this.addLog(action, rid, note || `${oldStatus} → ${status}`);
    this.bump();
    return true;
  }

  // เพิ่มฟังก์ชันหา permit
  getPermit(rid: string): Permit | undefined {
    return PERMITS_MOCK.find(p => p.rid === rid);
  }

  // ----- Users -----
  updateUserRole(uid: string, role: Role): boolean {
    const user = USERS_MOCK.find((x) => x.uid === uid);
    if (!user) {
      console.warn(`User ${uid} not found`);
      return false;
    }

    const oldRole = user.role;
    user.role = role;
    saveUsersToLS();
    this.addLog("USER_ROLE_UPDATE", `${uid} → ${role}`, `${oldRole} → ${role}`);
    this.bump();
    return true;
  }
  
  toggleUserActive(uid: string): boolean {
    const user = USERS_MOCK.find((x) => x.uid === uid);
    if (!user) {
      console.warn(`User ${uid} not found`);
      return false;
    }

    user.active = !user.active;
    saveUsersToLS();
    this.addLog(
      "USER_STATUS_TOGGLE", 
      `${uid} → ${user.active ? "active" : "inactive"}`,
      `Status changed for ${user.name}`
    );
    this.bump();
    return true;
  }

  // เพิ่มฟังก์ชันหา user
  getUser(uid: string): User | undefined {
    return USERS_MOCK.find(u => u.uid === uid);
  }

  // ----- Generic CRUD Helper -----
  private addMasterData<T extends { id: string; name: string }>(
    array: T[],
    name: string,
    prefix: string,
    saveFunc: () => void,
    logAction: string
  ): boolean {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    
    const duplicate = array.some(
      item => item.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) return false;
    
    const id = `${prefix}${Date.now().toString().slice(-6)}`;
    array.push({ id, name: trimmedName } as T);
    saveFunc();
    this.addLog(logAction, id, trimmedName);
    this.bump();
    return true;
  }

  private updateMasterData<T extends { id: string; name: string }>(
    array: T[],
    id: string,
    name: string,
    saveFunc: () => void,
    logAction: string
  ): boolean {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    
    const index = array.findIndex(item => item.id === id);
    if (index < 0) return false;
    
    const duplicate = array.some(
      item => item.id !== id && item.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) return false;
    
    const oldName = array[index].name;
    array[index].name = trimmedName;
    saveFunc();
    this.addLog(logAction, id, `${oldName} → ${trimmedName}`);
    this.bump();
    return true;
  }

  private deleteMasterData<T extends { id: string; name: string }>(
    array: T[],
    id: string,
    saveFunc: () => void,
    logAction: string
  ): boolean {
    const index = array.findIndex(item => item.id === id);
    if (index < 0) return false;
    
    const name = array[index].name;
    array.splice(index, 1);
    saveFunc();
    this.addLog(logAction, id, `Deleted: ${name}`);
    this.bump();
    return true;
  }

  // ----- Departments (CRUD) -----
  addDepartment(name: string): boolean {
    return this.addMasterData(DEPARTMENTS_MOCK, name, "D", saveDeptsToLS, "DEPT_ADD");
  }
  
  updateDepartment(id: string, name: string): boolean {
    return this.updateMasterData(DEPARTMENTS_MOCK, id, name, saveDeptsToLS, "DEPT_UPDATE");
  }
  
  deleteDepartment(id: string): boolean {
    return this.deleteMasterData(DEPARTMENTS_MOCK, id, saveDeptsToLS, "DEPT_DELETE");
  }

  // ----- Locations (CRUD) -----
  addLocation(name: string): boolean {
    return this.addMasterData(LOCATIONS_MOCK, name, "L", saveLocsToLS, "LOC_ADD");
  }
  
  updateLocation(id: string, name: string): boolean {
    return this.updateMasterData(LOCATIONS_MOCK, id, name, saveLocsToLS, "LOC_UPDATE");
  }
  
  deleteLocation(id: string): boolean {
    return this.deleteMasterData(LOCATIONS_MOCK, id, saveLocsToLS, "LOC_DELETE");
  }

  // ----- Work Types (CRUD) -----
  addWorkType(name: string): boolean {
    return this.addMasterData(WORKTYPES_MOCK, name, "T", saveTypesToLS, "TYPE_ADD");
  }
  
  updateWorkType(id: string, name: string): boolean {
    return this.updateMasterData(WORKTYPES_MOCK, id, name, saveTypesToLS, "TYPE_UPDATE");
  }
  
  deleteWorkType(id: string): boolean {
    return this.deleteMasterData(WORKTYPES_MOCK, id, saveTypesToLS, "TYPE_DELETE");
  }

  // ----- Utility Methods -----
  clearAllData(): void {
    // Clear localStorage
    Object.values({
      STORAGE_PERMITS,
      STORAGE_USERS,
      STORAGE_LOGS,
      STORAGE_DEPTS,
      STORAGE_LOCS,
      STORAGE_TYPES
    }).forEach(key => localStorage.removeItem(key));
    
    // Reset to original mock data
    window.location.reload();
  }

  exportData(): string {
    return JSON.stringify({
      permits: PERMITS_MOCK,
      users: USERS_MOCK,
      logs: LOGS_MOCK,
      departments: DEPARTMENTS_MOCK,
      locations: LOCATIONS_MOCK,
      workTypes: WORKTYPES_MOCK,
      exportedAt: nowISO()
    }, null, 2);
  }
}

export const mockStore = new MockStore();

export function useMockVersion(): number {
  const [version, setVersion] = useState(mockStore.version);
  
  useEffect(() => {
    const unsubscribe = mockStore.on(setVersion);
    return unsubscribe;
  }, []);
  
  return version;
}

// Export data objects for direct access
export {
  PERMITS_MOCK,
  USERS_MOCK,
  LOGS_MOCK,
  DEPARTMENTS_MOCK,
  LOCATIONS_MOCK,
  WORKTYPES_MOCK
};