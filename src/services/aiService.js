import { Wllama } from '@wllama/wllama';

let wllamaInstance = null;
let chatHistory = [];
let loadAbortController = null;

export async function initWllama() {
  if (wllamaInstance) return wllamaInstance;

  console.log('[aiService] === INIT WLLAMA ===');
  console.log('[aiService] GPU:', !!navigator.gpu);
  console.log('[aiService] COOP:', window.crossOriginIsolated);

  wllamaInstance = new Wllama({
    default: '/wllama/wllama.wasm',
  });
  wllamaInstance.setCompat(null);
  console.log('[aiService] Wllama created');
  return wllamaInstance;
}

export async function loadModelFromFile(fileHandle, onProgress) {
  console.log('[aiService] === LOAD MODEL FROM FILE ===');
  loadAbortController = new AbortController();
  const signal = loadAbortController.signal;

  if (onProgress) onProgress(5);

  if (signal.aborted) {
    if (onProgress) onProgress(0);
    throw new DOMException('Load cancelled', 'AbortError');
  }

  const wllama = await initWllama();
  const file = await fileHandle.getFile();
  console.log('[aiService] File:', file.name, 'size:', file.size);

  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isGguf = header[0] === 0x47 && header[1] === 0x47 && header[2] === 0x55 && header[3] === 0x46;
  console.log('[aiService] Valid GGUF:', isGguf);
  if (!isGguf) {
    loadAbortController = null;
    throw new Error('Invalid GGUF magic: ' + Array.from(header).join(' '));
  }

  if (onProgress) onProgress(20);

  try {
    await wllama.loadModel([file], {
      n_ctx: 4096,
      n_gpu_layers: 0,
      signal,
    });
    console.log('[aiService] loadModel resolved');

    const loaded = wllama.isModelLoaded();
    console.log('[aiService] isModelLoaded:', loaded);
    if (!loaded) throw new Error('Model not loaded');

    const ctx = wllama.getLoadedContextInfo();
    console.log('[aiService] Context:', {
      n_ctx: ctx.n_ctx, n_layer: ctx.n_layer,
      n_vocab: ctx.n_vocab, n_embd: ctx.n_embd,
      metadata_keys: Object.keys(ctx.metadata || {}),
    });

    if (onProgress) onProgress(100);
    console.log('[aiService] === MODEL LOADED ===');
  } catch (err) {
    console.error('[aiService] Load ERROR:', err);
    if (onProgress) onProgress(0);
    throw err;
  } finally {
    loadAbortController = null;
  }
}

export async function loadModelFromHF(onProgress, fileHandle) {
  console.log('[aiService] === LOAD MODEL FROM HF ===');
  loadAbortController = new AbortController();
  const signal = loadAbortController.signal;

  if (onProgress) onProgress(5);

  if (signal.aborted) {
    if (onProgress) onProgress(0);
    throw new DOMException('Load cancelled', 'AbortError');
  }

  const repo = 'empero-ai/Qwen3.8-2B-GGUF';
  const filename = 'Qwen3.8-2B-Q4_K_M.gguf';
  const hfUrl = `https://huggingface.co/${repo}/resolve/main/${filename}`;

  let blob = null;
  let writable = null;

  try {
    const response = await fetch(hfUrl, { signal });
    if (!response.ok) throw new Error(`HF HTTP ${response.status}`);
    const total = response.headers.get('content-length');
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;

    if (fileHandle) {
      writable = await fileHandle.createWritable();
      console.log('[aiService] Streaming download to file:', fileHandle.name);
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;

      if (fileHandle && writable) {
        await writable.write(value);
      }

      if (onProgress && total) {
        onProgress(Math.round((loaded / parseInt(total)) * 60) + 10);
      }
    }

    if (fileHandle && writable) {
      await writable.close();
      console.log('[aiService] Download written to file:', fileHandle.name);
    }

    const blobSize = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    blob = new Blob(chunks, { type: 'application/x-gguf' });
    console.log('[aiService] HF download complete, blob size:', blobSize);

    if (signal.aborted) {
      if (onProgress) onProgress(0);
      throw new DOMException('Load cancelled', 'AbortError');
    }

    const wllama = await initWllama();
    await wllama.loadModel([blob], {
      n_ctx: 4096,
      n_gpu_layers: 0,
      signal,
    });

    const loadedFlag = wllama.isModelLoaded();
    console.log('[aiService] isModelLoaded:', loadedFlag);
    if (!loadedFlag) throw new Error('Model not loaded');

    const ctx = wllama.getLoadedContextInfo();
    console.log('[aiService] Context:', {
      n_ctx: ctx.n_ctx, n_layer: ctx.n_layer,
      n_vocab: ctx.n_vocab, n_embd: ctx.n_embd,
      metadata_keys: Object.keys(ctx.metadata || {}),
    });

    if (onProgress) onProgress(100);
    console.log('[aiService] === MODEL LOADED FROM HF ===');

    return { blob, fileHandle };
  } catch (err) {
    try {
      if (writable) {
        await writable.abort();
      }
    } catch (e) { /* ignore abort errors */ }
    console.error('[aiService] HF Load ERROR:', err);
    if (onProgress) onProgress(0);
    throw err;
  } finally {
    loadAbortController = null;
  }
}

export async function streamChat(messages, onToken) {
  if (!wllamaInstance) throw new Error('Модель не загружена');

  console.log('[aiService] === STREAM CHAT ===');
  messages.forEach((m, i) => console.log(`[aiService]   [${i}] ${m.role}: ${String(m.content).substring(0, 80)}`));

  try {
    const response = await wllamaInstance.createChatCompletion({
      messages,
      stream: true,
      max_tokens: 512,
      temperature: 0.7,
    });

    console.log('[aiService] Stream type:', typeof response);
    console.log('[aiService] Is async iter:', typeof response?.[Symbol.asyncIterator] === 'function');

    let fullText = '';
    let chunks = 0;
    for await (const chunk of response) {
      chunks++;
      console.log(`[aiService] Chunk ${chunks}:`, JSON.stringify(chunk).substring(0, 200));
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        fullText += content;
        onToken(content);
      }
    }
    console.log('[aiService] === DONE === Chunks:', chunks, 'Text:', fullText);
  } catch (err) {
    console.error('[aiService] Stream ERROR:', err.message);
    throw err;
  }
}

export async function simpleCompletion(text, onToken) {
  if (!wllamaInstance) throw new Error('Модель не загружена');
  console.log('[aiService] === SIMPLE COMPLETION ===');
  console.log('[aiService] Prompt:', text);

  try {
    const response = await wllamaInstance.createCompletion({
      prompt: text,
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
    console.log('[aiService] Result:', fullText);
    return fullText;
  } catch (err) {
    console.error('[aiService] Completion ERROR:', err.message);
    throw err;
  }
}

export async function unloadModel() {
  if (wllamaInstance) {
    await wllamaInstance.exit();
    wllamaInstance = null;
    chatHistory = [];
  }
}

export function cancelLoad() {
  console.log('[aiService] === CANCEL LOAD ===');
  if (loadAbortController) {
    loadAbortController.abort();
    loadAbortController = null;
  }
}

export function isLoadPending() {
  return loadAbortController !== null && !loadAbortController.signal.aborted;
}

export function addMessageToHistory(role, content) {
  chatHistory.push({ role, content });
}

export function getChatHistory() {
  return [...chatHistory];
}
