const HF_MODELS_API = 'https://huggingface.co/api/models';

function normalizeModel(model) {
  return {
    id: model.id,
    author: model.author || model.id?.split('/')?.[0] || '',
    downloads: Number(model.downloads || 0),
    likes: Number(model.likes || 0),
    pipelineTag: model.pipeline_tag || null,
    lastModified: model.lastModified || null,
    url: `https://huggingface.co/${model.id}`,
  };
}

export async function searchHuggingFaceModels(query, options = {}) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) return [];

  const params = new URLSearchParams({
    search: trimmedQuery,
    limit: String(Math.min(Math.max(Number(options.limit) || 20, 1), 100)),
    sort: options.sort || 'downloads',
    direction: String(options.direction ?? -1),
  });
  if (options.pipelineTag) params.set('pipeline_tag', options.pipelineTag);

  const response = await fetch(`${HF_MODELS_API}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const error = new Error(`Hugging Face API request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  const models = await response.json();
  if (!Array.isArray(models)) throw new Error('Invalid Hugging Face API response');
  return models.map(normalizeModel).filter((model) => model.id);
}

export { HF_MODELS_API, normalizeModel };
