import { test, expect } from '@playwright/test';
import { setupMocks, setMockFileHandle, clearMockState } from './fixtures/mock-apis';
import { selectors } from './utils/selectors';

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page, { mockChatResponse: '1+1 = 2' });
    await page.goto('/');
    await page.waitForSelector('div.screen.centered', { timeout: 15000 });

    await setMockFileHandle(page, 'test-model.gguf');
    await page.locator('button.btn-main').click();

    await page.waitForLoadState('networkidle');
    await page.waitForSelector(selectors.chatContainer, { timeout: 30000 });
    await expect(page.locator(selectors.chatContainer)).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await clearMockState(page);
  });

  test('send message -> user message appears -> AI response appears', async ({ page }) => {
    await page.fill(selectors.chatInput, '1+1 = ?');
    await page.locator(selectors.submitButton).click();

    await expect(page.locator(selectors.userMessage)).toBeVisible();
    await expect(page.locator(selectors.userMessage)).toContainText('1+1 = ?');

    await expect.poll(async () => {
      const assistantMsgs = page.locator(selectors.assistantMessage);
      return await assistantMsgs.count();
    }, { intervals: [500], timeout: 15000 }).toBeGreaterThan(0);

    const assistantMsg = page.locator(selectors.assistantMessage).last();
    await expect(assistantMsg).toBeVisible();
    await expect(assistantMsg.locator('div.text')).toContainText('1+1 = 2');
  });

  test('send multiple messages in sequence', async ({ page }) => {
    await page.fill(selectors.chatInput, 'hello');
    await page.locator(selectors.submitButton).click();

    await expect(page.locator(selectors.userMessage).last()).toContainText('hello');

    await expect.poll(async () => {
      return await page.locator(selectors.assistantMessage).count();
    }, { intervals: [500], timeout: 15000 }).toBeGreaterThan(0);

    await page.fill(selectors.chatInput, 'goodbye');
    await page.locator(selectors.submitButton).click();

    await expect(page.locator(selectors.userMessage).last()).toContainText('goodbye');
    await expect(page.locator(selectors.messagesBox).locator(selectors.assistantMessage)).toHaveCount(2);
  });

  test('unload model -> returns to access screen', async ({ page }) => {
    await page.locator('button.btn-danger').click();

    await page.waitForSelector('div.screen.centered', { timeout: 10000 });
    await expect(page.locator('button.btn-main')).toContainText('Запустить');
  });

  test('submit button disabled while generating', async ({ page }) => {
    await page.fill(selectors.chatInput, 'test');

    await page.locator(selectors.submitButton).click();

    await expect(page.locator(selectors.submitButton)).toBeDisabled();
  });

  test('input placeholder shows generation state', async ({ page }) => {
    await page.locator(selectors.chatInput).fill('test');
    await page.locator(selectors.submitButton).click();

    await expect(page.locator(selectors.chatInput)).toHaveAttribute('placeholder', 'Генерация...');
    await expect(page.locator(selectors.chatInput)).toBeDisabled();
  });

  test('chat header shows model filename', async ({ page }) => {
    await expect(page.locator('header').locator('strong')).toContainText('test-model.gguf');
  });
});
