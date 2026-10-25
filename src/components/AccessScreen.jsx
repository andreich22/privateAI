import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import HFModelPicker from './HFModelPicker';
import UserError from './UserError';

export default function AccessScreen({ fileName, onConfirm, onReset, onHF, onSkip, error }) {
  const { t } = useTranslation();
  const [selectedHFModel, setSelectedHFModel] = useState(null);

  return (
    <div className="screen centered">
      <h1>{t('access.title')}</h1>
      <p>{fileName}</p>
      <div className="btn-group">
        <button onClick={onConfirm} className="btn-main">{t('access.start')}</button>
        <button onClick={onHF} className="btn-sub">{t('access.huggingFace')}</button>
        <button onClick={onReset} className="btn-sub">{t('access.otherFile')}</button>
        {onSkip && <button onClick={onSkip} className="btn-sub">{t('common.skipModel')}</button>}
      </div>
      <HFModelPicker onSelect={setSelectedHFModel} />
      {selectedHFModel && (
        <div className="hf-selected-access" role="status">
          <strong>{t('access.selectHfModel')}</strong> {selectedHFModel.id}
          <a href={selectedHFModel.url} target="_blank" rel="noreferrer">{t('access.openModelPage')}</a>
        </div>
      )}
      <UserError error={error} className="screen-error" />
    </div>
  );
}
