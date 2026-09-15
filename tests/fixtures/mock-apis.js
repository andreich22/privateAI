const GGUF_MAGIC = new Uint8Array([0x47, 0x47, 0x55, 0x46]); // "GGUF"

const idbMockCode = `
const __mockData = {};
function createMockStore(name, keyPath) {
    const data = {};
    const indexes = {};
    const indexData = {};
    return {
        name,
        keyPath,
        data,
        createIndex: function(idxName, keyPath) {
            indexes[idxName] = keyPath;
            indexData[idxName] = {};
            return this;
        },
        put: async function(value) {
            const k = value[keyPath];
            data[k] = value;
            for (const [idxName, kp] of Object.entries(indexes)) {
                if (!indexData[idxName]) indexData[idxName] = {};
                const idxVal = kp ? value[kp] : k;
                if (!indexData[idxName][idxVal]) indexData[idxName][idxVal] = new Set();
                indexData[idxName][idxVal].add(k);
            }
        },
        get: async function(k) { return data[k] || null; },
        delete: async function(k) { delete data[k]; },
        getAll: async function(filter) {
            if (filter === undefined) return Object.values(data);
            return null;
        },
        getAllFromIndex: async function(idxName, idxVal) {
            const idxD = indexData[idxName];
            if (!idxD) return [];
            const keys = idxD[idxVal];
            if (!keys) return [];
            return Array.from(keys).map((k) => data[k]).filter(Boolean);
        },
        index: function(idxName) {
            return {
                getAll: async function(idxVal) {
                    const idxD = indexData[idxName];
                    if (!idxD) return [];
                    const keys = idxD[idxVal];
                    if (!keys) return [];
                    return Array.from(keys).map((k) => data[k]).filter(Boolean);
                }
            };
        }
    };
}
export async function openDB(name, version, config) {
    if (!__mockData[name]) __mockData[name] = { stores: {}, txCounter: 0 };
    const state = __mockData[name];
    const db = {
        name, version,
        objectStoreNames: { contains: (n) => Object.prototype.hasOwnProperty.call(state.stores, n) },
        createObjectStore: function(name, opts) {
            const store = createMockStore(name, opts?.keyPath);
            state.stores[name] = store;
            return store;
        },
        transaction: function(storeNames, mode) {
            const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
            const storeObjs = stores.map((s) => state.stores[s] || null);
            const tx = {
                store: storeObjs[0],
                objectStore: (s) => state.stores[s] || null,
                mode,
                done: new Promise((r) => setTimeout(r, 10)),
                abort: () => {},
            };
            return tx;
        },
        get: async function(storeName, key) {
            const store = state.stores[storeName];
            return store ? await store.get(key) : null;
        },
        put: async function(storeName, value) {
            const store = state.stores[storeName];
            if (store) await store.put(value);
        },
        delete: async function(storeName, key) {
            const store = state.stores[storeName];
            if (store) await store.delete(key);
        },
        getAllFromIndex: async function(storeName, indexName, idxVal) {
            const store = state.stores[storeName];
            if (!store) return [];
            return await store.getAllFromIndex(indexName, idxVal);
        },
        deleteDatabase: () => Promise.resolve(),
    };
    if (config?.upgrade) {
        config.upgrade(db);
    }
    return db;
}
export async function deleteDatabase(name) {
    delete __mockData[name];
}
`;

const wllamaMockCode = `
export class Wllama {
    constructor() {
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
    isModelLoaded() { return this._modelLoaded; }
    isSupportWebGPU() { return false; }
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
        const text = globalThis.__mockChatResponse || '1+1 = 2';
        if (stream) {
            const tokens = text.split('');
            let i = 0;
            return {
                [Symbol.asyncIterator]: () => ({
                    next: async () => {
                        if (i >= tokens.length) return { done: true, value: null };
                        await new Promise((r) => setTimeout(r, 50));
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
        const text = globalThis.__mockChatResponse || '1+1 = 2';
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
`;

export async function setupMocks(page, options = {}) {
  const {
    mockChatResponse = '1+1 = 2',
    mockSavedHandleName = null,
  } = options;

  await page.route('https://huggingface.co/**', async (route) => {
    const modelBytes = new Uint8Array([
      ...GGUF_MAGIC,
      0x00, 0x00, 0x00, 0x00,
    ]);

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(modelBytes.byteLength),
      },
      body: Buffer.from(modelBytes),
    });
  });

  await page.route(
    /.*\/node_modules\/\.vite\/deps\/idb.*\.js.*/,
    async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: idbMockCode,
      });
    }
  );

  await page.route(
    '**/node_modules/.vite/deps/@wllama_wllama.js*',
    async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: wllamaMockCode,
      });
    }
  );

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

      const createSaveHandle = (name) => {
        let bytes = new Uint8Array();
        return {
          name,
          createWritable: async () => ({
            write: async (chunk) => {
              const value = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
              const next = new Uint8Array(bytes.length + value.length);
              next.set(bytes);
              next.set(value, bytes.length);
              bytes = next;
            },
            close: async () => {},
            abort: async () => { bytes = new Uint8Array(); },
          }),
          getFile: async () => ({
            name,
            size: bytes.length || 8,
            slice: () => ({ arrayBuffer: async () => (bytes.length ? bytes.buffer : GGUF_MAGIC.buffer) }),
            type: 'application/x-gguf',
          }),
          queryPermission: async () => 'granted',
          requestPermission: async () => 'granted',
        };
      };

      window.showOpenFilePicker = async () => {
        if (!pendingHandle) throw new Error('No file selected');
        return [pendingHandle];
      };

      window.showSaveFilePicker = async ({ suggestedName } = {}) => (
        createSaveHandle(suggestedName || 'model.gguf')
      );

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
      let objectStores = new Set();
      let indexes = {};
      let transactions = [];
      let txId = 0;

      const createMockStore = (storeName, keyPath) => ({
        name: storeName,
        keyPath,
        data: {},
        _indexes: {},
        createIndex: (idxName, keyPath) => {
          this._indexes[idxName] = keyPath;
          return this;
        },
        put: async (value) => {
          const k = value[keyPath];
          this.data[k] = value;
          for (const [idxName, kp] of Object.entries(this._indexes)) {
            if (!this._indexes[idxName + '_data']) this._indexes[idxName + '_data'] = {};
            const idxVal = kp ? value[kp] : k;
            if (!this._indexes[idxName + '_data'][idxVal]) this._indexes[idxName + '_data'][idxVal] = new Set();
            this._indexes[idxName + '_data'][idxVal].add(k);
          }
        },
        get: async (k) => this.data[k] || null,
        delete: async (k) => {
          delete this.data[k];
        },
        getAll: async (idxVal) => {
          const idxKey = this._indexes['default'] ? null : null;
          if (idxVal === undefined) {
            return Object.values(this.data);
          }
          const idxData = this._indexes[idxVal + '_data'] || this._indexes['default_data'];
          const keys = idxData ? Array.from(idxData) : [];
          return keys.map((k) => this.data[k]).filter(Boolean);
        },
        getAllFromIndex: async (idxName, idxVal) => {
          const idxData = this._indexes[idxName + '_data'];
          if (!idxData) return [];
          const keys = idxData[idxVal] || new Set();
          return Array.from(keys).map((k) => this.data[k]).filter(Boolean);
        },
        index: (idxName) => ({
          getAll: async (idxVal) => {
            const idxData = this._indexes[idxName + '_data'];
            if (!idxData) return [];
            const keys = idxData[idxVal] || new Set();
            return Array.from(keys).map((k) => this.data[k]).filter(Boolean);
          },
        }),
      });

      const mockDb = {
        _stores: {},
        objectStoreNames: {
          contains: (name) => objectStores.has(name),
        },
        createObjectStore: (name, opts) => {
          objectStores.add(name);
          const store = createMockStore(name, opts?.keyPath);
          mockDb._stores[name] = store;
          return store;
        },
        transaction: (storeNames, mode) => {
          const id = ++txId;
          const storeArr = Array.isArray(storeNames) ? storeNames : [storeNames];
          const stores = storeArr.map((s) => mockDb._stores[s]);
          const tx = {
            store: stores.length === 1 ? stores[0] : null,
            objectStore: (name) => mockDb._stores[name],
            mode,
            done: new Promise((resolve) => {
              setTimeout(resolve, 10);
            }),
          };
          transactions.push(tx);
          return tx;
        },
        get: async (storeName, key) => {
          const store = mockDb._stores[storeName];
          return store ? await store.get(key) : null;
        },
        put: async (storeName, value) => {
          const store = mockDb._stores[storeName];
          if (store) await store.put(value);
        },
        delete: async (storeName, key) => {
          const store = mockDb._stores[storeName];
          if (store) await store.delete(key);
        },
        getAllFromIndex: async (storeName, indexName, idxVal) => {
          const store = mockDb._stores[storeName];
          if (!store) return [];
          return await store.getAllFromIndex(indexName, idxVal);
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
