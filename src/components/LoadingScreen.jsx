import React from 'react';

export default function LoadingScreen({ progress, fileName, error }) {
  return (
    <div className="screen centered">
      <h1>Загрузка модели в оперативную память</h1>
      <p>{fileName}</p>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="progress-text">{progress}%</div>
      {error && <p style={{ color: '#f38ba8', marginTop: 15, fontSize: 14 }}>{error}</p>}
    </div>
  );
}
