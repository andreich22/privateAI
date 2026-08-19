import React from 'react';

export default function AccessScreen({ fileName, onConfirm, onReset }) {
  return (
    <div className="screen centered">
      <h1>Обнаружена сохраненная модель</h1>
      <p>Файл: <strong>{fileName}</strong></p>
      <div className="btn-group">
        <button onClick={onConfirm} className="btn-main">Запустить модель</button>
        <button onClick={onReset} className="btn-sub">Выбрать другой файл</button>
      </div>
    </div>
  );
}
