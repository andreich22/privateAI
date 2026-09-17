export const EMPTY_TOKEN_USAGE = Object.freeze({
  cached: null,
  input: null,
  output: null,
  total: null,
});

function finiteTokenCount(value) {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

export function normalizeTokenUsage(usage, fallbackCached = null, timings = null) {
  const promptDetails = usage?.prompt_tokens_details;
  const cached = finiteTokenCount(promptDetails?.cached_tokens)
    ?? finiteTokenCount(timings?.cache_n)
    ?? finiteTokenCount(fallbackCached);
  const promptTokens = finiteTokenCount(usage?.prompt_tokens) ?? finiteTokenCount(timings?.prompt_n);
  const output = finiteTokenCount(usage?.completion_tokens) ?? finiteTokenCount(timings?.predicted_n);
  const input = promptTokens !== null && cached !== null ? promptTokens + cached : promptTokens;
  const total = input !== null && output !== null
    ? input + output
    : finiteTokenCount(usage?.total_tokens);

  return { cached, input, output, total };
}

export function mergeTokenUsage(current, next) {
  const merged = {
    cached: next?.cached ?? current?.cached ?? null,
    input: next?.input ?? current?.input ?? null,
    output: next?.output ?? current?.output ?? null,
    total: next?.total ?? current?.total ?? null,
  };

  if (merged.input !== null && merged.output !== null && (next?.total === null || next?.total === undefined)) {
    merged.total = merged.input + merged.output;
  }
  return merged;
}
