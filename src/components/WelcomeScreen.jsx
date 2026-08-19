import React from 'react';

export default function WelcomeScreen({ onSelect, onHF, error }) {
  return (
    <div className="screen centered">
      <h1>Локальный ИИ Чат</h1>
      <p>Загрузите GGUF модель с компьютера или из интернета.</p>
      <button onClick={onSelect} className="btn-main">Выбрать GGUF файл</button>
      <button onClick={onHF} className="btn-sub">Скачать Qwen3.8-2B (HF)</button>
      {error && <p style={{ color: '#f38ba8', marginTop: 15, fontSize: 14 }}>{error}</p>}
    </div>
  );
}
