import React, { useEffect, useState } from 'react';
import {
  loadGenerationSettings,
  resetGenerationSettings,
  saveGenerationSettings,
  validateGenerationSettings,
} from '../services/generationSettings';

export default function GenerationSettings({ conversation, onConversationChange, disabled, supported }) {
  const [settings, setSettings] = useState(loadGenerationSettings);
  const [draftPrompt, setDraftPrompt] = useState(conversation?.systemPrompt || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraftPrompt(conversation?.systemPrompt || '');
  }, [conversation?.id, conversation?.systemPrompt]);

  const updateSetting = (name, value) => {
    try {
      const next = validateGenerationSettings({ ...settings, [name]: value });
      setSettings(next);
      saveGenerationSettings(next);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePromptBlur = async () => {
    if (!conversation || draftPrompt === (conversation.systemPrompt || '')) return;
    await onConversationChange({ ...conversation, systemPrompt: draftPrompt });
  };

  const handleReset = () => {
    const defaults = resetGenerationSettings();
    setSettings(defaults);
    setError('');
  };

  return (
    <section className="settings-section">
      <div className="settings-section-title">Генерация</div>
      <label className="settings-field">
        <span>Системный промпт <small>только этот чат</small></span>
        <textarea
          value={draftPrompt}
          onChange={(e) => setDraftPrompt(e.target.value)}
          onBlur={handlePromptBlur}
          disabled={disabled || !conversation}
          rows={5}
          placeholder="Опишите роль и правила для модели…"
        />
      </label>

      {supported.temperature && (
        <label className="settings-field">
          <span>Temperature <strong>{settings.temperature}</strong></span>
          <input type="range" min="0" max="2" step="0.1" value={settings.temperature}
            onChange={(e) => updateSetting('temperature', e.target.value)} disabled={disabled} />
        </label>
      )}

      {supported.top_p && (
        <label className="settings-field">
          <span>Top P <strong>{settings.top_p}</strong></span>
          <input type="range" min="0.01" max="1" step="0.01" value={settings.top_p}
            onChange={(e) => updateSetting('top_p', e.target.value)} disabled={disabled} />
        </label>
      )}

      {supported.max_tokens && (
        <label className="settings-field">
          <span>Максимум токенов <strong>{settings.max_tokens}</strong></span>
          <input type="number" min="1" max="4096" step="1" value={settings.max_tokens}
            onChange={(e) => updateSetting('max_tokens', e.target.value)} disabled={disabled} />
        </label>
      )}

      {!supported.temperature && !supported.top_p && !supported.max_tokens && (
        <div className="settings-muted">Параметры генерации не поддерживаются текущим runtime.</div>
      )}
      {error && <div className="settings-error" role="alert">{error}</div>}
      <button className="settings-reset" type="button" onClick={handleReset} disabled={disabled}>Восстановить defaults</button>
    </section>
  );
}