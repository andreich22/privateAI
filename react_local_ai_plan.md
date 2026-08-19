# Архитектурный план для ИИ-агента: Локальный чат на React (Wllama + JSX)

Этот документ содержит пошаговое руководство для ИИ-агента (Cursor, Claude Engineer, GPT-4) по созданию веб-приложения на **React (JSX)**. Оно загружает локальные `.gguf` модели пользователя через **File System Access API**, сохраняет дескриптор в **IndexedDB** и запускает инференс в браузере через **WebAssembly/WebGPU**.

---

## 📁 Структура проекта

```text
src/
├── components/
│   ├── WelcomeScreen.jsx      # Экран выбора файла
│   ├── AccessScreen.jsx       # Экран восстановления прав доступа
│   ├── LoadingScreen.jsx      # Индикатор загрузки модели в RAM
│   └── ChatWorkspace.jsx      # Окно чата и отправки сообщений
├── services/
│   ├── fileStorage.js         # Работа с IndexedDB и File System Access API
│   └── aiService.js           # Управление Wllama (инференс)
├── App.jsx                    # Корневой компонент (управление состояниями)
├── index.css                  # Базовые стили для чата
└── main.jsx
```

---

## Модуль 1: Настройка окружения (Vite + React)

### Задача
Инициализировать React-приложение и настроить CORS-изоляцию в Vite для работы многопоточного WebAssembly.

### Инструкции для ИИ
1. Развернуть React-проект: `npm create vite@latest local-react-ai -- --template react`
2. Установить зависимости: `npm install @ngxson/wllama idb`
3. Настроить `vite.config.js` для отправки заголовков COOP и COEP.

### Файл: `vite.config.js`
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```

---

## Модуль 2: Сервисы данных и ИИ

### Файл: `src/services/fileStorage.js`
```javascript
import { openDB } from 'idb';

const DB_NAME = 'LocalReactAIVault';
const STORE_NAME = 'FileHandles';
const KEY_NAME = 'gguf_model_handle';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export async function selectAndSaveFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] }
      }],
      excludeAcceptAllOption: true,
      multiple: false
    });
    
    const db = await getDB();
    await db.put(STORE_NAME, handle, KEY_NAME);
    return handle;
  } catch (e) {
    console.error('Выбор файла отменен:', e);
    return null;
  }
}

export async function getSavedFileHandle() {
  const db = await getDB();
  return (await db.get(STORE_NAME, KEY_NAME)) || null;
}

export async function verifyPermission(fileHandle) {
  const opts = { mode: 'read' };
  if ((await fileHandle.queryPermission(opts)) === 'granted') return true;
  if ((await fileHandle.requestPermission(opts)) === 'granted') return true;
  return false;
}
```

### Файл: `src/services/aiService.js`
```javascript
import { Wllama } from '@ngxson/wllama';

let wllamaInstance = null;

export async function initWllama() {
  if (wllamaInstance) return wllamaInstance;

  wllamaInstance = new Wllama({
    'bridge.wasm': '/wllama/wllama_bridge.wasm',
    'multi-thread.wasm': '/wllama/wllama_targets/multi-thread.wasm',
  });
  
  return wllamaInstance;
}

export async function loadModelFromFile(fileHandle, onProgress) {
  const wllama = await initWllama();
  const file = await fileHandle.getFile();
  
  await wllama.loadModelFromBlob(file, {
    progressCallback: ({ loaded, total }) => {
      onProgress(Math.round((loaded / total) * 100));
    }
  });
}

export async function streamChat(prompt, onToken) {
  if (!wllamaInstance) throw new Error('Модель не загружена');

  await wllamaInstance.createCompletion({
    prompt,
    onToken: (chunk) => onToken(chunk.text),
    nPredict: 512,
    temp: 0.7,
  });
}

export async function unloadModel() {
  if (wllamaInstance) {
    await wllamaInstance.unload();
  }
}
```

---

## Модуль 3: Реализация React-компонентов (JSX)

### Файл: `src/App.jsx`
```jsx
import React, { useState, useEffect } from 'react';
import { getSavedFileHandle, verifyPermission, selectAndSaveFile } from './services/fileStorage';
import { loadModelFromFile, unloadModel } from './services/aiService';
import WelcomeScreen from './components/WelcomeScreen';
import AccessScreen from './components/AccessScreen';
import LoadingScreen from './components/LoadingScreen';
import ChatWorkspace from './components/ChatWorkspace';

export default function App() {
  const [status, setStatus] = useState('checking'); // checking | welcome | access | loading | chat
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    async function checkExistingHandle() {
      const handle = await getSavedFileHandle();
      if (handle) {
        setFileHandle(handle);
        setFileName(handle.name);
        setStatus('access');
      } else {
        setStatus('welcome');
      }
    }
    checkExistingHandle();
  }, []);

  const handleSelectFile = async () => {
    const handle = await selectAndSaveFile();
    if (handle) {
      setFileHandle(handle);
      setFileName(handle.name);
      handleStartModel(handle);
    }
  };

  const handleStartModel = async (handle = fileHandle) => {
    try {
      const hasPermission = await verifyPermission(handle);
      if (!hasPermission) return alert('Доступ к файлу отклонен');
      
      setStatus('loading');
      await loadModelFromFile(handle, setProgress);
      setStatus('chat');
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки модели. Возможно, не хватает ОЗУ.');
      setStatus('welcome');
    }
  };

  const handleUnload = async () => {
    await unloadModel();
    setStatus('welcome');
    setFileHandle(null);
  };

  if (status === 'checking') return <div className="centered">Проверка базы данных...</div>;
  if (status === 'welcome') return <WelcomeScreen onSelect={handleSelectFile} />;
  if (status === 'access') return <AccessScreen fileName={fileName} onConfirm={() => handleStartModel()} onReset={handleSelectFile} />;
  if (status === 'loading') return <LoadingScreen progress={progress} fileName={fileName} />;
  if (status === 'chat') return <ChatWorkspace fileName={fileName} onUnload={handleUnload} />;
}
```

### Файл: `src/components/ChatWorkspace.jsx`
```jsx
import React, { useState, useRef, useEffect } from 'react';
import { streamChat } from '../services/aiService';

export default function ChatWorkspace({ fileName, onUnload }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    const botMessage = { role: 'assistant', text: '' };
    setMessages(prev => [...prev, botMessage]);

    try {
      await streamChat(input, (token) => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            last.text += token;
          }
          return updated;
        });
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="chat-container">
      <header>
        <span>Активная модель: <strong>{fileName}</strong></span>
        <button onClick={onUnload} className="btn-danger">Выгрузить модель</button>
      </header>
      <div className="messages-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="sender">{msg.role === 'user' ? 'Вы' : 'ИИ'}</div>
            <div className="text">{msg.text || '...'}</div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSend} className="input-form">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder={isGenerating ? "ИИ генерирует ответ..." : "Введите сообщение..."} 
          disabled={isGenerating}
        />
        <button type="submit" disabled={isGenerating || !input.trim()}>Отправить</button>
      </form>
    </div>
  );
}
```

### Файлы: `src/components/WelcomeScreen.jsx`, `AccessScreen.jsx`, `LoadingScreen.jsx`
```jsx
// WelcomeScreen.jsx
export default function WelcomeScreen({ onSelect }) {
  return (
    <div className="screen centered">
      <h1>Локальный ИИ Чат</h1>
      <p>Выберите файл модели GGUF со своего компьютера, чтобы начать.</p>
      <button onClick={onSelect} className="btn-main">Указать путь к GGUF модели</button>
    </div>
  );
}

// AccessScreen.jsx
export function AccessScreen({ fileName, onConfirm, onReset }) {
  return (
    <div className="screen centered">
      <h1>Обнаружена сохраненная модель</h1>
      <p>Файл: <strong>{fileName}</strong></p>
      <div className="btn-group">
        <button onClick={onConfirm} className="btn-main">Запустить модель</button>
        <button onClick={onReset} className="btn-sub">Выбрать другой файл</button>
      </div>
    </div>
  );
}

// LoadingScreen.jsx
export function LoadingScreen({ progress, fileName }) {
  return (
    <div className="screen centered">
      <h1>Загрузка модели в оперативную память</h1>
      <p>{fileName}</p>
      <div className="progress-bar-container">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="progress-text">{progress}%</div>
    </div>
  );
}
```

---

## 🎨 Стили (`src/index.css`)
```css
body { margin: 0; font-family: sans-serif; background: #1e1e2e; color: #cdd6f4; }
.centered { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px; box-sizing: border-box; }
.screen h1 { margin-bottom: 10px; color: #89b4fa; }
.screen p { color: #a6adc8; margin-bottom: 25px; }
.btn-main { background: #89b4fa; color: #11111b; border: none; padding: 12px 24px; font-size: 16px; border-radius: 8px; cursor: pointer; font-weight: bold; }
.btn-sub { background: #313244; color: #cdd6f4; border: none; padding: 12px 24px; font-size: 16px; border-radius: 8px; cursor: pointer; margin-left: 10px; }
.btn-danger { background: #f38ba8; color: #11111b; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; }
.chat-container { display: flex; flex-direction: column; height: 100vh; max-width: 800px; margin: 0 auto; background: #181825; }
header { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #11111b; border-bottom: 1px solid #313244; }
.messages-box { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
.message { padding: 12px; border-radius: 8px; max-width: 80%; }
.message.user { background: #313244; align-self: flex-end; color: #cdd6f4; }
.message.assistant { background: #45475a; align-self: flex-start; color: #a6e3a1; }
.sender { font-size: 12px; opacity: 0.6; margin-bottom: 5px; font-weight: bold; }
.input-form { display: flex; padding: 15px; background: #11111b; gap: 10px; }
.input-form input { flex: 1; padding: 12px; background: #313244; border: none; border-radius: 6px; color: #cdd6f4; font-size: 16px; }
.input-form button { background: #a6e3a1; color: #11111b; border: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.input-form button:disabled { opacity: 0.5; cursor: not-allowed; }
.progress-bar-container { width: 300px; height: 10px; background: #313244; border-radius: 5px; overflow: hidden; margin-bottom: 10px; }
.progress-bar-fill { height: 100%; background: #a6e3a1; transition: width 0.2s ease; }
.progress-text { font-weight: bold; color: #a6e3a1; }
```