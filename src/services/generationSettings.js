export const DEFAULT_GENERATION_SETTINGS = Object.freeze({
  temperature: 0.7,
  top_p: 1,
  max_tokens: 512,
});

const STORAGE_KEY = 'private-ai:generation-settings:v1';

export function validateGenerationSettings(input = {}) {
  const source = { ...DEFAULT_GENERATION_SETTINGS, ...input };
  const temperature = Number(source.temperature);
  const top_p = Number(source.top_p);
  const max_tokens = Number(source.max_tokens);

  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new RangeError('temperature must be between 0 and 2');
  }
  if (!Number.isFinite(top_p) || top_p <= 0 || top_p > 1) {
    throw new RangeError('top_p must be greater than 0 and at most 1');
  }
  if (!Number.isInteger(max_tokens) || max_tokens < 1 || max_tokens > 4096) {
    throw new RangeError('max_tokens must be an integer between 1 and 4096');
  }

  return { temperature, top_p, max_tokens };
}

export function loadGenerationSettings() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_GENERATION_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GENERATION_SETTINGS };
    return validateGenerationSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GENERATION_SETTINGS };
  }
}

export function saveGenerationSettings(settings) {
  const validated = validateGenerationSettings(settings);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  }
  return validated;
}

export function resetGenerationSettings() {
  const defaults = { ...DEFAULT_GENERATION_SETTINGS };
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  return defaults;
}
