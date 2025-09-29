// ============================================================
// ไฟล์: src/pages/admin/Settings.tsx
// หน้าที่: Master Data — Departments / Locations / Work Types / Safety Checklists
// คุณสมบัติ:
//  - CRUD ทั้ง 4 หมวด (persist ใน localStorage)
//  - Checklist ผูกกับ Work Types (many-to-many)
//  - เขียน System Logs ผ่าน mockStore.addLog
//  - ใช้คลาสจาก index.css (.btn, .input, .badge ฯลฯ)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { mockStore, useMockVersion } from "../../data/store";

type Id = string;
type Department = { id: Id; name: string };
type Location = { id: Id; name: string };
type WorkType = { id: Id; name: string };
type Checklist = {
  id: Id;
  name: string;
  items: string[];      // คำถามแต่ละข้อ
  workTypeIds: Id[];    // ผูกกับประเภทงาน
};

const LS_DEPT = "wp_master_departments";
const LS_LOC  = "wp_master_locations";
const LS_WT   = "wp_master_worktypes";
const LS_CHK  = "wp_master_checklists";

// --------- Utils ---------
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}
function save<T>(key: string, v: T) {
  localStorage.setItem(key, JSON.stringify(v));
}

export default function Settings() {
  useMockVersion(); // ให้หน้ารีเฟรชเมื่อมี Logs เปลี่ยน

  // --- Seeds เบื้องต้น ---
  const seedDept: Department[] = [
    { id: uid(), name: "ซ่อมบำรุง" },
    { id: uid(), name: "ผลิต" },
    { id: uid(), name: "ความปลอดภัย" },
  ];
  const seedLoc: Location[] = [
    { id: uid(), name: "โซน A" },
    { id: uid(), name: "โซน B" },
    { id: uid(), name: "คลังวัตถุดิบ" },
  ];
  const seedWt: WorkType[] = [
    { id: uid(), name: "งานไฟฟ้า" },
    { id: uid(), name: "งานที่สูง" },
    { id: uid(), name: "งานในที่อับอากาศ" },
    { id: uid(), name: "งานเชื่อม" },
  ];
  const seedChk: Checklist[] = [
    { id: uid(), name: "พื้นฐานก่อนเริ่มงาน", items: [
      "ผู้ปฏิบัติงานสวม PPE ครบถ้วน",
      "ตรวจสภาพอุปกรณ์ก่อนใช้งาน",
      "มีผู้ควบคุมงานประจำจุด",
    ], workTypeIds: [] },
  ];

  // --- States ---
  const [departments, setDepartments] = useState<Department[]>(() => load(LS_DEPT, seedDept));
  const [locations,   setLocations]   = useState<Location[]>(() => load(LS_LOC, seedLoc));
  const [workTypes,   setWorkTypes]   = useState<WorkType[]>(() => load(LS_WT, seedWt));
  const [checklists,  setChecklists]  = useState<Checklist[]>(() => load(LS_CHK, seedChk));

  // ฟอร์มเพิ่มใหม่ (inline)
  const [deptName, setDeptName] = useState("");
  const [locName,  setLocName]  = useState("");
  const [wtName,   setWtName]   = useState("");
  const [newChkName, setNewChkName] = useState("");
  const [newChkItems, setNewChkItems] = useState("ใส่ PPE, ตรวจอุปกรณ์"); // คั่นด้วยคอมมา
  const [newChkWts, setNewChkWts] = useState<Id[]>([]);

  // บันทึกเมื่อ state เปลี่ยน
  useEffect(() => save(LS_DEPT, departments), [departments]);
  useEffect(() => save(LS_LOC,  locations),   [locations]);
  useEffect(() => save(LS_WT,   workTypes),   [workTypes]);
  useEffect(() => save(LS_CHK,  checklists),  [checklists]);

  // --------- Departments ---------
  const addDept = () => {
    const name = clean(deptName);
    if (!name) return;
    const d: Department = { id: uid(), name };
    setDepartments((prev) => [...prev, d]);
    setDeptName("");
    mockStore.addLog("MASTER_DEPT_ADD", d.id, d.name);
  };
  const renameDept = (id: Id, name: string) => {
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, name: clean(name) } : d));
    mockStore.addLog("MASTER_DEPT_RENAME", id, clean(name));
  };
  const removeDept = (id: Id) => {
    if (!confirm("ยืนยันลบแผนกนี้?")) return;
    setDepartments(prev => prev.filter(d => d.id !== id));
    mockStore.addLog("MASTER_DEPT_REMOVE", id);
  };

  // --------- Locations ---------
  const addLoc = () => {
    const name = clean(locName);
    if (!name) return;
    const l: Location = { id: uid(), name };
    setLocations((prev) => [...prev, l]);
    setLocName("");
    mockStore.addLog("MASTER_LOC_ADD", l.id, l.name);
  };
  const renameLoc = (id: Id, name: string) => {
    setLocations(prev => prev.map(x => x.id === id ? { ...x, name: clean(name) } : x));
    mockStore.addLog("MASTER_LOC_RENAME", id, clean(name));
  };
  const removeLoc = (id: Id) => {
    if (!confirm("ยืนยันลบสถานที่นี้?")) return;
    setLocations(prev => prev.filter(x => x.id !== id));
    mockStore.addLog("MASTER_LOC_REMOVE", id);
  };

  // --------- Work Types ---------
  const addWt = () => {
    const name = clean(wtName);
    if (!name) return;
    const w: WorkType = { id: uid(), name };
    setWorkTypes(prev => [...prev, w]);
    setWtName("");
    mockStore.addLog("MASTER_WT_ADD", w.id, w.name);
  };
  const renameWt = (id: Id, name: string) => {
    setWorkTypes(prev => prev.map(x => x.id === id ? { ...x, name: clean(name) } : x));
    mockStore.addLog("MASTER_WT_RENAME", id, clean(name));
  };
  const removeWt = (id: Id) => {
    if (!confirm("ยืนยันลบประเภทงานนี้? รายการนี้จะถูกนำออกจาก Checklist ที่เกี่ยวข้องด้วย")) return;
    setWorkTypes(prev => prev.filter(x => x.id !== id));
    // ถอด id นี้ออกจากทุก Checklist
    setChecklists(prev => prev.map(c => ({ ...c, workTypeIds: c.workTypeIds.filter(wid => wid !== id) })));
    mockStore.addLog("MASTER_WT_REMOVE", id);
  };

  // --------- Checklists ---------
  const addChecklist = () => {
    const name = clean(newChkName);
    if (!name) return;
    const items = newChkItems.split(",").map(s => clean(s)).filter(Boolean);
    const uniqWts = Array.from(new Set(newChkWts));
    const c: Checklist = { id: uid(), name, items, workTypeIds: uniqWts };
    setChecklists(prev => [...prev, c]);
    setNewChkName(""); setNewChkItems(""); setNewChkWts([]);
    mockStore.addLog("MASTER_CHK_ADD", c.id, `${c.name} (${c.items.length} ข้อ)`);
  };

  const renameChecklist = (id: Id, name: string) => {
    setChecklists(prev => prev.map(c => c.id === id ? ({ ...c, name: clean(name) }) : c));
    mockStore.addLog("MASTER_CHK_RENAME", id, clean(name));
  };

  const setChecklistItems = (id: Id, itemsStr: string) => {
    const items = itemsStr.split("\n").map(s => clean(s)).filter(Boolean);
    setChecklists(prev => prev.map(c => c.id === id ? ({ ...c, items }) : c));
    mockStore.addLog("MASTER_CHK_EDIT_ITEMS", id, `${items.length} ข้อ`);
  };

  const toggleChecklistWorkType = (id: Id, wtId: Id) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== id) return c;
      const has = c.workTypeIds.includes(wtId);
      const workTypeIds = has ? c.workTypeIds.filter(x => x !== wtId) : [...c.workTypeIds, wtId];
      return { ...c, workTypeIds };
    }));
    mockStore.addLog("MASTER_CHK_TOGGLE_WT", id, wtId);
  };

  const removeChecklist = (id: Id) => {
    if (!confirm("ยืนยันลบ Checklist นี้?")) return;
    setChecklists(prev => prev.filter(c => c.id !== id));
    mockStore.addLog("MASTER_CHK_REMOVE", id);
  };

  // การนับเพื่อโชว์หัวการ์ด
  const counts = useMemo(() => ({
    dept: departments.length,
    loc: locations.length,
    wt: workTypes.length,
    chk: checklists.length,
  }), [departments, locations, workTypes, checklists]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">System Settings / Master Data</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="แผนก" value={counts.dept} />
        <Card label="สถานที่ปฏิบัติงาน" value={counts.loc} />
        <Card label="ประเภทงาน" value={counts.wt} />
        <Card label="Safety Checklists" value={counts.chk} />
      </div>

      {/* Departments */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="heading text-sm font-medium">จัดการแผนก (Departments)</div>
        <div className="flex gap-2">
          <input className="input" placeholder="ชื่อแผนก เช่น ซ่อมบำรุง"
                 value={deptName} onChange={(e)=>setDeptName(e.target.value)} />
          <button className="btn" onClick={addDept}>+ Add</button>
        </div>
        <SimpleList
          rows={departments}
          onRename={renameDept}
          onRemove={removeDept}
          emptyText="ยังไม่มีแผนก"
        />
      </section>

      {/* Locations */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="heading text-sm font-medium">จัดการสถานที่ปฏิบัติงาน (Locations)</div>
        <div className="flex gap-2">
          <input className="input" placeholder="ชื่อโซน/พื้นที่ เช่น โซน A"
                 value={locName} onChange={(e)=>setLocName(e.target.value)} />
          <button className="btn" onClick={addLoc}>+ Add</button>
        </div>
        <SimpleList
          rows={locations}
          onRename={renameLoc}
          onRemove={removeLoc}
          emptyText="ยังไม่มีสถานที่"
        />
      </section>

      {/* Work Types */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="heading text-sm font-medium">จัดการประเภทงาน (Work Permit Types)</div>
        <div className="flex gap-2">
          <input className="input" placeholder="ชื่อประเภทงาน เช่น งานไฟฟ้า"
                 value={wtName} onChange={(e)=>setWtName(e.target.value)} />
          <button className="btn" onClick={addWt}>+ Add</button>
        </div>
        <SimpleList
          rows={workTypes}
          onRename={renameWt}
          onRemove={removeWt}
          emptyText="ยังไม่มีประเภทงาน"
        />
      </section>

      {/* Safety Checklists */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
        <div className="heading text-sm font-medium">จัดการ Safety Checklists</div>

        {/* Add new checklist */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="label">ชื่อ Checklist</label>
            <input className="input" placeholder="เช่น Checklist งานไฟฟ้า (ก่อนเริ่มงาน)"
                   value={newChkName} onChange={(e)=>setNewChkName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="label">ข้อคำถามเบื้องต้น (คั่นด้วย , )</label>
            <input className="input" placeholder="ใส่ PPE, ตรวจอุปกรณ์, ..."
                   value={newChkItems} onChange={(e)=>setNewChkItems(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="label">ผูกกับประเภทงาน (เลือกได้หลายอัน)</div>
            <div className="flex flex-wrap gap-2">
              {workTypes.map(w => {
                const checked = newChkWts.includes(w.id);
                return (
                  <label key={w.id} className={`px-3 py-1 rounded-xl border cursor-pointer ${checked ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"}`}>
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={checked}
                      onChange={()=>{
                        setNewChkWts(prev => prev.includes(w.id) ? prev.filter(x=>x!==w.id) : [...prev, w.id]);
                      }}
                    />
                    {w.name}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <button className="btn" onClick={addChecklist}>+ Add Checklist</button>
          </div>
        </div>

        {/* List all checklists */}
        <div className="rounded-2xl border bg-white p-2 sm:p-4 shadow-sm overflow-x-auto">
          <table className="min-w-[900px] w-full table-basic">
            <thead>
              <tr>
                <th className="py-2 px-3">ชื่อ</th>
                <th className="py-2 px-3">ข้อคำถาม</th>
                <th className="py-2 px-3">ผูกกับประเภทงาน</th>
                <th className="py-2 px-3">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {checklists.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="py-2 px-3">
                    <input
                      className="w-full rounded-lg border px-2 py-1 text-sm"
                      value={c.name}
                      onChange={(e)=>renameChecklist(c.id, e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-3">
                    <textarea
                      className="w-full rounded-lg border px-2 py-1 text-sm min-h-[100px]"
                      placeholder={"พิมพ์ 1 ข้อต่อ 1 บรรทัด"}
                      value={c.items.join("\n")}
                      onChange={(e)=>setChecklistItems(c.id, e.target.value)}
                    />
                    <div className="text-xs text-gray-500 mt-1">{c.items.length} ข้อ</div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-2">
                      {workTypes.map(w=>{
                        const checked = c.workTypeIds.includes(w.id);
                        return (
                          <label key={w.id} className={`px-3 py-1 rounded-xl border cursor-pointer ${checked ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"}`}>
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={checked}
                              onChange={()=>toggleChecklistWorkType(c.id, w.id)}
                            />
                            {w.name}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <button className="btn" onClick={()=>removeChecklist(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {checklists.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-sm text-gray-500">ยังไม่มี Checklist</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-xs text-gray-500">
        หมายเหตุ: การเปลี่ยนแปลงทั้งหมดบันทึกในเครื่อง (localStorage) และเขียนลง System Logs (MASTER_*).
      </div>
    </div>
  );
}

// ----------------- sub components -----------------
function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function SimpleList({
  rows,
  onRename,
  onRemove,
  emptyText,
}: {
  rows: { id: Id; name: string }[];
  onRename: (id: Id, name: string) => void;
  onRemove: (id: Id) => void;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <div className="text-sm text-gray-500">{emptyText}</div>;
  }
  return (
    <div className="rounded-2xl border bg-white p-2 sm:p-4 shadow-sm overflow-x-auto">
      <table className="min-w-[600px] w-full table-basic">
        <thead>
          <tr>
            <th className="py-2 px-3">ชื่อ</th>
            <th className="py-2 px-3 w-[160px]">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 px-3">
                <input
                  className="w-full rounded-lg border px-2 py-1 text-sm"
                  value={r.name}
                  onChange={(e)=>onRename(r.id, e.target.value)}
                />
              </td>
              <td className="py-2 px-3">
                <button className="btn" onClick={()=>onRemove(r.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
