# privateAI — Agent Context

## Project

`privateAI` is a local-first AI chat application. The LLM runs directly in the user's browser using GGUF models and Wllama/WebAssembly/WebGPU. User prompts, model data, and inference results must remain on the user's device unless the user explicitly requests an external integration.

Repository: `andreich22/privateAI`
Default branch: `master`

## Stack

- React 19
- Vite 7
- JavaScript / JSX
- `@wllama/wllama` 3.x
- GGUF models
- IndexedDB via `idb`
- File System Access API
- Vitest + Testing Library
- Playwright

## Architecture

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

The main application flow is:

```text
welcome → access → loading → chat
```

- `WelcomeScreen.jsx`: choose a local GGUF file or download a model from HuggingFace.
- `AccessScreen.jsx`: restore access to a previously selected local model file.
- `LoadingScreen.jsx`: show model loading/progress state.
- `ChatWorkspace.jsx`: chat UI and streaming generation.
- `fileStorage.js`: IndexedDB and File System Access API persistence/re-access.
- `aiService.js`: Wllama initialization, model loading, generation/streaming, and model cleanup.
- `App.jsx`: top-level application state and screen transitions.

## Non-negotiable principles

### Privacy-first

Do not add backend processing, telemetry, analytics, tracking, remote chat-history storage, or external AI APIs unless explicitly requested.

Before introducing any external request, determine:

1. what data leaves the device;
2. why it is needed;
3. whether the feature can remain fully local;
4. whether explicit user consent is required.

Never upload GGUF files, prompts, chat content, or model outputs to a server by default.

### Local inference

Keep AI inference in the browser. Do not move inference to a backend merely to simplify implementation.

### Minimal changes

Prefer small, focused changes that follow existing project patterns. Do not rewrite components or introduce dependencies without a concrete reason.

### Do not fabricate APIs

Inspect the repository and existing implementation before using an API, Wllama method, browser API, or project abstraction. If behavior is uncertain, verify it from the installed code/types or authoritative documentation instead of guessing.

## Browser and model constraints

The target environment is a modern Chromium browser with WebGPU support, especially Chrome/Edge.

Handle gracefully:

- missing WebGPU;
- insufficient memory;
- denied/cancelled file access;
- lost File System Access permission;
- invalid or incompatible GGUF files;
- model loading failures;
- COOP/COEP problems;
- unsupported browser features.

Do not assume every GGUF model performs equally well in the browser. Consider model size, quantization, RAM, GPU/VRAM, Wllama/llama.cpp compatibility, and load time.

## Performance and memory

Model files can be gigabytes in size. Avoid:

- unnecessary React re-renders;
- copying large buffers/arrays;
- retaining stale model references;
- loading the same model repeatedly;
- blocking the main thread unnecessarily;
- excessive React state updates during streaming;
- memory leaks during model reload/unmount.

Respect the Wllama/model lifecycle and ensure cleanup actually releases resources where the existing API allows it.

## Streaming

Preserve streaming behavior. The UI should receive partial model output rather than waiting for the complete response when streaming is available.

Streaming changes must correctly handle:

- partial output;
- completion;
- errors;
- cancellation/stop, if supported by the existing implementation;
- cleanup;
- efficient UI updates.

## Security

Treat prompts, model output, downloaded content, and GGUF metadata as untrusted input.

Be especially careful with:

- HTML/Markdown rendering and XSS;
- File System Access API permissions;
- external model URLs;
- downloaded model files;
- persistence in IndexedDB.

Never render model-generated HTML as trusted content without appropriate sanitization.

## UI/UX

The interface should be understandable to non-technical users.

Users should be able to tell:

- which model is active;
- whether the model is loading or ready;
- what the application is currently doing;
- when an error occurred and what they can do;
- whether GPU acceleration is available;
- how to free model resources when applicable.

Technical diagnostics can be exposed when useful, but should not overwhelm the primary UX.

## Error handling

Do not silently swallow important errors. Keep useful technical details for debugging while showing the user a clear explanation and a practical next step.

Prefer actionable messages such as:

```text
Не удалось загрузить модель.

Проверьте:
- формат GGUF;
- свободную память;
- поддержку WebGPU;
- доступ к файлу.
```

Do not expose raw stack traces as the primary user-facing error.

## Testing

Available commands:

```bash
npm test
npm run test:run
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
npm run build
```

Use Vitest/Testing Library for unit and component behavior and Playwright for end-to-end flows.

When changing behavior, update or add tests where practical. Pay particular attention to:

- application state transitions;
- model selection;
- permission restoration;
- loading/error states;
- streaming;
- persistence;
- chat UI;
- critical user flows.

## Task-based workflow

**Every code change MUST be tracked through a task.** No exceptions.

### Task structure

Each task is a JSON file at `tasks/<id>.json` with a unique 4-char hex ID (e.g. `3f7a`).

Required fields:
- `id` — unique 4-char hex identifier
- `name` — short title
- `description` — what the task does and why
- `status` — `planned` | `in_progress` | `done` | `cancelled`
- `created` / `updated` — ISO 8601 timestamps
- `criteria.definition_of_done` — checklist of completion conditions
- `criteria.technical_requirements` — implementation constraints
- `commits` — array of `{ hash, message, timestamp }` objects
- `files_changed` — list of modified/created files
- `links` — array of `{ task, relation, note? }` linking to related tasks
- `notes` — rationale, trade-offs, decisions

Full schema: `tasks/schema.json`. See `tasks/README.md` for examples.

### Task links

Each link is `{ task: "<4hex>", relation: "<type>", note?: "..." }`.

| Relation     | Meaning                                               |
| ------------ | ----------------------------------------------------- |
| `depends_on` | This task requires the linked task to be done first   |
| `blocked_by` | Cannot start until the linked task is resolved        |
| `relates_to` | Loose association, no hard dependency                 |
| `supersedes` | This task replaces the linked task                    |
| `parent`     | This task is a sub-task of the linked task            |
| `child`      | This task contains the linked task as a sub-task      |

### Git commit format

```
<type>: <task_id> | <description>
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- All commits for the same task share the same `<task_id>`
- Examples:
  - `feat: 3f7a | Add dark mode toggle component`
  - `fix: 3f7a | Handle edge case in theme persistence`

### Workflow steps

1. **Before editing** — create a task file with description, criteria, and status `in_progress`
2. **Show the task** to the user before starting work
3. **While editing** — append commits to the task, update `files_changed` and `updated`
4. **After editing** — set status to `done` when all criteria are met, report task ID and commits

### Looking up tasks

Before creating a new task, check `tasks/` for existing relevant tasks.

## Development workflow for agents

Before editing:

1. Inspect the relevant files and existing implementation.
2. Search for existing patterns or utilities that solve the same problem.
3. Identify lifecycle, state, persistence, and browser-API implications.
4. Create a task file in `tasks/<id>.json` with description and criteria.
5. Make the smallest reasonable change.
6. Avoid unrelated refactors.
7. Run relevant tests.
8. Run `npm run build` for changes that can affect production compilation/bundling.
9. Review the diff for regressions, privacy issues, memory leaks, and unnecessary dependencies.
10. Update the task file with commits and final status.

After editing, report:

- task ID and name;
- what changed;
- which files changed;
- commits made (with hashes);
- tests/build commands run;
- any known limitations or remaining risks.

## Decision priority

When several implementations are possible, prioritize:

1. local execution;
2. privacy;
3. correctness and reliability;
4. simple architecture;
5. performance and memory efficiency;
6. UX;
7. minimal dependencies.

## Core product invariant

`privateAI` should remain a genuine local-first AI client: the browser is the execution environment, the model runs on the user's device, and user data stays local by default.
