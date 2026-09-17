import React, { useEffect, useState } from 'react';
import {
  loadExecutionSettings,
  resetExecutionSettings,
  saveExecutionSettings,
  validateExecutionSettings,
} from '../services/executionSettings';

export default function ExecutionSettings({ runtime, disabled, onApply }) {
  const [settings, setSettings] = useState(loadExecutionSettings());
  const [layerCount, setLayerCount] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const context = runtime?.getContextInfo?.();
      const count = Number.isInteger(context?.n_layer) ? context.n_layer : null;
      setLayerCount(count);
      try {
        setSettings(loadExecutionSettings(count));
      } catch (err) {
        setError(err.message);
      }
    };
    refresh();
    return runtime?.subscribe?.(() => refresh());
  }, [runtime]);

  const gpuLayers = settings.n_gpu_layers === -1 ? layerCount : settings.n_gpu_layers;
  const cpuLayers = layerCount === null || gpuLayers === null ? null : Math.max(0, layerCount - gpuLayers);

  const updateGpuLayers = (value) => {
    try {
      const next = validateExecutionSettings({ ...settings, n_gpu_layers: Number(value) }, layerCount);
      setSettings(next);
      saveExecutionSettings(next, layerCount);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApply = async () => {
    if (!onApply) return;
    setPending(true);
    try {
      await onApply(settings);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  };

  const handleReset = () => {
    const defaults = resetExecutionSettings();
    setSettings(defaults);
    setError('');
  };

  return (
    <details style={{ padding: '8px 15px', borderBottom: '1px solid #333' }}>
      <summary style={{ cursor: 'pointer' }}>CPU / GPU слои</summary>
      <div style={{ display: 'grid', gap: 10, paddingTop: 10, maxWidth: 720 }}>
        {layerCount !== null ? (
          <>
            <label>
              Слоёв на GPU: {gpuLayers} из {layerCount}
              <input
                aria-label="Слоёв на GPU"
                type="range"
                min="0"
                max={layerCount}
                step="1"
                value={settings.n_gpu_layers === -1 ? layerCount : settings.n_gpu_layers}
                onChange={(e) => updateGpuLayers(e.target.value)}
                disabled={disabled || pending}
                style={{ display: 'block', width: '100%' }}
              />
            </label>
            <div style={{ color: '#aaa', fontSize: 12 }}>
              CPU: {cpuLayers} слоёв · GPU: {gpuLayers} слоёв
            </div>
          </>
        ) : (
          <div style={{ color: '#aaa' }}>Количество слоёв модели недоступно до загрузки.</div>
        )}
        <div style={{ color: '#888', fontSize: 12 }}>
          Изменение применяется после перезагрузки модели.
        </div>
        {error && <div role="alert">{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleApply} disabled={disabled || pending || layerCount === null}>
            {pending ? 'Перезагрузка...' : 'Применить и перезагрузить'}
          </button>
          <button type="button" onClick={handleReset} disabled={disabled || pending}>По умолчанию</button>
        </div>
      </div>
    </details>
  );
}
