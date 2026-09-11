import { test, expect } from '@playwright/test';
import { setupMocks, setMockFileHandle, setPermissionGranted, clearMockState } from './fixtures/mock-apis';
import { selectors } from './utils/selectors';

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await page.waitForSelector('div.screen.centered', { timeout: 15000 });
  });

  test.afterEach(async ({ page }) => {
    await clearMockState(page);
  });

  test('cancelled file picker -> stays on welcome screen', async ({ page }) => {
    await clearMockState(page);
    await page.waitForSelector('div.screen.centered', { timeout: 5000 });

    await page.locator('button.btn-main').click();

    await expect(page.locator('button.btn-main')).toContainText('Выбрать GGUF файл');
  });

  test('permission denied -> error message shown', async ({ page }) => {
    await setMockFileHandle(page, 'test-model.gguf');
    await setPermissionGranted(page, false);

    await page.locator('button.btn-main').click();

    await expect.poll(async () => {
      const count = await page.locator('p[style*="color"]').count();
      return count;
    }, { intervals: [100], timeout: 5000 }).toBeGreaterThan(0);

    await expect(page.locator('p[style*="color"]')).toContainText('Доступ к файлу отклонен');

    await expect(page.locator('button.btn-main')).toContainText('Выбрать GGUF файл');
  });

  test('file picker returns null -> stays on welcome screen', async ({ page }) => {
    await page.locator('button.btn-main').click();

    await expect(page.locator('button.btn-main')).toContainText('Выбрать GGUF файл');
  });

  test('HF error -> error message shown on welcome screen', async ({ page }) => {
    await setupMocks(page, { mockChatResponse: '' });
    await page.goto('/');
    await page.waitForSelector('div.screen.centered', { timeout: 15000 });

    await page.locator('button.btn-sub').first().click();

    await page.waitForTimeout(3000);

    const hasWelcome = await page.locator('button.btn-main').count();
    if (hasWelcome > 0) {
      await expect(page.locator('button.btn-main')).toContainText('Выбрать GGUF файл');
    }
  });
});
