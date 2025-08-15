import React, { createContext, useContext, useState, ReactNode } from 'react';
import en from '../locales/en';
import th from '../locales/th';

export type Lang = 'en' | 'th';

const translations = { en, th };

interface I18nContextType {
  lang: Lang;
  t: typeof en;
  switchLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  t: en,
  switchLang: () => {},
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>('en');
  const switchLang = (l: Lang) => setLang(l);
  const t = translations[lang];
  return (
    <I18nContext.Provider value={{ lang, t, switchLang }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
