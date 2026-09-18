import { describe, expect, it } from 'vitest';
import { mergeTokenUsage, normalizeTokenUsage } from '../src/services/tokenUsage';

describe('token usage normalization', () => {
  it('normalizes cached, input, output and total token counts', () => {
    expect(normalizeTokenUsage({
      prompt_tokens: 120,
      completion_tokens: 30,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 80 },
    })).toEqual({ cached: 80, input: 200, output: 30, total: 230 });
  });

  it('reads cache, prompt and predicted counts from llama.cpp timings', () => {
    expect(normalizeTokenUsage({}, null, { cache_n: 80, prompt_n: 120, predicted_n: 30 }))
      .toEqual({ cached: 80, input: 200, output: 30, total: 230 });
  });

  it('uses runtime cache size when the response has no cached_tokens field', () => {
    expect(normalizeTokenUsage({ prompt_tokens: 12, completion_tokens: 5 }, 40))
      .toEqual({ cached: 40, input: 52, output: 5, total: 57 });
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
      { cached: 40, input: 52, output: 5, total: 57 },
      { cached: null, input: null, output: null, total: null },
    )).toEqual({ cached: 40, input: 52, output: 5, total: 57 });
  });
});
  it('truncates fractional counts and ignores negative or non-finite values', () => {
    expect(normalizeTokenUsage({
      prompt_tokens: 12.9,
      completion_tokens: -1,
      prompt_tokens_details: { cached_tokens: Number.NaN },
    }, 5.8)).toEqual({
      cached: 5,
      input: 17,
      output: null,
      total: null,
    });
  });

  it('prefers explicit cached token details over timings and fallback values', () => {
    expect(normalizeTokenUsage(
      { prompt_tokens: 10, completion_tokens: 2, prompt_tokens_details: { cached_tokens: 4 } },
      8,
      { cache_n: 6, prompt_n: 10, predicted_n: 2 },
    )).toEqual({ cached: 4, input: 14, output: 2, total: 16 });
  });

  it('falls back to a supplied total when input or output cannot be derived', () => {
    expect(normalizeTokenUsage({ total_tokens: 19, prompt_tokens: 10 })).toEqual({
      cached: null,
      input: 10,
      output: null,
      total: 19,
    });
  });

  it('fills a missing total from merged input and output values', () => {
    expect(mergeTokenUsage(
      { cached: null, input: 10, output: null, total: null },
      { cached: 2, input: 12, output: 3, total: null },
    )).toEqual({ cached: 2, input: 12, output: 3, total: 15 });
  });

  it('keeps current values when the next chunk is empty', () => {
    expect(mergeTokenUsage(
      { cached: 1, input: 2, output: 3, total: 5 },
      {},
    )).toEqual({ cached: 1, input: 2, output: 3, total: 5 });
  });

