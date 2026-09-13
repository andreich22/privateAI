import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIRuntime } from '../src/services/AIRuntime.js';

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

  it('creates one Wllama instance per runtime', async () => {
    const first = await runtime.init();
    const second = await runtime.init();
    expect(first).toBe(second);
  });

  it('loads GGUF without explicitly disabling GPU', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const { Wllama } = await import('@wllama/wllama');
    const instance = Wllama.getFreshInstance();
    expect(instance.loadModel).toHaveBeenCalledWith(
      [expect.any(File)],
      expect.objectContaining({ n_ctx: 4096, signal: expect.any(Object) })
    );
    expect(instance.loadModel.mock.calls[0][1]).not.toHaveProperty('n_gpu_layers');
  });

  it('rejects invalid GGUF files', async () => {
    await expect(runtime.loadModelFromFile(createFileHandle([0, 0, 0, 0]))).rejects.toThrow('Invalid GGUF magic');
    expect(runtime.isLoaded()).toBe(false);
  });

  it('keeps loading state instance-local and cancellable', async () => {
    const handle = createFileHandle();
    const loadPromise = runtime.loadModelFromFile(handle);
    expect(runtime.isLoadPending()).toBe(true);
    runtime.cancelLoad();
    await expect(loadPromise).rejects.toThrow();
    expect(runtime.isLoadPending()).toBe(false);
  });

  it('unloads the model and clears runtime state', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    expect(runtime.isLoaded()).toBe(true);
    await runtime.unloadModel();
    expect(runtime.isLoaded()).toBe(false);
  });

  it('streams chat responses through the runtime instance', async () => {
    await runtime.loadModelFromFile(createFileHandle());
    const onToken = vi.fn();
    const result = await runtime.streamChat([{ role: 'user', content: 'Hello' }], onToken);
    expect(result).toBe('test response');
    expect(onToken).toHaveBeenCalledWith('test response');
  });
});
