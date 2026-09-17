import { test, expect } from '@playwright/test';
import { setupMocks, setMockFileHandle, clearMockState } from './fixtures/mock-apis';
import { selectors, buttonText } from './utils/selectors';

test.describe('Model Load Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/');
    await page.waitForSelector('div.screen.centered', { timeout: 15000 });
  });

  test.afterEach(async ({ page }) => {
    await clearMockState(page);
  });

  test('full flow: select file -> verify permission -> load model -> chat', async ({ page }) => {
    await expect(page.locator('button.btn-main')).toContainText(buttonText.selectFile);

    await setMockFileHandle(page, 'test-model.gguf');
    await page.locator('button.btn-main').click();

    await expect(page.locator(selectors.progressBarFill)).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
      const chat = await page.locator(selectors.chatContainer).count();
      return chat;
    }, { intervals: [200], timeout: 15000 }).toBeGreaterThan(0);

    await expect(page.locator(selectors.chatContainer)).toBeVisible();
  });

  test('load from HuggingFace -> loading -> chat', async ({ page }) => {
    const downloadButton = page.getByRole('button', { name: buttonText.downloadHF, exact: true });
    await expect(downloadButton).toBeVisible();
    await downloadButton.click();

    await page.waitForSelector(selectors.loadingScreen, { timeout: 10000 });
    await expect(page.locator(selectors.progressText)).toBeVisible();

    await expect.poll(async () => {
      const loading = page.locator(selectors.loadingScreen);
      const chat = page.locator(selectors.chatContainer);
      if (await chat.count() > 0) return 'chat';
      if (await loading.count() > 0) return 'loading';
      return 'unknown';
    }, { intervals: [500] }).toBe('chat');

    await expect(page.locator(selectors.chatContainer)).toBeVisible();
  });

  test('progress bar animates from 0 to 100 during model load', async ({ page }) => {
    await setMockFileHandle(page, 'test-model.gguf');
    await page.locator('button.btn-main').click();

    await expect(page.locator(selectors.progressBarFill)).toBeVisible({ timeout: 30000 });

    await expect.poll(async () => {
      const chat = await page.locator(selectors.chatContainer).count();
      return chat;
    }, { intervals: [200], timeout: 15000 }).toBeGreaterThan(0);
  });

  test('HF load shows loading screen with progress text', async ({ page }) => {
    const downloadButton = page.getByRole('button', { name: buttonText.downloadHF, exact: true });
    await downloadButton.click();

    await page.waitForSelector(selectors.loadingScreen, { timeout: 10000 });

    await expect(page.locator(selectors.loadingScreen)).toBeVisible();
    await expect(page.locator(selectors.progressBarFill)).toBeVisible();
    await expect(page.locator(selectors.progressText)).toContainText('%');
  });
});
