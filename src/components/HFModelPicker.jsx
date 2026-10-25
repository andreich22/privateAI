import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import HuggingFaceModelSearch from './HuggingFaceModelSearch';

export default function HFModelPicker({ onSelect }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="hf-picker">
      {!open ? (
        <button type="button" className="btn-sub hf-picker-open" onClick={() => setOpen(true)}>
          {t('modelSearch.chooseAnother')}
        </button>
      ) : (
        <div>
          <HuggingFaceModelSearch
            initiallyOpen
            onSelect={(model) => {
              onSelect?.(model);
              setOpen(false);
            }}
          />
          <button type="button" className="btn-sub hf-picker-cancel" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
