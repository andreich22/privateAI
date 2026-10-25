import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchHuggingFaceModels } from '../services/huggingFaceModels';
import UserError from './UserError';

function formatNumber(value, language) {
  return new Intl.NumberFormat(language).format(value);
}

export default function HuggingFaceModelSearch({ onSelect, initiallyOpen = false }) {
  const { t, i18n } = useTranslation();
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
      setError(err?.status === 429
        ? { key: 'modelSearch.rateLimited' }
        : { key: 'modelSearch.searchFailed', details: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="hf-search-container" aria-label={t('modelSearch.sectionLabel')}>
      {!isOpen && (
        <button type="button" onClick={openSearch} className="btn-sub hf-picker-button">
          {t('modelSearch.searchButton')}
        </button>
      )}

      {isOpen && (
        <div className="hf-search">
          <div className="hf-search-header">
            <h2>{t('modelSearch.title')}</h2>
            <button type="button" className="btn-sub hf-close-button" onClick={() => setIsOpen(false)}>
              {t('common.close')}
            </button>
          </div>
          <form onSubmit={handleSearch} className="hf-search-form">
            <input
              ref={inputRef}
              aria-label={t('modelSearch.searchLabel')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('modelSearch.placeholder')}
            />
            <input type="submit" className="btn-sub" disabled={loading} value={loading ? t('modelSearch.searching') : t('modelSearch.search')} />
          </form>

          <UserError error={error} className="hf-search-error" />
          {loading && <p aria-live="polite">{t('modelSearch.loadingResults')}</p>}
          {!loading && searched && !error && models.length === 0 && <p>{t('modelSearch.notFound')}</p>}

          {!loading && models.length > 0 && (
            <div className="hf-model-results">
              {models.map((model) => (
                <article key={model.id} className="hf-model-card">
                  <div>
                    <strong>{model.id}</strong>
                    <div>{t('modelSearch.author', { author: model.author || '—' })}</div>
                    <div>{t('modelSearch.downloads', { count: formatNumber(model.downloads, i18n.language) })} · {t('modelSearch.likes', { count: formatNumber(model.likes, i18n.language) })}</div>
                    {model.pipelineTag && <div>{t('modelSearch.task', { task: model.pipelineTag })}</div>}
                    {model.lastModified && <div>{t('modelSearch.updated', { date: new Date(model.lastModified).toLocaleDateString(i18n.language) })}</div>}
                  </div>
                  <div className="hf-model-actions">
                    <a href={model.url} target="_blank" rel="noreferrer">{t('modelSearch.open')}</a>
                    {onSelect && <button type="button" onClick={() => onSelect(model)}>{t('modelSearch.select')}</button>}
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
