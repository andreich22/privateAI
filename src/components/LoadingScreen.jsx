import React from 'react';

export default function LoadingScreen({ progress, fileName }) {
  return (
    <div className="screen centered">
      <h1>Загрузка модели в оперативную память</h1>
      <p>{fileName}</p>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="progress-text">{progress}%</div>
    </div>
  );
}
