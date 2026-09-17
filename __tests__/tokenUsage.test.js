import { describe, expect, it } from 'vitest';
import { mergeTokenUsage, normalizeTokenUsage } from '../src/services/tokenUsage';

describe('token usage normalization', () => {
  it('normalizes cached, input, output and total token counts', () => {
    expect(normalizeTokenUsage({
      prompt_tokens: 120,
      completion_tokens: 30,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 80 },
    })).toEqual({ cached: 80, input: 120, output: 30, total: 230 });
  });

  it('uses runtime cache size when the response has no cached_tokens field', () => {
    expect(normalizeTokenUsage({ prompt_tokens: 12, completion_tokens: 5 }, 40))
      .toEqual({ cached: 40, input: 12, output: 5, total: 57 });
  });

  it('does not invent missing token values', () => {
    expect(normalizeTokenUsage({ total_tokens: 17 })).toEqual({
      cached: null,
      input: null,
      output: null,
      total: 17,
    });
  });

  it('preserves known values when a later streaming chunk omits them', () => {
    expect(mergeTokenUsage(
      { cached: 40, input: 12, output: 5, total: 57 },
      { cached: null, input: 20, output: null, total: null },
    )).toEqual({ cached: 40, input: 20, output: 5, total: 57 });
  });
});
