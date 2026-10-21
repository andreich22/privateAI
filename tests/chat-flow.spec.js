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
    await page.locator(selectors.submitButtonAny).click();
    await expect(page.getByText('1+1 = ?', { exact: true })).toBeVisible();
    await expect.poll(async () => page.getByText('1+1 = 2').count(), { intervals: [500], timeout: 20000 }).toBeGreaterThan(0);
  });

  test('send multiple messages in sequence', async ({ page }) => {
    await page.fill(selectors.chatInput, 'hello');
    await page.locator(selectors.submitButtonAny).click();
    await expect.poll(async () => page.getByText('1+1 = 2').count(), { intervals: [500], timeout: 20000 }).toBeGreaterThan(0);

    await page.evaluate(() => { window.__mockChatResponse = 'goodbye answer'; });
    await page.fill(selectors.chatInput, 'goodbye');
    await page.locator(selectors.submitButtonAny).click();
    await expect(page.getByText('goodbye', { exact: true })).toBeVisible();
    await expect.poll(async () => page.getByText('goodbye answer').count(), { intervals: [500], timeout: 20000 }).toBeGreaterThan(0);
  });

  test('unload model -> returns to access screen', async ({ page }) => {
    await page.locator(selectors.unloadButton).click();
    await page.waitForSelector('div.screen.centered', { timeout: 10000 });
    await expect(page.locator('button.btn-main')).toContainText('Запустить');
  });

  test('submit button changes to stop while generating', async ({ page }) => {
    await page.fill(selectors.chatInput, 'test');
    await page.locator(selectors.submitButtonAny).click();
    await expect(page.locator(selectors.stopButton)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Остановить' })).toBeVisible();
  });

  test('input placeholder stays stable during generation', async ({ page }) => {
    await page.locator(selectors.chatInput).fill('test');
    await page.locator(selectors.submitButtonAny).click();
    await expect(page.locator(selectors.stopButton)).toBeVisible({ timeout: 5000 });
    await expect(page.locator(selectors.chatInput)).toHaveAttribute('placeholder', 'Сообщение privateAI…');
  });

  test('cancel generation preserves partial response and allows the next request', async ({ page }) => {
    await page.evaluate(() => { window.__mockChatResponse = 'x'.repeat(100); });
    await page.fill(selectors.chatInput, 'long request');
    await page.locator(selectors.submitButtonAny).click();
    await expect(page.locator(selectors.stopButton)).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await page.locator(selectors.stopButton).click();
    await expect(page.locator(selectors.stopButton)).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(/x+/).last()).not.toHaveText('');
    await page.evaluate(() => { window.__mockChatResponse = 'ok'; });
    await page.fill(selectors.chatInput, 'next request');
    await page.locator(selectors.submitButtonAny).click();
    await expect.poll(async () => page.getByText('ok', { exact: true }).count(), { timeout: 15000 }).toBeGreaterThan(0);
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
    await page.locator(selectors.newChatButton).click();
    await expect(page.getByText('Новый чат', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/Системный промпт/)).toHaveValue('');
  });

  test('chat header shows model filename', async ({ page }) => {
    await expect(page.locator(selectors.modelName)).toContainText('test-model.gguf');
  });
});
