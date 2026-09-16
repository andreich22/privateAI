import React, { useState } from 'react';
import HuggingFaceModelSearch from './HuggingFaceModelSearch';

export default function WelcomeScreen({ onSelect, onHF, error }) {
  const [selectedModel, setSelectedModel] = useState(null);

  const handleSelect = (model) => {
    setSelectedModel(model);
  };

  return (
    <div className="screen centered">
      <h1>Локальный ИИ Чат</h1>
      <p>Загрузите GGUF модель с компьютера или из интернета.</p>
      <div>
        <button onClick={onSelect} className="btn-main">Выбрать GGUF файл</button>
        <button onClick={onHF} className="btn-sub">Скачать Qwen3.8-2B (HF)</button>
      </div>
      {selectedModel && (
        <p className="hf-selected" role="status">
          Выбрана модель: <strong>{selectedModel.id}</strong>. Откройте страницу модели, чтобы выбрать подходящий GGUF-файл.
        </p>
      )}
      {error && <p style={{ color: '#f38ba8', marginTop: 15, fontSize: 14 }}>{error}</p>}
      <HuggingFaceModelSearch onSelect={handleSelect} />
    </div>
  );
}
