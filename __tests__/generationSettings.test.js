import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_GENERATION_SETTINGS,
  loadGenerationSettings,
  resetGenerationSettings,
  saveGenerationSettings,
  validateGenerationSettings,
} from '../src/services/generationSettings.js';

describe('generation settings', () => {
  beforeEach(() => localStorage.clear());

  it('returns defaults when nothing is stored', () => {
    expect(loadGenerationSettings()).toEqual(DEFAULT_GENERATION_SETTINGS);
  });

  it('validates and persists supported settings', () => {
    const settings = saveGenerationSettings({ temperature: '1.2', top_p: '0.8', max_tokens: '1024' });
    expect(settings).toEqual({ temperature: 1.2, top_p: 0.8, max_tokens: 1024 });
    expect(loadGenerationSettings()).toEqual(settings);
  });

  it.each([
    ['temperature', { temperature: -0.1 }],
    ['temperature', { temperature: 2.1 }],
    ['top_p', { top_p: 0 }],
    ['top_p', { top_p: 1.1 }],
    ['max_tokens', { max_tokens: 0 }],
    ['max_tokens', { max_tokens: 4097 }],
    ['max_tokens', { max_tokens: 1.5 }],
  ])('rejects invalid %s values', (_name, value) => {
    expect(() => validateGenerationSettings(value)).toThrow(RangeError);
  });

  it('falls back to defaults when persisted JSON is invalid', () => {
    localStorage.setItem('private-ai:generation-settings:v1', '{invalid');
    expect(loadGenerationSettings()).toEqual(DEFAULT_GENERATION_SETTINGS);
  });

  it('resets persisted settings to defaults', () => {
    saveGenerationSettings({ temperature: 1.5, top_p: 0.5, max_tokens: 1000 });
    expect(resetGenerationSettings()).toEqual(DEFAULT_GENERATION_SETTINGS);
    expect(loadGenerationSettings()).toEqual(DEFAULT_GENERATION_SETTINGS);
  });
});
