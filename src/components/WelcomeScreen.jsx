import React from 'react';

export default function WelcomeScreen({ onSelect }) {
  return (
    <div className="screen centered">
      <h1>Локальный ИИ Чат</h1>
      <p>Выберите файл модели GGUF со своего компьютера, чтобы начать.</p>
      <button onClick={onSelect} className="btn-main">Указать путь к GGUF модели</button>
    </div>
  );
}
