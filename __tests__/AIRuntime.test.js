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
      expect.objectContaining({ n_ctx: MODEL_CONTEXT, signal: expect.any(Object) })
    );
    expect(MODEL_CONTEXT).toBe(8192);
    expect(instance.loadModel.mock.calls[0][1]).not.toHaveProperty('n_gpu_layers');
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

  it('unloads the model and clears runtime state', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    expect(runtime.isLoaded()).toBe(true);
    await runtime.unloadModel();
    expect(runtime.isLoaded()).toBe(false);
    expect(runtime.getRuntimeState()).toBe(RUNTIME_STATES.UNLOADED);
  });

  it('streams chat responses through the runtime instance', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const onToken = vi.fn();
    const result = await runtime.streamChat([{ role: 'user', content: 'Hello' }], onToken);
    expect(result).toBe('test response');
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
});
