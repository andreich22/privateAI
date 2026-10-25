import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import HuggingFaceModelSearch from './HuggingFaceModelSearch';
import UserError from './UserError';

export default function WelcomeScreen({ onSelect, onHF, onSkip, error }) {
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState(null);

  const handleSelect = (model) => {
    setSelectedModel(model);
  };

  return (
    <div className="screen centered">
      <h1>{t('welcome.title')}</h1>
      <p>{t('welcome.description')}</p>
      <div className="btn-group">
        <button onClick={onSelect} className="btn-main">{t('common.chooseGguf')}</button>
        <button onClick={onHF} className="btn-sub">{t('welcome.downloadQwen')}</button>
        {onSkip && <button onClick={onSkip} className="btn-sub">{t('common.skipModel')}</button>}
      </div>
      {selectedModel && (
        <p className="hf-selected" role="status">
          {t('welcome.selectedModelLabel')} <strong>{selectedModel.id}</strong>. {t('welcome.selectedModelDetail')}
        </p>
      )}
      <UserError error={error} className="screen-error" />
      <HuggingFaceModelSearch onSelect={handleSelect} />
    </div>
  );
}
