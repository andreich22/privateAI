import React, { useState } from 'react';
import HuggingFaceModelSearch from './HuggingFaceModelSearch';

export default function HFModelPicker({ onSelect }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="hf-picker">
      {!open ? (
        <button type="button" className="btn-sub hf-picker-open" onClick={() => setOpen(true)}>
          Выбрать другую модель из HF
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
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
