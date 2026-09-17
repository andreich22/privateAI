import React, { useEffect, useRef, useState } from 'react';
import { searchHuggingFaceModels } from '../services/huggingFaceModels';

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

export default function HuggingFaceModelSearch({ onSelect, initiallyOpen = false }) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [query, setQuery] = useState('');
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const openSearch = () => setIsOpen(true);

  const handleSearch = async (event) => {
    event.preventDefault();
    setError('');
    setSearched(true);
    if (!query.trim()) {
      setModels([]);
      return;
    }
    setLoading(true);
    try {
      setModels(await searchHuggingFaceModels(query));
    } catch (err) {
      setModels([]);
      setError(err?.status === 429 ? 'Hugging Face временно ограничил запросы. Попробуйте позже.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="hf-search-container" aria-label="Выбор модели из Hugging Face">
      {!isOpen && (
        <button type="button" onClick={openSearch} className="btn-sub hf-picker-button">
          Выбрать модель из HF
        </button>
      )}

      {isOpen && (
        <div className="hf-search">
          <div className="hf-search-header">
            <h2>Выбрать модель из HF</h2>
            <button type="button" className="btn-sub hf-close-button" onClick={() => setIsOpen(false)}>
              Закрыть
            </button>
          </div>
          <form onSubmit={handleSearch} className="hf-search-form">
            <input
              ref={inputRef}
              aria-label="Поиск моделей Hugging Face"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например, Qwen, Llama, Mistral"
            />
            <input type="submit" className="btn-sub" disabled={loading} value={loading ? 'Поиск…' : 'Найти'} />
          </form>

          {error && <p role="alert" className="hf-search-error">{error}</p>}
          {loading && <p aria-live="polite">Загрузка результатов…</p>}
          {!loading && searched && !error && models.length === 0 && <p>Модели не найдены.</p>}

          {!loading && models.length > 0 && (
            <div className="hf-model-results">
              {models.map((model) => (
                <article key={model.id} className="hf-model-card">
                  <div>
                    <strong>{model.id}</strong>
                    <div>Автор: {model.author || '—'}</div>
                    <div>Загрузки: {formatNumber(model.downloads)} · Лайки: {formatNumber(model.likes)}</div>
                    {model.pipelineTag && <div>Task: {model.pipelineTag}</div>}
                    {model.lastModified && <div>Обновлено: {new Date(model.lastModified).toLocaleDateString()}</div>}
                  </div>
                  <div className="hf-model-actions">
                    <a href={model.url} target="_blank" rel="noreferrer">Открыть</a>
                    {onSelect && <button type="button" onClick={() => onSelect(model)}>Выбрать</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
