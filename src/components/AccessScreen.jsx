import React from 'react';

export default function AccessScreen({ fileName, onConfirm, onReset, onHF, error }) {
  return (
    <div className="screen centered">
      <h1>Обнаружена модель</h1>
      <p>{fileName}</p>
      <div className="btn-group">
        <button onClick={onConfirm} className="btn-main">Запустить</button>
        <button onClick={onHF} className="btn-sub">HF</button>
        <button onClick={onReset} className="btn-sub">Другой файл</button>
      </div>
      {error && <p style={{ color: '#f38ba8', marginTop: 15, fontSize: 14 }}>{error}</p>}
    </div>
  );
}
