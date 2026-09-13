import { Wllama } from '@wllama/wllama';

const MODEL_CONTEXT = 4096;

function createAbortError() {
  return new DOMException('Load cancelled', 'AbortError');
}

export class AIRuntime {
  constructor() {
    this.wllama = null;
    this.loadAbortController = null;
    this.modelLoaded = false;
  }

  async init() {
    if (this.wllama) return this.wllama;

    this.wllama = new Wllama({
      default: '/wllama/wllama.wasm',
    });
    this.wllama.setCompat(null);
    return this.wllama;
  }

  async loadModelFromFile(fileHandle, onProgress) {
    return this.#loadModel(async (signal) => {
      const file = await fileHandle.getFile();
      if (signal.aborted) throw createAbortError();

      const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const isGguf = header[0] === 0x47 && header[1] === 0x47 && header[2] === 0x55 && header[3] === 0x46;
      if (!isGguf) {
        throw new Error(`Invalid GGUF magic: ${Array.from(header).join(' ')}`);
      }

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
      const chunks = [];

      try {
        if (fileHandle) writable = await fileHandle.createWritable();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (signal.aborted) throw createAbortError();

          chunks.push(value);
          loaded += value.byteLength;
          if (writable) await writable.write(value);

          if (total) onProgress?.(10 + Math.round((loaded / total) * 60));
        }

        if (writable) {
          await writable.close();
          writable = null;
        }

        const blob = new Blob(chunks, { type: 'application/x-gguf' });
        await this.#loadWllama([blob], signal);
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
    if (this.loadAbortController) {
      throw new Error('Model loading is already in progress');
    }

    const controller = new AbortController();
    this.loadAbortController = controller;
    onProgress?.(5);

    try {
      await loadSource(controller.signal);
      if (controller.signal.aborted) throw createAbortError();
      this.modelLoaded = true;
      onProgress?.(100);
    } catch (error) {
      this.modelLoaded = false;
      onProgress?.(0);
      throw error;
    } finally {
      if (this.loadAbortController === controller) {
        this.loadAbortController = null;
      }
    }
  }

  async #loadWllama(files, signal) {
    const wllama = await this.init();
    if (signal.aborted) throw createAbortError();

    // Wllama v3 enables WebGPU automatically when it is available.
    // Do not pass n_gpu_layers: 0 — that explicitly disables GPU offload.
    await wllama.loadModel(files, {
      n_ctx: MODEL_CONTEXT,
      signal,
    });

    if (!wllama.isModelLoaded()) {
      throw new Error('Model not loaded');
    }
  }

  async streamChat(messages, onToken) {
    this.#assertLoaded();
    const response = await this.wllama.createChatCompletion({
      messages,
      stream: true,
      max_tokens: 512,
      temperature: 0.7,
    });

    let fullText = '';
    for await (const chunk of response) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        fullText += content;
        onToken(content);
      }
    }
    return fullText;
  }

  async simpleCompletion(prompt, onToken) {
    this.#assertLoaded();
    const response = await this.wllama.createCompletion({
      prompt,
      stream: true,
      max_tokens: 64,
      temperature: 0.7,
    });

    let fullText = '';
    for await (const chunk of response) {
      const text = chunk.choices?.[0]?.text;
      if (text) {
        fullText += text;
        onToken(text);
      }
    }
    return fullText;
  }

  cancelLoad() {
    this.loadAbortController?.abort();
  }

  isLoadPending() {
    return Boolean(this.loadAbortController && !this.loadAbortController.signal.aborted);
  }

  isLoaded() {
    return this.modelLoaded && Boolean(this.wllama?.isModelLoaded?.());
  }

  getContextInfo() {
    return this.wllama?.getLoadedContextInfo?.() ?? null;
  }

  async unloadModel() {
    this.cancelLoad();
    const instance = this.wllama;
    this.wllama = null;
    this.modelLoaded = false;
    if (instance) await instance.exit();
  }

  #assertLoaded() {
    if (!this.isLoaded()) throw new Error('Модель не загружена');
  }
}
