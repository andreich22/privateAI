import { Wllama } from '@wllama/wllama';

let wllamaInstance = null;
let chatHistory = [];

const WLLAMA_PATH_CONFIG = {
  default: '/wllama/wllama.wasm',
};

export async function initWllama() {
  if (wllamaInstance) return wllamaInstance;

  wllamaInstance = new Wllama(WLLAMA_PATH_CONFIG);
  return wllamaInstance;
}

export async function loadModelFromFile(fileHandle, onProgress) {
  const wllama = await initWllama();
  const file = await fileHandle.getFile();

  await wllama.loadModel([file], {
    progressCallback: ({ loaded, total }) => {
      onProgress(Math.round((loaded / total) * 100));
    }
  });
}

export async function streamChat(messages, onToken) {
  if (!wllamaInstance) throw new Error('Модель не загружена');

  await wllamaInstance.createChatCompletion({
    messages,
    stream: true,
    onData: (chunk) => {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        onToken(content);
      }
    },
    n_predict: 512,
    temp: 0.7,
  });
}

export async function unloadModel() {
  if (wllamaInstance) {
    await wllamaInstance.exit();
    wllamaInstance = null;
    chatHistory = [];
  }
}

export function addMessageToHistory(role, content) {
  chatHistory.push({ role, content });
}

export function getChatHistory() {
  return [...chatHistory];
}
