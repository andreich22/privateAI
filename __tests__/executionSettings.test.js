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

describe('executionSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to all layers on GPU', () => {
    expect(DEFAULT_EXECUTION_SETTINGS).toEqual({ n_gpu_layers: -1 });
    expect(loadExecutionSettings(24)).toEqual({ n_gpu_layers: -1 });
    expect(resolveGpuLayerCount({ n_gpu_layers: -1 }, 24)).toBe(24);
  });

  it('accepts a mixed CPU/GPU configuration within the model layer count', () => {
    expect(validateExecutionSettings({ n_gpu_layers: 8 }, 24)).toEqual({ n_gpu_layers: 8 });
    expect(resolveGpuLayerCount({ n_gpu_layers: 8 }, 24)).toBe(8);
  });

  it('accepts CPU-only configuration', () => {
    expect(validateExecutionSettings({ n_gpu_layers: 0 }, 24)).toEqual({ n_gpu_layers: 0 });
    expect(resolveGpuLayerCount({ n_gpu_layers: 0 }, 24)).toBe(0);
  });

  it('rejects values outside the model layer count', () => {
    expect(() => validateExecutionSettings({ n_gpu_layers: 25 }, 24)).toThrow('between -1 and 24');
    expect(() => validateExecutionSettings({ n_gpu_layers: -2 }, 24)).toThrow('n_gpu_layers');
    expect(() => validateExecutionSettings({ n_gpu_layers: 1.5 }, 24)).toThrow('integer');
  });

  it('persists validated settings', () => {
    saveExecutionSettings({ n_gpu_layers: 6 }, 24);
    expect(loadExecutionSettings(24)).toEqual({ n_gpu_layers: 6 });
  });

  it('resets persisted settings', () => {
    saveExecutionSettings({ n_gpu_layers: 6 }, 24);
    expect(resetExecutionSettings()).toEqual(DEFAULT_EXECUTION_SETTINGS);
    expect(loadExecutionSettings(24)).toEqual(DEFAULT_EXECUTION_SETTINGS);
  });

  it('normalizes a valid layer count', () => {
    expect(getMaxGpuLayers(24)).toBe(24);
    expect(getMaxGpuLayers(0)).toBe(0);
    expect(getMaxGpuLayers('24')).toBe(24);
    expect(getMaxGpuLayers(-1)).toBeNull();
    expect(getMaxGpuLayers('invalid')).toBeNull();
  });
});
