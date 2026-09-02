import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

function createWllamaMock() {
  return {
    setCompat: vi.fn(),
    loadModel: vi.fn().mockResolvedValue(undefined),
    loadModelFromHF: vi.fn().mockResolvedValue(undefined),
    isModelLoaded: vi.fn().mockReturnValue(true),
    getLoadedContextInfo: vi.fn().mockReturnValue({
      n_ctx: 4096,
      n_layer: 24,
      n_vocab: 151936,
      n_embd: 2048,
      metadata: {},
    }),
    createChatCompletion: vi.fn().mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: 'test response' } }] };
      })()
    ),
    createCompletion: vi.fn().mockResolvedValue(
      (async function* () {
        yield { choices: [{ text: 'completion result' }] };
      })()
    ),
    exit: vi.fn().mockResolvedValue(undefined),
  };
}

let wllamaCallCount = 0;
let freshWllama = null;

vi.mock('@wllama/wllama', async () => {
  function Wllama() {
    wllamaCallCount++;
    if (!freshWllama) {
      freshWllama = createWllamaMock();
    }
    return freshWllama;
  }
  Wllama.callCount = () => wllamaCallCount;
  Wllama.resetCount = () => { wllamaCallCount = 0; };
  Wllama.getFreshInstance = () => freshWllama;
  return { Wllama };
});

const mockDB = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
};

vi.mock('idb', async () => ({
  openDB: vi.fn().mockResolvedValue(mockDB),
}));

const mockWritable = {
  write: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  abort: vi.fn().mockResolvedValue(undefined),
  closed: Promise.resolve(),
};

const mockFileHandle = {
  queryPermission: vi.fn().mockResolvedValue('granted'),
  requestPermission: vi.fn().mockResolvedValue('granted'),
  getFile: vi.fn().mockResolvedValue(
    new File(['test model content'], 'model.gguf', { type: 'application/x-gguf' })
  ),
  name: 'model.gguf',
  isFile: true,
  createWritable: vi.fn().mockResolvedValue(mockWritable),
};

if (typeof window !== 'undefined') {
  window.showOpenFilePicker = vi.fn().mockResolvedValue([mockFileHandle]);
  window.showSaveFilePicker = vi.fn().mockResolvedValue(mockFileHandle);
}

globalThis.navigator = {
  gpu: null,
};

globalThis.window.crossOriginIsolated = false;

if (typeof document !== 'undefined') {
  if (!document.baseURI) {
    document.baseURI = 'file:///';
  }
  if (!document.documentURI) {
    document.documentURI = 'file:///';
  }
  if (!document.styleMedia) {
    document.styleMedia = { type: 'screen' };
  }
  if (!document.currentScript) {
    Object.defineProperty(document, 'currentScript', {
      value: null,
      writable: true,
      configurable: true,
    });
  }
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() });
  }
  if (!window.getSelection) {
    window.getSelection = vi.fn().mockReturnValue({});
  }
  if (!window.scroll) {
    window.scroll = vi.fn();
  }
  if (!window.scrollTo) {
    window.scrollTo = vi.fn();
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = vi.fn().mockImplementation((cb) => setTimeout(cb, 0));
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = vi.fn();
  }
  if (!window.startViewTransition) {
    window.startViewTransition = vi.fn().mockReturnValue({ finished: Promise.resolve() });
  }
}

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const mockFetchResponse = {
  ok: true,
  status: 200,
  headers: { get: (key) => key === 'content-length' ? '1000' : null },
  body: {
    getReader: () => {
      let done = false;
      return {
        read: async () => {
          if (done) return { done: true, value: undefined };
          done = true;
          return { done: false, value: new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x01, 0x00, 0x00, 0x00]) };
        }
      };
    }
  }
};

if (typeof fetch !== 'undefined') {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => mockFetchResponse);
}

afterEach(() => {
  freshWllama = null;
  wllamaCallCount = 0;

  mockDB.put.mockClear();
  mockDB.get.mockClear();
  mockDB.delete.mockClear();
  mockDB.close.mockClear();

  mockFileHandle.queryPermission.mockClear();
  mockFileHandle.requestPermission.mockClear();
  mockFileHandle.getFile.mockClear();
  mockFileHandle.createWritable.mockClear();
  mockWritable.write.mockClear();
  mockWritable.close.mockClear();
  mockWritable.abort.mockClear();

  mockDB.get.mockResolvedValue(null);

  if (typeof window !== 'undefined') {
    window.showOpenFilePicker.mockClear();
  }

  vi.clearAllMocks();
});
