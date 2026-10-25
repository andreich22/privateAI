import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const LANGUAGE_STORAGE_KEY = 'privateai.language';
export const SUPPORTED_LANGUAGES = ['ru', 'en'];
const DEFAULT_LANGUAGE = 'ru';

function normalizeLanguage(language) {
  const languageCode = language?.toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(languageCode) ? languageCode : null;
}

export function getInitialLanguage(storedLanguage, browserLanguages) {
  const supportedBrowserLanguage = (Array.isArray(browserLanguages) ? browserLanguages : [browserLanguages])
    .map(normalizeLanguage)
    .find(Boolean);
  return normalizeLanguage(storedLanguage) || supportedBrowserLanguage || DEFAULT_LANGUAGE;
}

export function readStoredLanguage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch (error) {
    console.warn('Could not read the saved interface language:', error);
    return null;
  }
}

function getBrowserLanguages() {
  if (typeof navigator === 'undefined') return null;
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

export const initialLanguage = getInitialLanguage(readStoredLanguage(), getBrowserLanguages());

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  initImmediate: false,
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage;
  i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language;
  });
}

export async function changeAppLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);
  if (!normalizedLanguage) throw new Error(`Unsupported language: ${language}`);

  await i18n.changeLanguage(normalizedLanguage);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
  } catch (error) {
    console.warn('Could not save the interface language preference:', error);
  }
}

export default i18n;
