import React from 'react';
import { useI18n } from '../i18n';

export default function WarningBanner() {
  const { t } = useI18n();
  return (
    <div className="bg-red-100 text-red-800 text-center p-2 text-sm">
      {t.warning}
    </div>
  );
}
