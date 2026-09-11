import { test, expect } from '@playwright/test';
import { setupMocks, setMockFileHandle, clearMockState } from './fixtures/mock-apis';

test('model load debug', async ({ page }) => {
  await setupMocks(page);
  
  // Capture console messages
  const logs = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[ERROR] ${err.message}`));
  
  await page.goto('/');
  await page.waitForSelector('div.screen.centered', { timeout: 15000 });
  
  // Check initial state
  console.log('=== After page load ===');
  console.log('Page URL:', page.url());
  const bodyText = await page.locator('body').innerText();
  console.log('Body text:', bodyText.substring(0, 300));
  
  // Set mock file handle and click
  await setMockFileHandle(page, 'test-model.gguf');
  const handleBefore = await page.evaluate(() => window.__getPendingFileHandle());
  console.log('Handle before click:', handleBefore?.name);
  
  await page.locator('button.btn-main').click();
  
  // Wait for any state changes
  await page.waitForTimeout(5000);
  
  console.log('=== After button click ===');
  console.log('Page URL:', page.url());
  const bodyAfter = await page.locator('body').innerText();
  console.log('Body text:', bodyAfter.substring(0, 500));
  
  // Check what screen we're on
  const hasLoading = await page.locator('h1:has-text("Загрузка")').count();
  const hasWelcome = await page.locator('h1:has-text("ИИ Чат")').count();
  const hasChat = await page.locator('div.chat-container').count();
  const hasError = await page.locator('p[style*="color: #f38ba8"]').count();
  
  console.log(`Loading: ${hasLoading}, Welcome: ${hasWelcome}, Chat: ${hasChat}, Error: ${hasError}`);
  
  // Print console logs
  console.log('=== Console logs ===');
  for (const log of logs) {
    console.log(log);
  }
  
  // Check if we're on chat screen
  if (hasChat > 0) {
    console.log('SUCCESS: On chat screen');
  } else if (hasLoading > 0) {
    console.log('SUCCESS: On loading screen');
  } else if (hasError > 0) {
    console.log('ERROR: Error screen');
  } else {
    console.log('UNKNOWN: Still on welcome screen');
  }
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/model-load-debug.png', fullPage: true });
  
  await clearMockState(page);
});
