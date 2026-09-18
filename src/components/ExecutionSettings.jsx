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
      try { setSettings(loadExecutionSettings(count)); }
      catch (err) { setError(err.message); }
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
    } catch (err) { setError(err.message); }
  };

  const handleApply = async () => {
    if (!onApply) return;
    setPending(true);
    try { await onApply(settings); setError(''); }
    catch (err) { setError(err.message); }
    finally { setPending(false); }
  };

  const handleReset = () => {
    const defaults = resetExecutionSettings();
    setSettings(defaults);
    setError('');
  };

  return (
    <section className="settings-section">
      <div className="settings-section-title">Производительность</div>
      {layerCount !== null ? (
        <>
          <label className="settings-field">
            <span>Слоёв на GPU <strong>{gpuLayers} / {layerCount}</strong></span>
            <input aria-label="Слоёв на GPU" type="range" min="0" max={layerCount} step="1"
              value={settings.n_gpu_layers === -1 ? layerCount : settings.n_gpu_layers}
              onChange={(e) => updateGpuLayers(e.target.value)} disabled={disabled || pending} />
          </label>
          <div className="layer-summary"><span>CPU <strong>{cpuLayers}</strong></span><span>GPU <strong>{gpuLayers}</strong></span></div>
        </>
      ) : (
        <div className="settings-muted">Количество слоёв модели появится после загрузки.</div>
      )}
      <div className="settings-hint">Изменение применяется после перезагрузки модели.</div>
      {error && <div className="settings-error" role="alert">{error}</div>}
      <div className="settings-actions">
        <button className="settings-primary" type="button" onClick={handleApply} disabled={disabled || pending || layerCount === null}>
          {pending ? 'Перезагрузка…' : 'Применить и перезагрузить'}
        </button>
        <button className="settings-reset" type="button" onClick={handleReset} disabled={disabled || pending}>По умолчанию</button>
      </div>
    </section>
  );
}