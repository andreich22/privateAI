export const selectors = {
  // Buttons
  btnMain: 'button.btn-main',
  btnSub: 'button.btn-sub',
  btnDanger: 'button.btn-danger',

  // Screens
  welcomeScreen: 'div.screen.centered:has(h1:has-text("Локальный ИИ Чат"))',
  accessScreen: 'div.screen.centered:has(h1:has-text("Обнаружена модель"))',
  loadingScreen: 'div.screen.centered:has(h1:has-text("Загрузка модели"))',
  chatContainer: 'div.chat-container',

  // Loading
  progressBarFill: 'div.progress-bar-fill',
  progressText: 'div.progress-text',

  // Chat
  messagesBox: 'div.messages-box',
  userMessage: 'div.message.user',
  assistantMessage: 'div.message.assistant',
  inputForm: 'form.input-form',
  chatInput: 'form.input-form input',
  submitButton: 'form.input-form button[type="submit"]',
  debugInfo: 'div[style*="monospace"]',

  // Error
  errorText: 'p[style*="color"]',

  // Environment banner
  envBanner: 'div[style*="z-index: 9999"]',
};

export const buttonText = {
  selectFile: 'Выбрать GGUF файл',
  downloadHF: 'Скачать Qwen3.8-2B (HF)',
  launch: 'Запустить',
  hf: 'HF',
  anotherFile: 'Другой файл',
  send: 'Отправить',
  unload: 'Выгрузить',
};
