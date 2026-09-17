import { Wllama } from '@wllama/wllama';
import { DEFAULT_GENERATION_SETTINGS, validateGenerationSettings } from './generationSettings';
import { mergeTokenUsage, normalizeTokenUsage } from './tokenUsage';

export const MODEL_CONTEXT = 8192;
export const RUNTIME_STATES = Object.freeze({
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  READY: 'ready',
  GENERATING: 'generating',
  ERROR: 'error',
  UNLOADING: 'unloading',
});

function createAbortError() {
  return new DOMException('Load cancelled', 'AbortError');
}

function createGenerationOptions(settings = {}) {
  const validated = validateGenerationSettings(settings);
  return {
    max_tokens: validated.max_tokens,
    temperature: validated.temperature,
    top_p: validated.top_p,
  };
}

export class AIRuntime {
  constructor() {
    this.wllama = null;
    this.loadAbortController = null;
    this.loadPromise = null;
    this.generationAbortController = null;
    this.generationPromise = null;
    this.modelLoaded = false;
    this.runtimeState = RUNTIME_STATES.UNLOADED;
    this.runtimeError = null;
    this.listeners = new Set();
  }

  async init() {
    if (this.wllama) return this.wllama;
    this.wllama = new Wllama({ default: '/wllama/wllama.wasm' });
    this.wllama.setCompat(null);
    return this.wllama;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    listener(this.getRuntimeStatus());
    return () => this.listeners.delete(listener);
  }

  getRuntimeState() { return this.runtimeState; }

  getRuntimeStatus() {
    return { state: this.runtimeState, error: this.runtimeError, loaded: this.isLoaded() };
  }

  #setState(state, error = null) {
    this.runtimeState = state;
    this.runtimeError = error;
    const status = this.getRuntimeStatus();
    for (const listener of this.listeners) {
      try { listener(status); } catch { /* listener errors must not affect runtime */ }
    }
  }

  async loadModelFromFile(fileHandle, onProgress) {
    return this.#loadModel(async (signal) => {
      const file = await fileHandle.getFile();
      if (signal.aborted) throw createAbortError();
      const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const isGguf = header[0] === 0x47 && header[1] === 0x47 && header[2] === 0x55 && header[3] === 0x46;
      if (!isGguf) throw new Error(`Invalid GGUF magic: ${Array.from(header).join(' ')}`);
      onProgress?.(20);
      await this.#loadWllama([file], signal);
    }, onProgress);
  }

  async loadModelFromHF(onProgress, fileHandle) {
    return this.#loadModel(async (signal) => {
      const repo = 'empero-ai/Qwen3.8-2B-GGUF';
      const filename = 'Qwen3.8-2B-Q4_K_M.gguf';
      const hfUrl = `https://huggingface.co/${repo}/resolve/main/${filename}`;
      const response = await fetch(hfUrl, { signal });
      if (!response.ok) throw new Error(`HF HTTP ${response.status}`);
      if (!response.body) throw new Error('HF response body is unavailable');
      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body.getReader();
      let loaded = 0;
      let writable = null;
      const chunks = fileHandle ? null : [];
      try {
        if (fileHandle) writable = await fileHandle.createWritable();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (signal.aborted) throw createAbortError();
          if (chunks) chunks.push(value);
          if (writable) await writable.write(value);
          loaded += value.byteLength;
          if (total) onProgress?.(10 + Math.round((loaded / total) * 60));
        }
        if (writable) {
          await writable.close();
          writable = null;
        }
        const model = fileHandle ? await fileHandle.getFile() : new Blob(chunks, { type: 'application/x-gguf' });
        await this.#loadWllama([model], signal);
        return { fileHandle };
      } catch (error) {
        try { await reader.cancel(); } catch { /* ignore */ }
        if (writable) {
          try { await writable.abort(); } catch { /* ignore */ }
        }
        throw error;
      }
    }, onProgress);
  }

  async #loadModel(loadSource, onProgress) {
    if (this.loadPromise) throw new Error('Model loading is already in progress');
    if (this.runtimeState === RUNTIME_STATES.UNLOADING) throw new Error('Model unloading is in progress');
    const controller = new AbortController();
    this.loadAbortController = controller;
    this.#setState(RUNTIME_STATES.LOADING);
    onProgress?.(5);
    const operation = (async () => {
      try {
        await loadSource(controller.signal);
        if (controller.signal.aborted) throw createAbortError();
        this.modelLoaded = true;
        this.#setState(RUNTIME_STATES.READY);
        onProgress?.(100);
      } catch (error) {
        this.modelLoaded = false;
        if (error?.name === 'AbortError') this.#setState(RUNTIME_STATES.UNLOADED);
        else this.#setState(RUNTIME_STATES.ERROR, error);
        onProgress?.(0);
        throw error;
      } finally {
        if (this.loadAbortController === controller) this.loadAbortController = null;
        if (this.loadPromise === operation) this.loadPromise = null;
      }
    })();
    this.loadPromise = operation;
    return operation;
  }

  async #loadWllama(files, signal) {
    const wllama = await this.init();
    if (signal.aborted) throw createAbortError();
    await wllama.loadModel(files, { n_ctx: MODEL_CONTEXT, signal });
    if (!wllama.isModelLoaded()) throw new Error('Model not loaded');
  }

  getBackendInfo() {
    return {
      webgpuSupported: Boolean(this.wllama?.isSupportWebGPU?.() ?? navigator.gpu),
      mode: 'auto',
    };
  }

  getGenerationCapabilities() {
    return { temperature: true, top_p: true, max_tokens: true };
  }

  async getCachedTokenCount() {
    if (!this.wllama || !this.isLoaded() || typeof this.wllama.getCachedTokens !== 'function') return null;
    try {
      const tokens = await this.wllama.getCachedTokens();
      return Array.isArray(tokens) ? tokens.length : null;
    } catch {
      return null;
    }
  }

  async streamChat(messages, onToken, settings) {
    return this.#generate(async (controller) => {
      const cachedBeforeRequest = await this.getCachedTokenCount();
      let usage = normalizeTokenUsage(null, cachedBeforeRequest);
      const response = await this.wllama.createChatCompletion({
        messages,
        stream: true,
        cache_prompt: true,
        ...createGenerationOptions(settings),
        abortSignal: controller.signal,
      });
      let fullText = '';
      for await (const chunk of response) {
        if (controller.signal.aborted) throw createAbortError();
        if (chunk?.usage) {
          usage = mergeTokenUsage(usage, normalizeTokenUsage(chunk.usage, cachedBeforeRequest));
        }
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          onToken(content);
        }
      }
      return { text: fullText, usage };
    });
  }

  async simpleCompletion(prompt, onToken, settings) {
    return this.#generate(async (controller) => {
      const options = settings ? createGenerationOptions(settings) : { ...DEFAULT_GENERATION_SETTINGS, max_tokens: 64 };
      const response = await this.wllama.createCompletion({
        prompt,
        stream: true,
        ...options,
        abortSignal: controller.signal,
      });
      let fullText = '';
      for await (const chunk of response) {
        if (controller.signal.aborted) throw createAbortError();
        const text = chunk.choices?.[0]?.text;
        if (text) {
          fullText += text;
          onToken(text);
        }
      }
      return fullText;
    });
  }

  async #generate(generate) {
    if (!this.isLoaded()) throw new Error('Модель не загружена');
    if (this.generationPromise) throw new Error('Generation is already in progress');
    const controller = new AbortController();
    this.generationAbortController = controller;
    this.#setState(RUNTIME_STATES.GENERATING);
    const operation = (async () => {
      try {
        return await generate(controller);
      } catch (error) {
        if (error?.name !== 'AbortError') this.#setState(RUNTIME_STATES.ERROR, error);
        throw error;
      } finally {
        if (this.generationPromise === operation) this.generationPromise = null;
        if (this.generationAbortController === controller) this.generationAbortController = null;
        if (this.runtimeState === RUNTIME_STATES.GENERATING) this.#setState(RUNTIME_STATES.READY);
      }
    })();
    this.generationPromise = operation;
    return operation;
  }

  cancelLoad() { this.loadAbortController?.abort(); }
  cancelGeneration() { this.generationAbortController?.abort(); }
  isLoadPending() { return Boolean(this.loadPromise); }
  isGenerationPending() { return Boolean(this.generationPromise); }
  isLoaded() { return this.modelLoaded && Boolean(this.wllama?.isModelLoaded?.()); }
  getContextInfo() { return this.wllama?.getLoadedContextInfo?.() ?? null; }

  async unloadModel() {
    this.#setState(RUNTIME_STATES.UNLOADING);
    this.cancelLoad();
    this.cancelGeneration();
    const load = this.loadPromise;
    if (load) {
      try { await load; } catch { /* expected on cancellation */ }
    }
    const generation = this.generationPromise;
    if (generation) {
      try { await generation; } catch { /* expected on cancellation */ }
    }
    const instance = this.wllama;
    this.wllama = null;
    this.modelLoaded = false;
    if (instance) {
      try { await instance.exit(); } catch (error) { this.#setState(RUNTIME_STATES.ERROR, error); throw error; }
    }
    this.#setState(RUNTIME_STATES.UNLOADED);
  }
}

export { createGenerationOptions };
