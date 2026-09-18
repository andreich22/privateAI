import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_EXECUTION_SETTINGS,
  getMaxGpuLayers,
  loadExecutionSettings,
  resetExecutionSettings,
  resolveGpuLayerCount,
  saveExecutionSettings,
  validateExecutionSettings,
} from '../src/services/executionSettings.js';

describe('execution settings', () => {
  beforeEach(() => localStorage.clear());

  it('exposes the CPU/GPU default', () => {
    expect(DEFAULT_EXECUTION_SETTINGS).toEqual({ n_gpu_layers: -1 });
  });

  it.each([
    [24, 24],
    ['24', 24],
    [0, 0],
  ])('normalizes valid layer counts', (input, expected) => {
    expect(getMaxGpuLayers(input)).toBe(expected);
  });

  it.each([undefined, -1, 1.5, 'abc'])('returns null for invalid layer counts: %p', (input) => {
    expect(getMaxGpuLayers(input)).toBeNull();
  });

  it('accepts auto mode and explicit values within the model layer count', () => {
    expect(validateExecutionSettings()).toEqual({ n_gpu_layers: -1 });
    expect(validateExecutionSettings({ n_gpu_layers: 12 }, 24)).toEqual({ n_gpu_layers: 12 });
    expect(validateExecutionSettings({ n_gpu_layers: '12' }, 24)).toEqual({ n_gpu_layers: 12 });
    expect(validateExecutionSettings({ n_gpu_layers: 24 }, 24)).toEqual({ n_gpu_layers: 24 });
  });

  it.each([
    [{ n_gpu_layers: 1.5 }, null, 'integer'],
    [{ n_gpu_layers: -2 }, null, '-1 or greater'],
    [{ n_gpu_layers: 25 }, 24, 'between -1 and 24'],
  ])('rejects invalid GPU layer settings', (settings, layerCount, message) => {
    expect(() => validateExecutionSettings(settings, layerCount)).toThrow(message);
  });

  it('persists validated settings and falls back to defaults for invalid JSON', () => {
    const saved = saveExecutionSettings({ n_gpu_layers: '8' }, 24);
    expect(saved).toEqual({ n_gpu_layers: 8 });
    expect(loadExecutionSettings(24)).toEqual(saved);

    localStorage.setItem('private-ai:execution-settings:v1', '{invalid');
    expect(loadExecutionSettings(24)).toEqual(DEFAULT_EXECUTION_SETTINGS);
  });

  it('resets persisted settings', () => {
    saveExecutionSettings({ n_gpu_layers: 8 }, 24);
    expect(resetExecutionSettings()).toEqual(DEFAULT_EXECUTION_SETTINGS);
    expect(loadExecutionSettings(24)).toEqual(DEFAULT_EXECUTION_SETTINGS);
  });

  it('resolves auto mode to the model layer count', () => {
    expect(resolveGpuLayerCount({ n_gpu_layers: -1 }, 24)).toBe(24);
  });

  it('uses the runtime fallback when auto mode has no known layer count', () => {
    expect(resolveGpuLayerCount({ n_gpu_layers: -1 }, null)).toBe(0);
  });

  it('resolves explicit GPU layers without exceeding the model limit', () => {
    expect(resolveGpuLayerCount({ n_gpu_layers: 7 }, 24)).toBe(7);
  });
});
