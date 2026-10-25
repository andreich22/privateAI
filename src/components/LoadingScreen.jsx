import React from 'react';
import { useTranslation } from 'react-i18next';
import UserError from './UserError';

export default function LoadingScreen({ progress, fileName, error, onCancel }) {
  const { t } = useTranslation();
  return (
    <div className="screen centered">
      <h1>{t('loading.title')}</h1>
      {fileName && <p>{fileName}</p>}
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="progress-text">{progress}%</div>
      {onCancel && (
        <button className="btn-danger" onClick={onCancel} style={{ marginTop: 15 }}>
          {t('common.cancel')}
        </button>
      )}
      <UserError error={error} className="screen-error" />
    </div>
  );
}
