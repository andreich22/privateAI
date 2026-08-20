import { describe, it, expect, beforeEach, vi } from 'vitest';

function resetModules() {
  vi.resetModules();
  return import('../src/services/aiService.js');
}

describe('aiService - initWllama', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns singleton - calls constructor only once', async () => {
    const { initWllama, unloadModel } = await resetModules();
    const { Wllama } = await import('@wllama/wllama');

    const instance1 = await initWllama();
    const instance2 = await initWllama();

    expect(Wllama.callCount()).toBe(1);
    expect(instance1).toBe(instance2);

    await unloadModel();
  });

  it('calls setCompat after construction', async () => {
    const { initWllama, unloadModel } = await resetModules();

    await initWllama();

    const { Wllama } = await import('@wllama/wllama');
    const mockInstance = Wllama.getFreshInstance();
    expect(mockInstance.setCompat).toHaveBeenCalledWith(null);

    await unloadModel();
  });
});

describe('aiService - loadModelFromFile', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('progress calls: 5 -> 20 -> 100 on success', async () => {
    const { loadModelFromFile, unloadModel } = await resetModules();
    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(
        new File([new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x00, 0x00, 0x00, 0x00])], 'model.gguf', { type: 'application/x-gguf' })
      ),
    };
    const onProgress = vi.fn();

    await loadModelFromFile(mockFileHandle, onProgress);

    expect(onProgress).toHaveBeenCalledWith(5);
    expect(onProgress).toHaveBeenCalledWith(20);
    expect(onProgress).toHaveBeenCalledWith(100);

    await unloadModel();
  });

  it('throws on invalid GGUF magic bytes', async () => {
    const { loadModelFromFile, unloadModel } = await resetModules();
    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(
        new File([new Uint8Array([0x00, 0x00, 0x00, 0x00])], 'invalid.gguf', { type: 'application/octet-stream' })
      ),
    };
    const onProgress = vi.fn();

    await expect(loadModelFromFile(mockFileHandle, onProgress)).rejects.toThrow('Invalid GGUF magic');

    expect(onProgress).toHaveBeenCalledWith(5);

    await unloadModel();
  });

  it('calls wllama.loadModel with file and config', async () => {
    const { loadModelFromFile, unloadModel } = await resetModules();
    const fileObj = new File([new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x00, 0x00, 0x00, 0x00])], 'model.gguf', { type: 'application/x-gguf' });
    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(fileObj),
    };
    const onProgress = vi.fn();

    await loadModelFromFile(mockFileHandle, onProgress);

    const { Wllama } = await import('@wllama/wllama');
    const mockInstance = Wllama.getFreshInstance();
    expect(mockInstance.loadModel).toHaveBeenCalledWith([fileObj], {
      n_ctx: 4096,
      n_gpu_layers: 0,
    });

    await unloadModel();
  });

  it('calls isModelLoaded after loadModel', async () => {
    const { loadModelFromFile, unloadModel } = await resetModules();
    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(
        new File([new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x00, 0x00, 0x00, 0x00])], 'model.gguf', { type: 'application/x-gguf' })
      ),
    };
    const onProgress = vi.fn();

    await loadModelFromFile(mockFileHandle, onProgress);

    const { Wllama } = await import('@wllama/wllama');
    const mockInstance = Wllama.getFreshInstance();
    expect(mockInstance.isModelLoaded).toHaveBeenCalled();

    await unloadModel();
  });

  it('calls getLoadedContextInfo after loadModel', async () => {
    const { loadModelFromFile, unloadModel } = await resetModules();
    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(
        new File([new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x00, 0x00, 0x00, 0x00])], 'model.gguf', { type: 'application/x-gguf' })
      ),
    };
    const onProgress = vi.fn();

    await loadModelFromFile(mockFileHandle, onProgress);

    const { Wllama } = await import('@wllama/wllama');
    const mockInstance = Wllama.getFreshInstance();
    expect(mockInstance.getLoadedContextInfo).toHaveBeenCalled();

    await unloadModel();
  });

  it('does not call onProgress if it is null', async () => {
    const { loadModelFromFile, unloadModel } = await resetModules();
    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(
        new File([new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x00, 0x00, 0x00, 0x00])], 'model.gguf', { type: 'application/x-gguf' })
      ),
    };

    await expect(loadModelFromFile(mockFileHandle, null)).resolves.not.toThrow();

    await unloadModel();
  });

  it('resets progress to 0 on loadModel error', async () => {
    const { loadModelFromFile, initWllama, unloadModel } = await resetModules();
    await initWllama();
    const { Wllama } = await import('@wllama/wllama');
    const mockInstance = Wllama.getFreshInstance();
    mockInstance.loadModel.mockRejectedValueOnce(new Error('Load failed'));

    const mockFileHandle = {
      getFile: vi.fn().mockResolvedValue(
        new File([new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x00, 0x00, 0x00, 0x00])], 'model.gguf', { type: 'application/x-gguf' })
      ),
    };
    const onProgress = vi.fn();

    await expect(loadModelFromFile(mockFileHandle, onProgress)).rejects.toThrow('Load failed');

    expect(onProgress).toHaveBeenCalledWith(5);
    expect(onProgress).toHaveBeenCalledWith(20);
    expect(onProgress).toHaveBeenCalledWith(0);

    await unloadModel();
  });
});

describe('aiService - streamChat', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws if model not loaded', async () => {
    const { streamChat } = await resetModules();

    await expect(streamChat([])).rejects.toThrow('Модель не загружена');
  });

  it('calls createChatCompletion with correct params', async () => {
    const { streamChat, initWllama, unloadModel } = await resetModules();
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const onToken = vi.fn();

    await initWllama();
    await streamChat(messages, onToken);

    const { Wllama } = await import('@wllama/wllama');
    const mockInstance = Wllama.getFreshInstance();
    expect(mockInstance.createChatCompletion).toHaveBeenCalledWith({
      messages,
      stream: true,
      max_tokens: 512,
      temperature: 0.7,
    });

    await unloadModel();
  });

  it('collects tokens from stream and calls onToken for each', async () => {
    const { streamChat, initWllama, unloadModel } = await resetModules();
    const onToken = vi.fn();

    await initWllama();
    await streamChat([], onToken);

    expect(onToken).toHaveBeenCalledWith('test response');

    await unloadModel();
  });
});

describe('aiService - simpleCompletion', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws if model not loaded', async () => {
    const { simpleCompletion } = await resetModules();

    await expect(simpleCompletion('test')).rejects.toThrow('Модель не загружена');
  });

  it('calls createCompletion with correct params', async () => {
    const { simpleCompletion, initWllama, unloadModel } = await resetModules();
    const onToken = vi.fn();

    await initWllama();
    await simpleCompletion('Hello AI', onToken);

    const { Wllama } = await import('@wllama/wllama');
    const mockInstance = Wllama.getFreshInstance();
    expect(mockInstance.createCompletion).toHaveBeenCalledWith({
      prompt: 'Hello AI',
      stream: true,
      max_tokens: 64,
      temperature: 0.7,
    });

    await unloadModel();
  });

  it('returns full text', async () => {
    const { simpleCompletion, initWllama, unloadModel } = await resetModules();
    const onToken = vi.fn();

    await initWllama();
    const result = await simpleCompletion('Hello AI', onToken);

    expect(result).toBe('completion result');

    await unloadModel();
  });
});

describe('aiService - unloadModel', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls exit on wllamaInstance', async () => {
    const { initWllama, unloadModel } = await resetModules();
    const { Wllama } = await import('@wllama/wllama');

    await initWllama();
    await unloadModel();

    const mockInstance = Wllama.getFreshInstance();
    expect(mockInstance.exit).toHaveBeenCalled();
  });

  it('resets chatHistory to empty on unload', async () => {
    const { initWllama, unloadModel, addMessageToHistory, getChatHistory } = await resetModules();

    await initWllama();
    addMessageToHistory('user', 'test');
    await unloadModel();

    expect(getChatHistory()).toEqual([]);
  });
});

describe('aiService - chatHistory', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('addMessageToHistory pushes to chat history', async () => {
    const { addMessageToHistory, getChatHistory } = await resetModules();

    addMessageToHistory('user', 'Hello');
    addMessageToHistory('assistant', 'Hi');

    const history = getChatHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(history[1]).toEqual({ role: 'assistant', content: 'Hi' });
  });

  it('getChatHistory returns a copy', async () => {
    const { addMessageToHistory, getChatHistory } = await resetModules();

    addMessageToHistory('user', 'Test');
    const history1 = getChatHistory();
    const history2 = getChatHistory();

    expect(history1).toStrictEqual(history2);
    expect(history1).not.toBe(history2);
  });
});
