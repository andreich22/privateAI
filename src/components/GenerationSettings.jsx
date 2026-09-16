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
    <details style={{ padding: '8px 15px', borderBottom: '1px solid #333' }}>
      <summary style={{ cursor: 'pointer' }}>Настройки генерации</summary>
      <div style={{ display: 'grid', gap: 10, paddingTop: 10, maxWidth: 720 }}>
        <label>
          Системный промпт (только этот чат)
          <textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            onBlur={handlePromptBlur}
            disabled={disabled || !conversation}
            rows={3}
            style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
          />
        </label>

        {supported.temperature && (
          <label>
            Temperature: {settings.temperature}
            <input
              type="range" min="0" max="2" step="0.1"
              value={settings.temperature}
              onChange={(e) => updateSetting('temperature', e.target.value)}
              disabled={disabled}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        )}

        {supported.top_p && (
          <label>
            Top P: {settings.top_p}
            <input
              type="range" min="0.01" max="1" step="0.01"
              value={settings.top_p}
              onChange={(e) => updateSetting('top_p', e.target.value)}
              disabled={disabled}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        )}

        {supported.max_tokens && (
          <label>
            Максимум токенов: {settings.max_tokens}
            <input
              type="number" min="1" max="4096" step="1"
              value={settings.max_tokens}
              onChange={(e) => updateSetting('max_tokens', e.target.value)}
              disabled={disabled}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        )}

        {!supported.temperature && !supported.top_p && !supported.max_tokens && (
          <div>Параметры генерации не поддерживаются текущим runtime.</div>
        )}
        {error && <div role="alert">{error}</div>}
        <button type="button" onClick={handleReset} disabled={disabled}>Восстановить defaults</button>
      </div>
    </details>
  );
}
