const GGUF_MAGIC = new Uint8Array([0x47, 0x47, 0x55, 0x46]);

export class Wllama {
  constructor(opts) {
    this._opts = opts;
    this._modelLoaded = false;
    this._chatHistory = [];
  }

  setCompat() {}

  async loadModel() {
    await new Promise((r) => setTimeout(r, 500));
    this._modelLoaded = true;
  }

  async loadModelFromHF() {
    await new Promise((r) => setTimeout(r, 500));
    this._modelLoaded = true;
  }

  isModelLoaded() {
    return this._modelLoaded;
  }

  getLoadedContextInfo() {
    return {
      n_ctx: 4096,
      n_layer: 32,
      n_vocab: 151936,
      n_embd: 2048,
      metadata: { model: 'Qwen3.8-2B' },
    };
  }

  async createChatCompletion({ messages, stream }) {
    this._chatHistory = messages;
    const text = window.__mockChatResponse || '1+1 = 2';
    if (stream) {
      const tokens = text.split('');
      let i = 0;
      return {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            if (i >= tokens.length) return { done: true, value: null };
            return {
              done: false,
              value: { choices: [{ delta: { content: tokens[i++] } }] },
            };
          },
        }),
      };
    }
    return { choices: [{ message: { content: text } }] };
  }

  async createCompletion({ prompt, stream }) {
    const text = window.__mockChatResponse || '1+1 = 2';
    if (stream) {
      const tokens = text.split('');
      let i = 0;
      return {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            if (i >= tokens.length) return { done: true, value: null };
            return {
              done: false,
              value: { choices: [{ text: tokens[i++] }], stop: false },
            };
          },
        }),
      };
    }
    return { choices: [{ text: text }] };
  }

  async exit() {
    this._modelLoaded = false;
    this._chatHistory = [];
  }
}
