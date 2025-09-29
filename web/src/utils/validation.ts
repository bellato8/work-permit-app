export function onlyDigits(s: string) {
  return s.replace(/\D+/g, "");
}

export function validateThaiCitizenId(id: string) {
  // 13 digits + checksum
  const n = onlyDigits(id);
  if (n.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(n[i]) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(n[12]);
}

export function last4(s: string) {
  const n = onlyDigits(s);
  return n.slice(-4);
}
