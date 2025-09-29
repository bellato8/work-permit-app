// ไฟล์: web/src/i18n/index.tsx
// เวลา: 2025-08-22 15:05
// แก้อะไร: ผ่อนชนิด t ให้เป็นแบบทั่วไปเพื่อรองรับ en/th ที่มี string ต่างกัน (fix TS2322)
// Written by: Work Permit System Tutor

import React, { createContext, useContext, useState, ReactNode } from "react";
import en from "../locales/en";
import th from "../locales/th";

export type Lang = "en" | "th";

// ใช้ชนิดกว้างขึ้น (string) เพื่อเลี่ยง literal type clash
type Dict = Record<string, any>;
const translations: Record<Lang, Dict> = { en, th };

interface I18nContextType {
  lang: Lang;
  t: Dict;
  switchLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  t: en as unknown as Dict,
  switchLang: () => {},
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("en");
  const switchLang = (l: Lang) => setLang(l);
  const t = translations[lang];
  return (
    <I18nContext.Provider value={{ lang, t, switchLang }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
