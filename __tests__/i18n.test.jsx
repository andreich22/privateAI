import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LanguageSelector from '../src/components/LanguageSelector';
import WelcomeScreen from '../src/components/WelcomeScreen';
import en from '../src/i18n/locales/en.json';
import ru from '../src/i18n/locales/ru.json';
import i18n, {
  changeAppLanguage,
  getInitialLanguage,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
} from '../src/i18n';

function getKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object'
      ? getKeys(child, path)
      : [path];
  }).sort();
}

describe('localization', () => {
  it('keeps Russian and English translation keys in sync', () => {
    expect(getKeys(ru)).toEqual(getKeys(en));
  });

  it('prefers a saved language, then the first supported browser language, then Russian', () => {
    expect(getInitialLanguage('en', ['ru-RU'])).toBe('en');
    expect(getInitialLanguage(null, ['fr-FR', 'en-US'])).toBe('en');
    expect(getInitialLanguage(null, ['fr-FR'])).toBe('ru');
    expect(getInitialLanguage(null, 'en-US')).toBe('en');
  });

  it('keeps language switching functional when local storage is unavailable', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('storage blocked');
    });
    expect(readStoredLanguage()).toBeNull();

    vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('storage blocked');
    });
    await expect(changeAppLanguage('en')).resolves.toBeUndefined();
    expect(i18n.language).toBe('en');
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it('rejects unsupported languages', async () => {
    await expect(changeAppLanguage('fr')).rejects.toThrow('Unsupported language: fr');
  });

  it('avoids browser storage when running without a window', async () => {
    vi.stubGlobal('window', undefined);
    try {
      expect(readStoredLanguage()).toBeNull();
      await expect(changeAppLanguage('en')).resolves.toBeUndefined();
      expect(i18n.language).toBe('en');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('switches the interface language and persists the selection locally', async () => {
    render(
      <>
        <LanguageSelector />
        <WelcomeScreen onSelect={() => {}} onHF={() => {}} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Локальный ИИ Чат' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Язык' }), { target: { value: 'en' } });

    expect(await screen.findByRole('combobox', { name: 'Language' })).toHaveValue('en');
    expect(screen.getByRole('heading', { name: 'Local AI Chat' })).toBeInTheDocument();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    await changeAppLanguage('ru');
    expect(i18n.language).toBe('ru');
  });
});
