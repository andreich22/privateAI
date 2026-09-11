const GGUF_MAGIC = new Uint8Array([0x47, 0x47, 0x55, 0x46]); // "GGUF"

export async function setupMocks(page, options = {}) {
  const {
    mockChatResponse = '1+1 = 2',
    mockSavedHandleName = null,
  } = options;

  await page.addInitScript(
    ({ savedHandleName, chatResponse }) => {
      const GGUF_MAGIC = new Uint8Array([0x47, 0x47, 0x55, 0x46]); // "GGUF"
      window.crossOriginIsolated = true;
      window.__mockChatResponse = chatResponse;

      window.navigator.gpu = {
        requestAdapter: async () => ({
          requestDevice: async () => ({}),
        }),
      };

      let pendingHandle = null;
      let permissionGranted = true;

      window.showOpenFilePicker = async () => {
        if (!pendingHandle) throw new Error('No file selected');
        return [pendingHandle];
      };

      const MockWllama = class {
        constructor() {
          this._modelLoaded = false;
          this._chatHistory = [];
        }
        setCompat() {}
        async loadModel() { this._modelLoaded = true; }
        async loadModelFromHF() { this._modelLoaded = true; }
        isModelLoaded() { return this._modelLoaded; }
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
          const text = chatResponse;
          if (stream) {
            const tokens = text.split('');
            let i = 0;
            return {
              [Symbol.asyncIterator]: () => ({
                next: async () => {
                  if (i >= tokens.length) return { done: true, value: null };
                  await new Promise((r) => setTimeout(r, 500));
                  return { done: false, value: { choices: [{ delta: { content: tokens[i++] } }] } };
                },
              }),
            };
          }
          return { choices: [{ message: { content: text } }] };
        }
        async createCompletion({ prompt, stream }) {
          const text = chatResponse;
          if (stream) {
            const tokens = text.split('');
            let i = 0;
            return {
              [Symbol.asyncIterator]: () => ({
                next: async () => {
                  if (i >= tokens.length) return { done: true, value: null };
                  await new Promise((r) => setTimeout(r, 50));
                  return { done: false, value: { choices: [{ text: tokens[i++] }], stop: false } };
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
      };

      window.__MockWllama = MockWllama;

      window.__setPendingFileHandle = (name) => {
        pendingHandle = {
          name,
          getFile: async () => ({
            name,
            size: 1024 * 1024 * 100,
            slice: () => ({ arrayBuffer: async () => GGUF_MAGIC.buffer }),
            type: 'application/x-gguf',
          }),
          queryPermission: async () => permissionGranted ? 'granted' : 'denied',
          requestPermission: async () => permissionGranted ? 'granted' : 'denied',
        };
      };

      window.__setPermissionGranted = (v) => { permissionGranted = v; };
      window.__clearPendingFileHandle = () => { pendingHandle = null; };
      window.__getPendingFileHandle = () => pendingHandle;

      const savedHandle = savedHandleName
        ? {
            name: savedHandleName,
            getFile: async () => ({
              name: savedHandleName,
              size: 100,
              slice: () => ({ arrayBuffer: async () => GGUF_MAGIC.buffer }),
            }),
            queryPermission: async () => 'granted',
            requestPermission: async () => 'granted',
          }
        : null;

      let dbData = {};
      const mockDb = {
        put: async (store, value, key) => {
          dbData[store + ':' + key] = value;
        },
        get: async (store, key) => {
          if (store === 'FileHandles' && key === 'gguf_model_handle' && savedHandle) return savedHandle;
          return dbData[store + ':' + key] || null;
        },
        deleteObjectStore: () => {},
      };
      window.openDB = async () => mockDb;

      (async () => {
        try {
          if (indexedDB.databases) {
            const dbNames = await indexedDB.databases();
            for (const db of dbNames) {
              if (db.name) indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (_) {}
      })();
    },
    { savedHandleName: mockSavedHandleName, chatResponse: mockChatResponse }
  );
}

export async function setMockFileHandle(page, name = 'test-model.gguf') {
  await page.evaluate((n) => { window.__setPendingFileHandle(n); }, name);
}

export async function setPermissionGranted(page, granted = true) {
  await page.evaluate((g) => { window.__setPermissionGranted(g); }, granted);
}

export async function clearMockState(page) {
  await page.evaluate(() => {
    window.__clearPendingFileHandle?.();
    window.__setPermissionGranted(true);
  });
}
