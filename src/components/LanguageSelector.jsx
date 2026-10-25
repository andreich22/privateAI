import React from 'react';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage, SUPPORTED_LANGUAGES } from '../i18n';

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  return (
    <label className="language-selector">
      <span>{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
        value={language}
        onChange={(event) => changeAppLanguage(event.target.value)}
      >
        {SUPPORTED_LANGUAGES.map((option) => (
          <option key={option} value={option}>{t(`common.languages.${option}`)}</option>
        ))}
      </select>
    </label>
  );
}
