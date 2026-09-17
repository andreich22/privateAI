export const EMPTY_TOKEN_USAGE = Object.freeze({
  cached: null,
  input: null,
  output: null,
  total: null,
});

function finiteTokenCount(value) {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : null;
}

export function normalizeTokenUsage(usage, fallbackCached = null) {
  const promptDetails = usage?.prompt_tokens_details;
  const cached = finiteTokenCount(promptDetails?.cached_tokens) ?? finiteTokenCount(fallbackCached);
  const input = finiteTokenCount(usage?.prompt_tokens);
  const output = finiteTokenCount(usage?.completion_tokens);
  const total = input !== null && output !== null && cached !== null
    ? input + output + cached
    : finiteTokenCount(usage?.total_tokens);

  return { cached, input, output, total };
}

export function mergeTokenUsage(current, next) {
  return {
    cached: next?.cached ?? current?.cached ?? null,
    input: next?.input ?? current?.input ?? null,
    output: next?.output ?? current?.output ?? null,
    total: next?.total ?? current?.total ?? null,
  };
}
