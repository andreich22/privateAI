# Local React AI

Локальный ИИ-чат, работающий полностью в браузере. Загружает GGUF-модели и выполняет инференс через WebAssembly/WebGPU — без отправки данных на сервер.

## Возможности

- Запуск LLM прямо в браузере на клиенте
- Загрузка пользовательских GGUF-файлов через File System Access API
- Скачивание моделей напрямую с HuggingFace (Qwen3.8-2B)
- Сохранение дескриптора файла в IndexedDB для быстрого повторного запуска
- Потоковая генерация ответов (streaming)
- Индикатор среды: GPU, COOP/COEP, количество ядер CPU, браузер

## Стек

- **React 19** + **Vite 7**
- **[wllama](https://github.com/ngxson/wllama)** — WebAssembly/WebGPU бэкенд для llama.cpp
- **[idb](https://github.com/jakearchibald/idb)** — обёртка над IndexedDB
- GGUF-формат моделей

## Быстрый старт

```bash
npm install
npm run dev
```

Откроется `http://localhost:5173`.

## Использование

1. **Выбор файла** — нажмите «Указать путь к GGUF модели» и выберите `.gguf`-файл с диска.
2. **Скачать модель** — нажмите «Скачать с HuggingFace» для загрузки Qwen3.8-2B в формате Q4_K_M.
3. **Повторный запуск** — при следующем открытии приложения дескриптор файла восстанавливается из IndexedDB; подтвердите доступ для мгновенного старта.
4. **Чат** — отправляйте сообщения и получайте ответы в потоковом режиме.
5. **Выгрузить модель** — освободите память браузера кнопкой в хедере чата.

## Структура проекта

```
src/
├── components/
│   ├── WelcomeScreen.jsx      # Экран выбора файла / скачивания
│   ├── AccessScreen.jsx       # Экран восстановления прав доступа
│   ├── LoadingScreen.jsx      # Прогресс-бар загрузки модели
│   └── ChatWorkspace.jsx      # Окно чата
├── services/
│   ├── fileStorage.js         # IndexedDB + File System Access API
│   └── aiService.js           # Wllama: загрузка модели, стриминг, чат
├── App.jsx                    # Управление состояниями (welcome → access → loading → chat)
└── main.jsx
```

## Требования

- Современный браузер (Chrome / Edge с поддержкой WebGPU)
- Файлы моделей в формате **GGUF**
- ОЗУ не менее 4–8 ГБ для моделей квантованных (Q4/Q5)

## Build

```bash
npm run build        # production build в dist/
npm run preview      # локальный просмотр production сборки
```

## Лицензия

MIT
