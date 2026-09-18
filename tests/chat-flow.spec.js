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
    await expect(page.locator(selectors.chatInput), 'input should be enabled').toBeEnabled({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => { await clearMockState(page); });

  test('send message -> user message appears -> AI response appears', async ({ page }) => {
    await page.fill(selectors.chatInput, '1+1 = ?');
    await page.locator(selectors.submitButton).click();
    await expect(page.locator(selectors.userMessage)).toContainText('1+1 = ?');
    await expect.poll(async () => page.locator(selectors.assistantMessage).count(), { intervals: [500], timeout: 15000 }).toBeGreaterThan(0);
    await expect(page.locator(selectors.assistantMessage).last().locator('div.text')).toContainText('1+1 = 2');
  });

  test('send multiple messages in sequence', async ({ page }) => {
    await page.fill(selectors.chatInput, 'hello');
    await page.locator(selectors.submitButton).click();
    await expect.poll(async () => page.locator(selectors.assistantMessage).count(), { intervals: [500], timeout: 15000 }).toBeGreaterThan(0);
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

  test('submit button changes to stop while generating', async ({ page }) => {
    await page.fill(selectors.chatInput, 'test');
    await page.locator(selectors.submitButton).click();
    await expect(page.getByRole('button', { name: 'Остановить генерацию' })).toBeVisible();
  });

  test('input placeholder shows generation state', async ({ page }) => {
    await page.locator(selectors.chatInput).fill('test');
    await page.locator(selectors.submitButton).click();
    await expect(page.locator(selectors.chatInput)).toHaveAttribute('placeholder', 'Модель генерирует ответ…');
    await expect(page.locator(selectors.chatInput)).toBeDisabled();
  });

  test('cancel generation preserves partial response and allows the next request', async ({ page }) => {
    await page.evaluate(() => { window.__mockChatResponse = 'x'.repeat(100); });
    await page.fill(selectors.chatInput, 'long request');
    await page.locator(selectors.submitButton).click();
    await expect(page.getByRole('button', { name: 'Остановить генерацию' })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: 'Остановить генерацию' }).click();
    await expect(page.getByRole('button', { name: 'Отправить' })).toBeVisible();
    await expect(page.locator(selectors.assistantMessage).last().locator('div.text')).not.toHaveText('');
    await page.evaluate(() => { window.__mockChatResponse = 'ok'; });
    await page.fill(selectors.chatInput, 'next request');
    await page.locator(selectors.submitButton).click();
    await expect.poll(async () => page.locator(selectors.assistantMessage).count(), { timeout: 10000 }).toBeGreaterThan(1);
  });

  test('generation settings persist locally', async ({ page }) => {
    const maxTokens = page.getByLabel(/Максимум токенов/);
    await maxTokens.fill('777');
    await maxTokens.blur();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('private-ai:generation-settings:v1')).max_tokens)).toBe(777);
  });

  test('new chat gets an isolated system prompt', async ({ page }) => {
    const prompt = page.getByLabel(/Системный промпт/);
    await prompt.fill('Отвечай кратко.');
    await prompt.blur();
    await page.getByRole('button', { name: 'Новый чат' }).click();
    await expect(page.locator('main').getByText('Новый чат', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Системный промпт (только этот чат)')).toHaveValue('');
  });

  test('chat header shows model filename', async ({ page }) => {
    await expect(page.locator('.model-name')).toContainText('test-model.gguf');
  });
});
