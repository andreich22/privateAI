import React, { useState } from 'react';
import HFModelPicker from './HFModelPicker';

export default function AccessScreen({ fileName, onConfirm, onReset, onHF, error }) {
  const [selectedHFModel, setSelectedHFModel] = useState(null);

  return (
    <div className="screen centered">
      <h1>Обнаружена модель</h1>
      <p>{fileName}</p>
      <div className="btn-group">
        <button onClick={onConfirm} className="btn-main">Запустить</button>
        <button onClick={onHF} className="btn-sub">HF</button>
        <button onClick={onReset} className="btn-sub">Другой файл</button>
      </div>
      <HFModelPicker onSelect={setSelectedHFModel} />
      {selectedHFModel && (
        <div className="hf-selected-access" role="status">
          <strong>Выбрана модель HF:</strong> {selectedHFModel.id}
          <a href={selectedHFModel.url} target="_blank" rel="noreferrer">Открыть страницу модели</a>
        </div>
      )}
      {error && <p style={{ color: '#f38ba8', marginTop: 15, fontSize: 14 }}>{error}</p>}
    </div>
  );
}
