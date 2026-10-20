import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isChromiumBased,
  isBrowserWarningDismissed,
  dismissBrowserWarning,
  resetBrowserWarningDismissal,
} from '../src/services/browserSupport';

const STORAGE_KEY = 'privateai.browserWarning.dismissed';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const EDGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const OPERA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/115.0.0.0';
const SAMSUNG_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/125.0.0.0 Mobile Safari/537.36';
const VIVALDI_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/7.0';
const FIREFOX_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
const FIREFOX_ANDROID_UA =
  'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0';
const SAFARI_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const CHROME_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1';
const FIREFOX_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15';
const EDGE_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/119.0.2151.56 Mobile/15E148 Safari/605.1.15';
const IOS_IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

describe('isChromiumBased', () => {
  it('detects Chromium via userAgentData brands', () => {
    const nav = {
      userAgent: FIREFOX_UA,
      userAgentData: {
        brands: [
          { brand: 'Chromium', version: '131' },
          { brand: 'Not=A?Brand', version: '24' },
        ],
      },
    };
    expect(isChromiumBased(nav)).toBe(true);
  });

  it('detects Google Chrome brand without a usable UA string', () => {
    const nav = { userAgentData: { brands: [{ brand: 'Google Chrome', version: '131' }] } };
    expect(isChromiumBased(nav)).toBe(true);
  });

  it('returns false when brands exist without Chromium and UA is not Chromium', () => {
    const nav = {
      userAgent: FIREFOX_UA,
      userAgentData: { brands: [{ brand: 'Firefox', version: '121' }] },
    };
    expect(isChromiumBased(nav)).toBe(false);
  });

  it('falls back to the UA string when brands do not match', () => {
    const nav = {
      userAgent: CHROME_UA,
      userAgentData: { brands: [{ brand: 'Unknown Brand', version: '1' }] },
    };
    expect(isChromiumBased(nav)).toBe(true);
  });

  it('survives a throwing userAgentData getter', () => {
    const nav = {
      userAgent: CHROME_UA,
      get userAgentData() {
        throw new Error('unavailable');
      },
    };
    expect(isChromiumBased(nav)).toBe(true);
  });

  it.each([
    ['Chrome desktop', CHROME_UA],
    ['Edge', EDGE_UA],
    ['Opera', OPERA_UA],
    ['Samsung Internet', SAMSUNG_UA],
    ['Vivaldi', VIVALDI_UA],
  ])('detects %s as Chromium', (_name, ua) => {
    expect(isChromiumBased({ userAgent: ua })).toBe(true);
  });

  it('does not require navigator.gpu', () => {
    expect(isChromiumBased({ userAgent: CHROME_UA, gpu: null })).toBe(true);
  });

  it.each([
    ['Firefox desktop', FIREFOX_UA],
    ['Firefox Android', FIREFOX_ANDROID_UA],
    ['Safari macOS', SAFARI_MAC_UA],
    ['Chrome iOS', CHROME_IOS_UA],
    ['Firefox iOS', FIREFOX_IOS_UA],
    ['Edge iOS', EDGE_IOS_UA],
  ])('detects %s as non-Chromium', (_name, ua) => {
    expect(isChromiumBased({ userAgent: ua })).toBe(false);
  });

  it('excludes iOS/iPadOS even when the UA contains Chrome', () => {
    expect(isChromiumBased({ userAgent: IOS_IPAD_UA })).toBe(false);
  });

  it('returns false for an empty navigator-like object', () => {
    expect(isChromiumBased({})).toBe(false);
  });

  it('returns false when UA is missing', () => {
    expect(isChromiumBased({ userAgentData: undefined, userAgent: undefined })).toBe(false);
  });

  it('returns false when navigator is absent', () => {
    expect(isChromiumBased(null)).toBe(false);
  });
});

describe('browser warning dismissal storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('starts not dismissed', () => {
    expect(isBrowserWarningDismissed()).toBe(false);
  });

  it('persists dismissal as "1"', () => {
    dismissBrowserWarning();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
    expect(isBrowserWarningDismissed()).toBe(true);
  });

  it('clears the flag on reset', () => {
    dismissBrowserWarning();
    resetBrowserWarningDismissal();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(isBrowserWarningDismissed()).toBe(false);
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem(STORAGE_KEY, '0');
    expect(isBrowserWarningDismissed()).toBe(false);
  });

  it('does not throw when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(isBrowserWarningDismissed()).toBe(false);
    expect(() => dismissBrowserWarning()).not.toThrow();
    expect(() => resetBrowserWarningDismissal()).not.toThrow();
  });

  it('does not throw when localStorage access throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });
    expect(isBrowserWarningDismissed()).toBe(false);
    expect(() => dismissBrowserWarning()).not.toThrow();
    expect(() => resetBrowserWarningDismissal()).not.toThrow();
  });
});
