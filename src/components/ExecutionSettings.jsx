import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  loadExecutionSettings,
  resetExecutionSettings,
  saveExecutionSettings,
  validateExecutionSettings,
} from '../services/executionSettings';
import UserError from './UserError';

export default function ExecutionSettings({ runtime, disabled, onApply }) {
  const { t } = useTranslation();
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
      catch (err) { setError({ key: 'settings.validationError', details: err.message }); }
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
    } catch (err) { setError({ key: 'settings.validationError', details: err.message }); }
  };

  const handleApply = async () => {
    if (!onApply) return;
    setPending(true);
    try { await onApply(settings); setError(''); }
    catch (err) { setError({ key: 'settings.operationFailed', details: err.message }); }
    finally { setPending(false); }
  };

  const handleReset = () => {
    const defaults = resetExecutionSettings();
    setSettings(defaults);
    setError('');
  };

  return (
    <section className="settings-section">
      <div className="settings-section-title">{t('settings.performance')}</div>
      {layerCount !== null ? (
        <>
          <label className="settings-field">
            <span>{t('settings.gpuLayers')} <strong>{gpuLayers} / {layerCount}</strong></span>
            <input aria-label={t('settings.gpuLayers')} type="range" min="0" max={layerCount} step="1"
              value={settings.n_gpu_layers === -1 ? layerCount : settings.n_gpu_layers}
              onChange={(e) => updateGpuLayers(e.target.value)} disabled={disabled || pending} />
          </label>
          <div className="layer-summary"><span>{t('settings.cpu')} <strong>{cpuLayers}</strong></span><span>{t('settings.gpu')} <strong>{gpuLayers}</strong></span></div>
        </>
      ) : (
        <div className="settings-muted">{t('settings.layersAfterLoad')}</div>
      )}
      <div className="settings-hint">{t('settings.reloadHint')}</div>
      <UserError error={error} className="settings-error" />
      <div className="settings-actions">
        <button className="settings-primary" type="button" onClick={handleApply} disabled={disabled || pending || layerCount === null}>
          {pending ? t('settings.reloading') : t('settings.applyAndReload')}
        </button>
        <button className="settings-reset" type="button" onClick={handleReset} disabled={disabled || pending}>{t('settings.default')}</button>
      </div>
    </section>
  );
}