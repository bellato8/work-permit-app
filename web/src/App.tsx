import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import FormPage from './pages/FormPage';
import StatusPage from './pages/StatusPage';
import AdminPage from './pages/AdminPage';
import { I18nProvider, useI18n } from './i18n';
import WarningBanner from './components/WarningBanner';

function Nav() {
  const { t, lang, switchLang } = useI18n();
  return (
    <nav className="p-2 flex space-x-4 bg-gray-200">
      <Link to="/form">{t.nav.form}</Link>
      <Link to="/status">{t.nav.status}</Link>
      <Link to="/admin">{t.nav.admin}</Link>
      <button onClick={() => switchLang(lang === 'en' ? 'th' : 'en')}>
        {lang === 'en' ? 'TH' : 'EN'}
      </button>
    </nav>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <WarningBanner />
        <Nav />
        <Routes>
          <Route path="/form" element={<FormPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
