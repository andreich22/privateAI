import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIRuntime, MODEL_CONTEXT, RUNTIME_STATES } from '../src/services/AIRuntime.js';

function createFileHandle(bytes = [0x47, 0x47, 0x55, 0x46, 0, 0, 0, 0]) {
  return {
    name: 'model.gguf',
    getFile: vi.fn().mockResolvedValue(new File([new Uint8Array(bytes)], 'model.gguf', { type: 'application/x-gguf' })),
  };
}

describe('AIRuntime', () => {
  let runtime;

  beforeEach(() => {
    vi.resetModules();
    runtime = new AIRuntime();
  });

  it('starts unloaded and exposes lifecycle state changes', async () => {
    const states = [];
    const unsubscribe = runtime.subscribe((status) => states.push(status.state));
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.UNLOADED);
    await runtime.loadModelFromFile(createFileHandle());
    expect(states).toContain(RUNTIME_STATES.LOADING);
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.READY);
    unsubscribe();
  });

  it('creates one Wllama instance per runtime', async () => {
    const first = await runtime.init();
    const second = await runtime.init();
    expect(first).toBe(second);
  });

  it('loads GGUF with enough context for multi-turn local chats', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    expect(instance.loadModel).toHaveBeenCalledWith(
      [expect.any(File)],
      expect.objectContaining({ n_ctx: MODEL_CONTEXT, n_gpu_layers: 99999, signal: expect.any(Object) })
    );
    expect(MODEL_CONTEXT).toBe(8192);
  });

  it('rejects invalid GGUF files and enters error state', async () => {
    await expect(runtime.loadModelFromFile(createFileHandle([0, 0, 0, 0]))).rejects.toThrow('Invalid GGUF magic');
    expect(runtime.isLoaded()).toBe(false);
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.ERROR);
    expect(runtime.getRuntimeStatus().error).toBeInstanceOf(Error);
  });

  it('keeps loading state instance-local and cancellable', async () => {
    await runtime.init();
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    let resolveLoad;
    instance.loadModel.mockImplementation(() => new Promise((resolve) => { resolveLoad = resolve; }));

    const loadPromise = runtime.loadModelFromFile(createFileHandle());
    await vi.waitFor(() => expect(instance.loadModel).toHaveBeenCalled());
    expect(runtime.isLoadPending()).toBe(true);
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.LOADING);

    runtime.cancelLoad();
    resolveLoad();

    await expect(loadPromise).rejects.toThrow('Load cancelled');
    expect(runtime.isLoadPending()).toBe(false);
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.UNLOADED);
  });

  it('returns null for context info when the model is unavailable or already unloaded', async () => {
    expect(runtime.getContextInfo()).toBeNull();
    runtime.wllama = { getLoadedContextInfo: vi.fn(() => { throw new Error('loadModel() is not yet called'); }) };
    expect(runtime.getContextInfo()).toBeNull();
  });

  it('unloads the model and clears runtime state', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    expect(runtime.isLoaded()).toBe(true);
    await runtime.unloadModel();
    expect(runtime.isLoaded()).toBe(false);
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.UNLOADED);
    expect(runtime.getContextInfo()).toBeNull();
  });

  it('streams chat responses and returns token usage metadata', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const onToken = vi.fn();
    const result = await runtime.streamChat([{ role: 'user', content: 'Hello' }], onToken);
    expect(result).toEqual({
      text: 'test response',
      usage: { cached: null, input: null, output: null, total: null },
    });
    expect(onToken).toHaveBeenCalledWith('test response');
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.READY);
  });

  it('passes the complete multi-turn message history to Wllama', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    const history = [
      { role: 'system', content: 'Отвечай кратко.' },
      { role: 'user', content: 'Меня зовут Андрей.' },
      { role: 'assistant', content: 'Приятно познакомиться, Андрей.' },
      { role: 'user', content: 'Как меня зовут?' },
    ];

    await runtime.streamChat(history, vi.fn());

    expect(instance.createChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      messages: history,
      stream: true,
      cache_prompt: true,
    }));
  });

  it('passes validated generation parameters to Wllama', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    await runtime.streamChat([{ role: 'user', content: 'Hello' }], vi.fn(), {
      temperature: 1.2,
      top_p: 0.8,
      max_tokens: 1024,
    });
    expect(instance.createChatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 1.2,
      top_p: 0.8,
      max_tokens: 1024,
      stream: true,
      cache_prompt: true,
      messages: [{ role: 'user', content: 'Hello' }],
    }));
  });

  it('rejects invalid generation parameters before calling Wllama', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    await expect(runtime.streamChat([{ role: 'user', content: 'Hello' }], vi.fn(), { temperature: 3 })).rejects.toThrow('temperature');
    expect(instance.createChatCompletion).not.toHaveBeenCalled();
  });
  it('ignores non-function subscribers and supports unsubscribe', () => {
    expect(runtime.subscribe(null)).toBeTypeOf('function');
    const listener = vi.fn();
    const unsubscribe = runtime.subscribe(listener);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ state: RUNTIME_STATES.UNLOADED }));
    unsubscribe();
    runtime.setExecutionSettings({ n_gpu_layers: 0 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports execution, backend and generation capabilities', () => {
    expect(runtime.getBackendInfo()).toEqual({ webgpuSupported: false, mode: 'auto' });
    expect(runtime.getGenerationCapabilities()).toEqual({
      temperature: true,
      top_p: true,
      max_tokens: true,
    });
    expect(runtime.getExecutionCapabilities()).toEqual({
      gpuLayerOffload: true,
      cpuLayerOffload: true,
      requiresReload: true,
    });
  });

  it('reports execution status using the loaded context layer count', async () => {
    expect(runtime.getExecutionStatus()).toEqual({
      n_gpu_layers: -1,
      gpuLayers: null,
      cpuLayers: null,
      totalLayers: null,
    });

    await runtime.loadModelFromFile(createFileHandle());
    expect(runtime.getExecutionStatus()).toEqual({
      n_gpu_layers: -1,
      gpuLayers: 24,
      cpuLayers: 0,
      totalLayers: 24,
    });

    expect(runtime.setExecutionSettings({ n_gpu_layers: 7 })).toEqual({ n_gpu_layers: 7 });
    expect(runtime.getExecutionStatus()).toEqual({
      n_gpu_layers: 7,
      gpuLayers: 7,
      cpuLayers: 17,
      totalLayers: 24,
    });
  });

  it('returns cached token count from the runtime when available', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    instance.getCachedTokens = vi.fn().mockResolvedValue(['a', 'b', 'c']);

    expect(await runtime.getCachedTokenCount()).toBe(3);
    instance.getCachedTokens.mockResolvedValueOnce('not-an-array');
    expect(await runtime.getCachedTokenCount()).toBeNull();
    instance.getCachedTokens.mockRejectedValueOnce(new Error('cache unavailable'));
    expect(await runtime.getCachedTokenCount()).toBeNull();
  });

  it('streams a simple completion and restores ready state', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const onToken = vi.fn();

    await expect(runtime.simpleCompletion('Say hello', onToken)).resolves.toBe('completion result');
    expect(onToken).toHaveBeenCalledWith('completion result');
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.READY);
  });

  it('passes custom completion generation settings', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();

    await runtime.simpleCompletion('Say hello', vi.fn(), {
      temperature: 1.1,
      top_p: 0.9,
      max_tokens: 128,
    });

    expect(instance.createCompletion).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Say hello',
      stream: true,
      temperature: 1.1,
      top_p: 0.9,
      max_tokens: 128,
      abortSignal: expect.any(Object),
    }));
  });

  it('rejects completion before calling Wllama when the model is unloaded', async () => {
    await expect(runtime.simpleCompletion('hello', vi.fn())).rejects.toThrow('Модель не загружена');
  });

  it('rejects overlapping model loads', async () => {
    await runtime.init();
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    let resolveLoad;
    instance.loadModel.mockImplementationOnce(() => new Promise((resolve) => { resolveLoad = resolve; }));

    const first = runtime.loadModelFromFile(createFileHandle());
    await vi.waitFor(() => expect(instance.loadModel).toHaveBeenCalled());
    await expect(runtime.loadModelFromFile(createFileHandle())).rejects.toThrow('already in progress');

    resolveLoad();
    await first;
  });

  it('rejects loading while the runtime is unloading', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const unloadPromise = runtime.unloadModel();
    await expect(runtime.loadModelFromFile(createFileHandle())).rejects.toThrow('unloading is in progress');
    await unloadPromise;
  });

  it('handles Hugging Face downloads and persists the supplied file handle', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => '8' },
      body: { getReader: () => ({ read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3, 4, 5]) })
        .mockResolvedValueOnce({ done: true }) }) },
    });
    const fileHandle = createFileHandle();
    fileHandle.createWritable = vi.fn().mockResolvedValue({ write: vi.fn(), close: vi.fn() });
    const progress = vi.fn();

    const result = await runtime.loadModelFromHF(progress, fileHandle, { n_gpu_layers: 0 });

    expect(result).toEqual({ fileHandle });
    expect(progress).toHaveBeenCalledWith(62.5);
    expect(progress).toHaveBeenCalledWith(100);
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(runtime.isLoaded()).toBe(true);

    const { Wllama } = await import('@wllama/wllama');
    expect(Wllama.getFreshInstance().loadModel).toHaveBeenCalledWith(
      [expect.any(File)],
      expect.objectContaining({ n_gpu_layers: 0 }),
    );
  });

  it('rejects Hugging Face HTTP failures and restores error state', async () => {
    fetch = vi.fn();
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: { get: () => null },
      body: null,
    });

    await expect(runtime.loadModelFromHF(vi.fn())).rejects.toThrow('HF HTTP 503');
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.ERROR);
    expect(runtime.isLoaded()).toBe(false);
  });

  it('rejects Hugging Face responses without a body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      body: null,
    });

    await expect(runtime.loadModelFromHF(vi.fn())).rejects.toThrow('HF response body is unavailable');
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.ERROR);
  });

  it('handles generation errors and returns to error state', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    instance.createCompletion.mockRejectedValueOnce(new Error('generation failed'));

    await expect(runtime.simpleCompletion('hello', vi.fn())).rejects.toThrow('generation failed');
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.ERROR);
    expect(runtime.isGenerationPending()).toBe(false);
  });

  it('throws on an unexpected model unload failure and records the error state', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    instance.exit.mockRejectedValueOnce(new Error('exit failed'));

    await expect(runtime.unloadModel()).rejects.toThrow('exit failed');
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.ERROR);
  });

});
