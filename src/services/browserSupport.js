const DISMISS_STORAGE_KEY = 'privateai.browserWarning.dismissed';

const IOS_PATTERN = /iPad|iPhone|iPod/;
const IOS_BROWSERS_PATTERN = /CriOS|FxiOS|EdgiOS/;
const CHROMIUM_UA_PATTERN = /Chrome\/|Chromium\//;
const CHROMIUM_BRAND_PATTERN = /Chromium|Google Chrome/i;

function resolveNavigator(navigatorLike) {
  if (navigatorLike !== undefined) return navigatorLike;
  return typeof navigator !== 'undefined' ? navigator : undefined;
}

export function isChromiumBased(navigatorLike) {
  const nav = resolveNavigator(navigatorLike);
  if (!nav) return false;

  try {
    const brands = nav.userAgentData?.brands;
    if (Array.isArray(brands) && brands.some((entry) => entry && CHROMIUM_BRAND_PATTERN.test(entry.brand))) {
      return true;
    }
  } catch {
    // userAgentData может отсутствовать или бросать исключение — используем fallback.
  }

  const ua = typeof nav.userAgent === 'string' ? nav.userAgent : '';
  if (!ua) return false;
  if (IOS_PATTERN.test(ua)) return false;
  if (IOS_BROWSERS_PATTERN.test(ua)) return false;
  return CHROMIUM_UA_PATTERN.test(ua);
}

export function isBrowserWarningDismissed() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissBrowserWarning() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, '1');
  } catch {
    // Приватный режим или переполненное хранилище — флаг просто не сохранится.
  }
}

export function resetBrowserWarningDismissal() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(DISMISS_STORAGE_KEY);
  } catch {
    // Нечего удалять — игнорируем.
  }
}
