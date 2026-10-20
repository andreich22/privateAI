import { test, expect } from '@playwright/test';

const FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
const STORAGE_KEY = 'privateai.browserWarning.dismissed';
const DIALOG_TITLE = 'Приложение работает только в Chromium-браузерах';

async function emulateNonChromium(page) {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: () => undefined,
        configurable: true,
      });
    } catch {
      // userAgentData может быть недоступен — это нормально.
    }
  });
}

function getStoredFlag(page) {
  return page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
}

test.describe('Non-Chromium browser', () => {
  test.use({ userAgent: FIREFOX_UA });

  test.beforeEach(async ({ page }) => {
    await emulateNonChromium(page);
  });

  test('shows warning modal on load and persists dismissal with the checkbox', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByText(DIALOG_TITLE)).toBeVisible();

    await dialog.getByLabel('Не показывать снова').check();
    await dialog.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await getStoredFlag(page)).toBe('1');

    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('shows the modal again after reload when the checkbox was unchecked', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await getStoredFlag(page)).toBeNull();

    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

  test('Escape closes the modal without storing the flag', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await getStoredFlag(page)).toBeNull();
  });
});

test.describe('Chromium browser', () => {
  test('does not show the warning modal', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('div.screen.centered')).toBeVisible({ timeout: 15000 });
  });
});
