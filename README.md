# privateAI

A privacy-first local AI chat application that runs entirely in your browser. Models are loaded locally and inference is performed client-side using WebAssembly/WebGPU, so chat data does not need to be sent to a remote AI server.

## Features

- **Local LLM inference** directly in the browser
- **GGUF model support** for local model files
- **WebAssembly/WebGPU acceleration** through [wllama](https://github.com/ngxson/wllama)
- **Hugging Face model downloads** directly from the application
- **Streaming responses** for an interactive chat experience
- **Persistent model access** using IndexedDB and the File System Access API
- **CPU/GPU environment information**, including WebGPU availability, COOP/COEP status, CPU core count, and browser details
- **Model lifecycle controls**, including unloading a model to release browser memory
- **Test and coverage tooling** integrated into the development workflow

## Live Demo

The application is available at:

https://private-ai-xi.vercel.app/

## Privacy

privateAI is designed to keep AI inference local to the user's browser. GGUF models are loaded into the browser and inference runs on the client using WebAssembly/WebGPU.

Your model files and chat content are not intentionally uploaded to a privateAI backend for inference. Network requests may still be made for explicitly requested resources such as downloading a model from Hugging Face.

> **Note:** Browser privacy also depends on the model source, browser capabilities, extensions, and any external resources you choose to access.

## Supported Models

privateAI works with models distributed in the **GGUF** format and can load compatible local files through the browser's File System Access API.

The application can also download supported models from Hugging Face. Model size and quantization directly affect memory usage and inference performance.

## Requirements

- A modern Chromium-based browser such as **Google Chrome** or **Microsoft Edge**
- WebGPU support is recommended for hardware acceleration
- A compatible **GGUF** model
- Approximately **4–8 GB of RAM or more** for smaller quantized models; larger models require more memory

Browser support for WebGPU and the File System Access API may vary.

## Getting Started

### Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/andreich22/privateAI.git
cd privateAI
npm install
```

### Start the development server

```bash
npm run dev
```

The development server will normally be available at:

```
http://localhost:5173
```

### Production build

```bash
npm run build
npm run preview
```

The production build is generated in `dist/`.

## Using privateAI

1. **Choose a model** — select a compatible `.gguf` file from your computer.
2. **Download a model** — use the Hugging Face model download option when available.
3. **Grant file access** — when the browser asks for permission to access a previously selected model, grant access to restore the model quickly.
4. **Chat** — send messages and receive generated responses using streaming.
5. **Adjust generation settings** — configure the available model generation parameters from the application settings.
6. **Unload the model** — release model memory when it is no longer needed.

## Architecture

The project is built with React and Vite, with local model inference provided by wllama.

```text
Browser
  │
  ├── React UI
  │     ├── Model selection
  │     ├── Chat workspace
  │     └── Generation settings
  │
  ├── Local storage
  │     └── IndexedDB + File System Access API
  │
  └── Local inference
        └── wllama → llama.cpp → GGUF model
```

### Main source structure

```text
src/
├── components/
│   ├── WelcomeScreen.jsx
│   ├── AccessScreen.jsx
│   ├── LoadingScreen.jsx
│   └── ChatWorkspace.jsx
├── services/
│   ├── fileStorage.js
│   └── aiService.js
├── App.jsx
└── main.jsx
```

Additional tests, scripts, documentation, and CI configuration are located in the repository's `tests/`, `__tests__/`, `scripts/`, `.github/`, and `docs/` directories.

## Technology Stack

- **React 19**
- **Vite 7**
- **wllama** — WebAssembly/WebGPU backend for llama.cpp
- **IndexedDB** via the `idb` package
- **GGUF** model format
- **Vitest** for unit and coverage tests
- **Playwright** for browser-level testing

## Development

Useful commands include:

```bash
# Start development
npm run dev

# Build the application
npm run build

# Preview the production build
npm run preview

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

Check `package.json` for the complete list of available scripts.

## Testing and CI

The repository uses automated checks to validate changes before they are merged. Tests include unit-level coverage and browser-oriented checks.

Coverage reports can be generated with:

```bash
npm run test:coverage
```

The generated coverage output can be used to inspect which parts of the codebase are covered by tests.

## Contributing

Contributions are welcome.

A typical workflow is:

1. Fork the repository or create a feature branch.
2. Install dependencies with `npm install`.
3. Make your changes.
4. Add or update tests where appropriate.
5. Run the relevant test and build commands locally.
6. Open a pull request with a clear description of the change.

Please keep changes focused and avoid committing generated build artifacts unless they are explicitly required.

## License

This project is licensed under the **MIT License**.
