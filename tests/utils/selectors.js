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

  // Chat (Gravity UI AIKit)
  chatInput: 'textarea[placeholder="Сообщение privateAI…"]',
  submitButton: '[data-qa="private-ai-submit-button"][data-state="enabled"]',
  submitButtonAny: '[data-qa="private-ai-submit-button"]',
  stopButton: '[data-qa="private-ai-submit-button"][data-state="cancelable"]',
  newChatButton: '[data-qa="private-ai-header-action-newChat"]',
  historyButton: '[data-qa="private-ai-header-action-history"]',
  menuButton: '[data-qa="private-ai-header-menu-button"]',
  messageList: '[data-qa="private-ai-message-list"]',
  unloadButton: 'button.danger-button',
  modelName: '.model-name',

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
