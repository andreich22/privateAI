export const DEFAULT_EXECUTION_SETTINGS = Object.freeze({
  n_gpu_layers: -1,
});

const STORAGE_KEY = 'private-ai:execution-settings:v1';

export function getMaxGpuLayers(layerCount) {
  const count = Number(layerCount);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

export function validateExecutionSettings(input = {}, layerCount = null) {
  const source = { ...DEFAULT_EXECUTION_SETTINGS, ...input };
  const rawGpuLayers = Number(source.n_gpu_layers);
  const maxLayers = getMaxGpuLayers(layerCount);

  if (!Number.isInteger(rawGpuLayers)) {
    throw new RangeError('n_gpu_layers must be an integer');
  }
  if (rawGpuLayers < -1) {
    throw new RangeError('n_gpu_layers must be -1 or greater');
  }
  if (maxLayers !== null && rawGpuLayers > maxLayers) {
    throw new RangeError(`n_gpu_layers must be between -1 and ${maxLayers}`);
  }

  return { n_gpu_layers: rawGpuLayers };
}

export function loadExecutionSettings(layerCount = null) {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_EXECUTION_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EXECUTION_SETTINGS };
    return validateExecutionSettings(JSON.parse(raw), layerCount);
  } catch {
    return { ...DEFAULT_EXECUTION_SETTINGS };
  }
}

export function saveExecutionSettings(settings, layerCount = null) {
  const validated = validateExecutionSettings(settings, layerCount);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  }
  return validated;
}

export function resetExecutionSettings() {
  const defaults = { ...DEFAULT_EXECUTION_SETTINGS };
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  return defaults;
}

export function resolveGpuLayerCount(settings, layerCount) {
  const maxLayers = getMaxGpuLayers(layerCount);
  const requested = validateExecutionSettings(settings, maxLayers).n_gpu_layers;
  return requested === -1 ? (maxLayers ?? 99999) : requested;
}
