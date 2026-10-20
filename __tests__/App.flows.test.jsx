import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';

const { fileStorageMock, runtimeMock } = vi.hoisted(() => {
  const fileStorageMock = {
    getSavedFileHandle: vi.fn(),
    verifyPermission: vi.fn(),
    selectAndSaveFile: vi.fn(),
    saveFilePicker: vi.fn(),
    saveFileHandle: vi.fn(),
  };
  const runtimeMock = {
    loadModelFromFile: vi.fn(),
    loadModelFromHF: vi.fn(),
    unloadModel: vi.fn(),
    cancelLoad: vi.fn(),
    isGenerationPending: vi.fn(),
    isLoadPending: vi.fn(),
    isLoaded: vi.fn(),
    getContextInfo: vi.fn(),
    getGenerationCapabilities: vi.fn(),
    getExecutionCapabilities: vi.fn(),
    getBackendInfo: vi.fn(),
    streamChat: vi.fn(),
    cancelGeneration: vi.fn(),
    subscribe: vi.fn(),
  };
  return { fileStorageMock, runtimeMock };
});

vi.mock('../src/services/fileStorage', () => fileStorageMock);
vi.mock('../src/services/AIRuntime', () => ({
  AIRuntime: vi.fn(function createRuntime() {
    return runtimeMock;
  }),
}));

const FLAG_KEY = 'privateai.browserWarning.dismissed';
const SAVED_HANDLE = { name: 'model.gguf' };

function resetMocks() {
  fileStorageMock.getSavedFileHandle.mockReset().mockResolvedValue(null);
  fileStorageMock.verifyPermission.mockReset().mockResolvedValue(true);
  fileStorageMock.selectAndSaveFile.mockReset().mockResolvedValue(SAVED_HANDLE);
  fileStorageMock.saveFilePicker.mockReset().mockResolvedValue(SAVED_HANDLE);
  fileStorageMock.saveFileHandle.mockReset().mockResolvedValue(SAVED_HANDLE);

  runtimeMock.loadModelFromFile.mockReset().mockResolvedValue(undefined);
  runtimeMock.loadModelFromHF.mockReset().mockResolvedValue(undefined);
  runtimeMock.unloadModel.mockReset().mockResolvedValue(undefined);
  runtimeMock.cancelLoad.mockReset();
  runtimeMock.isGenerationPending.mockReset().mockReturnValue(false);
  runtimeMock.isLoadPending.mockReset().mockReturnValue(false);
  runtimeMock.isLoaded.mockReset().mockReturnValue(true);
  runtimeMock.getContextInfo.mockReset().mockReturnValue({ n_layer: 32 });
  runtimeMock.getGenerationCapabilities.mockReset().mockReturnValue({ temperature: true, max_tokens: true });
  runtimeMock.getExecutionCapabilities.mockReset().mockReturnValue({ gpuLayerOffload: true });
  runtimeMock.getBackendInfo.mockReset().mockReturnValue({ webgpuSupported: false, mode: 'auto' });
  runtimeMock.streamChat.mockReset();
  runtimeMock.cancelGeneration.mockReset();
  runtimeMock.subscribe.mockReset().mockReturnValue(() => {});
}

async function renderWelcome() {
  const view = render(<App />);
  await waitFor(() => expect(screen.getByText('Локальный ИИ Чат')).toBeInTheDocument());
  return view;
}

async function renderAccess(handle = SAVED_HANDLE) {
  fileStorageMock.getSavedFileHandle.mockResolvedValue(handle);
  const view = render(<App />);
  await waitFor(() => expect(screen.getByText('Обнаружена модель')).toBeInTheDocument());
  return view;
}

async function openChatFromAccess() {
  await renderAccess();
  fireEvent.click(screen.getByRole('button', { name: 'Запустить' }));
  await waitFor(() => expect(document.querySelector('.chat-container')).toBeInTheDocument());
}

describe('App model loading flows', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(FLAG_KEY, '1');
    resetMocks();
  });

  afterEach(() => {
    delete window.navigator.userAgent;
  });

  it('restores a saved file handle and opens the access screen', async () => {
    await renderAccess();
    expect(screen.getByText('model.gguf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Запустить' })).toBeInTheDocument();
  });

  it('falls back to the welcome screen when restoring the handle fails', async () => {
    fileStorageMock.getSavedFileHandle.mockRejectedValue(new Error('storage broken'));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Локальный ИИ Чат')).toBeInTheDocument());
    expect(fileStorageMock.getSavedFileHandle).toHaveBeenCalled();
  });

  it('selects a file, shows loading and moves to chat', async () => {
    let resolveLoad;
    runtimeMock.loadModelFromFile.mockImplementation(() => new Promise((resolve) => { resolveLoad = resolve; }));

    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать GGUF файл' }));

    await waitFor(() => expect(screen.getByText('Загрузка модели в оперативную память')).toBeInTheDocument());
    expect(fileStorageMock.verifyPermission).toHaveBeenCalledWith(SAVED_HANDLE);

    resolveLoad();
    await waitFor(() => expect(document.querySelector('.chat-container')).toBeInTheDocument());
    expect(fileStorageMock.verifyPermission).toHaveBeenCalledWith(SAVED_HANDLE);
  });

  it('stays on the welcome screen when file selection is cancelled', async () => {
    fileStorageMock.selectAndSaveFile.mockResolvedValue(null);
    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать GGUF файл' }));
    await waitFor(() => expect(fileStorageMock.selectAndSaveFile).toHaveBeenCalled());
    expect(screen.getByText('Локальный ИИ Чат')).toBeInTheDocument();
    expect(runtimeMock.loadModelFromFile).not.toHaveBeenCalled();
  });

  it('shows an error when file permission is denied', async () => {
    fileStorageMock.verifyPermission.mockResolvedValue(false);
    await renderAccess();
    fireEvent.click(screen.getByRole('button', { name: 'Запустить' }));
    await waitFor(() => expect(screen.getByText('Доступ к файлу отклонен')).toBeInTheDocument());
    expect(screen.getByText('Обнаружена модель')).toBeInTheDocument();
  });

  it('returns to the access screen after a cancelled load', async () => {
    runtimeMock.loadModelFromFile.mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    await renderAccess();
    fireEvent.click(screen.getByRole('button', { name: 'Запустить' }));
    await waitFor(() => expect(screen.getByText('Обнаружена модель')).toBeInTheDocument());
    expect(screen.queryByText(/Ошибка/)).toBeNull();
  });

  it('shows a load error and keeps the access screen', async () => {
    runtimeMock.loadModelFromFile.mockRejectedValue(new Error('boom'));
    await renderAccess();
    fireEvent.click(screen.getByRole('button', { name: 'Запустить' }));
    await waitFor(() => expect(screen.getByText('Ошибка: boom')).toBeInTheDocument());
    expect(screen.getByText('Обнаружена модель')).toBeInTheDocument();
  });

  it('cancels an active load and returns to the access screen', async () => {
    let rejectLoad;
    runtimeMock.loadModelFromFile.mockImplementation(() => new Promise((_, reject) => { rejectLoad = reject; }));

    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать GGUF файл' }));
    await waitFor(() => expect(screen.getByText('Загрузка модели в оперативную память')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(runtimeMock.cancelLoad).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Отмена' })).toBeNull());

    rejectLoad(new DOMException('cancelled', 'AbortError'));
    await waitFor(() => expect(screen.getByText('Обнаружена модель')).toBeInTheDocument());
  });

  it('loads a model from HuggingFace and opens chat', async () => {
    runtimeMock.loadModelFromHF.mockResolvedValue({ fileHandle: SAVED_HANDLE });
    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Скачать Qwen3.8-2B (HF)' }));

    await waitFor(() => expect(runtimeMock.loadModelFromHF).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('.chat-container')).toBeInTheDocument());
    expect(fileStorageMock.saveFileHandle).toHaveBeenCalledWith(SAVED_HANDLE);
  });

  it('does nothing when the HuggingFace save picker is cancelled', async () => {
    fileStorageMock.saveFilePicker.mockResolvedValue(null);
    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Скачать Qwen3.8-2B (HF)' }));
    await waitFor(() => expect(fileStorageMock.saveFilePicker).toHaveBeenCalled());
    expect(screen.getByText('Локальный ИИ Чат')).toBeInTheDocument();
    expect(runtimeMock.loadModelFromHF).not.toHaveBeenCalled();
  });

  it('returns from a cancelled HuggingFace download', async () => {
    runtimeMock.loadModelFromHF.mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Скачать Qwen3.8-2B (HF)' }));
    await waitFor(() => expect(screen.getByText('Обнаружена модель')).toBeInTheDocument());
  });

  it('shows an HuggingFace download error', async () => {
    runtimeMock.loadModelFromHF.mockRejectedValue(new Error('net'));
    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Скачать Qwen3.8-2B (HF)' }));
    await waitFor(() => expect(screen.getByText('HF ошибка: net')).toBeInTheDocument());
  });

  it('skips model selection and unloads back to the welcome screen', async () => {
    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Перейти в чат без модели' }));
    await waitFor(() => expect(document.querySelector('.chat-container')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }));
    await waitFor(() => expect(screen.getByText('Локальный ИИ Чат')).toBeInTheDocument());
    expect(runtimeMock.unloadModel).toHaveBeenCalled();
  });

  it('unloads a loaded model back to the access screen', async () => {
    await openChatFromAccess();
    fireEvent.click(screen.getByRole('button', { name: 'Выгрузить' }));
    await waitFor(() => expect(screen.getByText('Обнаружена модель')).toBeInTheDocument());
  });

  it('applies execution settings and reloads the model from chat', async () => {
    await openChatFromAccess();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Применить и перезагрузить' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Применить и перезагрузить' }));

    await waitFor(() => expect(runtimeMock.unloadModel).toHaveBeenCalled());
    await waitFor(() => expect(runtimeMock.loadModelFromFile).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(document.querySelector('.chat-container')).toBeInTheDocument());
  });

  it('reports an error when settings are applied without a model file', async () => {
    await renderWelcome();
    fireEvent.click(screen.getByRole('button', { name: 'Перейти в чат без модели' }));
    await waitFor(() => expect(document.querySelector('.chat-container')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Применить и перезагрузить' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Применить и перезагрузить' }));
    await waitFor(() =>
      expect(screen.getByText('Файл модели недоступен для перезагрузки')).toBeInTheDocument()
    );
  });

  it('reports a pending operation when settings are applied during loading', async () => {
    runtimeMock.isGenerationPending.mockReturnValue(true);
    await openChatFromAccess();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Применить и перезагрузить' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Применить и перезагрузить' }));
    await waitFor(() =>
      expect(screen.getByText('Дождитесь завершения текущей операции')).toBeInTheDocument()
    );
  });
});

describe('App environment banner', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(FLAG_KEY, '1');
    resetMocks();
  });

  afterEach(() => {
    delete window.navigator.userAgent;
    Object.defineProperty(window.navigator, 'gpu', { value: null, configurable: true });
  });

  it('labels a Firefox user agent and still shows the warning modal', async () => {
    localStorage.removeItem(FLAG_KEY);
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
      configurable: true,
    });

    render(<App />);
    await waitFor(() => expect(screen.getByText(/B: Firefox/)).toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('labels a Chromium user agent and hides the warning modal', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      configurable: true,
    });

    render(<App />);
    await waitFor(() => expect(screen.getByText(/B: Chromium/)).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('marks WebGPU as available when navigator.gpu exists', async () => {
    Object.defineProperty(window.navigator, 'gpu', { value: {}, configurable: true });

    render(<App />);
    await waitFor(() => expect(screen.getByText(/WebGPU: ✓ available/)).toBeInTheDocument());
    expect(screen.getByText(/COOP: ✗/)).toBeInTheDocument();
  });
});
