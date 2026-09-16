import { describe, expect, it, vi, afterEach } from 'vitest';
import { searchHuggingFaceModels } from '../src/services/huggingFaceModels';

afterEach(() => vi.restoreAllMocks());

describe('searchHuggingFaceModels', () => {
  it('returns normalized model metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: 'Qwen/Qwen3-8B', author: 'Qwen', downloads: 1234, likes: 42,
        pipeline_tag: 'text-generation', lastModified: '2026-09-01T00:00:00.000Z',
      }],
    }));

    await expect(searchHuggingFaceModels('Qwen')).resolves.toEqual([{
      id: 'Qwen/Qwen3-8B', author: 'Qwen', downloads: 1234, likes: 42,
      pipelineTag: 'text-generation', lastModified: '2026-09-01T00:00:00.000Z',
      url: 'https://huggingface.co/Qwen/Qwen3-8B',
    }]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=Qwen'), expect.any(Object));
  });

  it('does not call the API for an empty query', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(searchHuggingFaceModels('  ')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws a useful error for API failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(searchHuggingFaceModels('llama')).rejects.toMatchObject({ status: 429 });
  });
});
