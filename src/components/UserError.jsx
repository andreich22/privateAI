import React from 'react';
import { useTranslation } from 'react-i18next';

export default function UserError({ error, className }) {
  const { t } = useTranslation();
  if (!error) return null;

  const errorKey = typeof error === 'string' ? null : error.key;
  const details = typeof error === 'string' ? error : error.details;

  return (
    <div className={className} role="alert">
      <div>{errorKey ? t(errorKey) : t('common.errors.operationFailed')}</div>
      {details && (
        <details>
          <summary>{t('common.errors.details')}</summary>
          <code>{details}</code>
        </details>
      )}
    </div>
  );
}
