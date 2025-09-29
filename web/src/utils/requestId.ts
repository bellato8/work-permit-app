export function makeRequestId() {
  // ตัวอย่าง: WP-20250817-AB12
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const rand = Array.from({length:4}, ()=> "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
  return `WP-${ymd}-${rand}`;
}
