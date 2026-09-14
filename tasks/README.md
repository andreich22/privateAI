# Tasks

Every change to the codebase is tracked as a task. Each task has a unique 4-character hex ID (e.g. `1d4e`).

## Structure

```
tasks/
├── README.md        # this file
├── schema.json      # JSON schema for task files
├── 1d4e.json        # task example
└── ...
```

## Task file format

Each task is stored as `tasks/<id>.json`:

```json
{
  "id": "1d4e",
  "name": "Add dark mode toggle",
  "description": "Add a UI toggle for switching between light and dark themes. Persists preference in IndexedDB.",
  "status": "done",
  "created": "2026-09-14T12:00:00Z",
  "updated": "2026-09-14T13:30:00Z",
  "criteria": {
    "definition_of_done": [
      "Toggle renders in the header",
      "Theme switches immediately without re-render flicker",
      "Preference persists across page reloads via IndexedDB",
      "Respects system prefers-color-scheme as default"
    ],
    "technical_requirements": [
      "Use CSS custom properties for theme tokens",
      "Store preference in fileStorage.js IndexedDB layer",
      "No new dependencies"
    ]
  },
  "commits": [
    {
      "hash": "a1b2c3d",
      "message": "feat: 1d4e | Add theme toggle component",
      "timestamp": "2026-09-14T12:30:00Z"
    },
    {
      "hash": "e4f5g6h",
      "message": "feat: 1d4e | Persist theme preference in IndexedDB",
      "timestamp": "2026-09-14T13:15:00Z"
    }
  ],
  "files_changed": [
    "src/components/ThemeToggle.jsx",
    "src/services/fileStorage.js"
  ],
  "notes": "Decided against CSS-in-JS to keep bundle small. CSS custom properties approach aligns with existing pattern."
}
```

## Git commit format

All commits for a task share the same task ID:

```
<type>: <task_id> | <description>
```

Examples:
- `feat: 1d4e | Add theme toggle component`
- `fix: 1d4e | Handle missing IndexedDB entry`
- `refactor: 1d4e | Extract theme logic into hook`

## Status values

| Status        | Meaning                                      |
| ------------- | -------------------------------------------- |
| `planned`     | Task defined, work not started               |
| `in_progress` | Actively being worked on                     |
| `done`        | All criteria met, commits merged             |
| `cancelled`   | No longer needed, superseded, or rejected    |

## Task links

Tasks can reference each other via the `links` array. Each link has:

| Relation     | Meaning                                               |
| ------------ | ----------------------------------------------------- |
| `depends_on` | This task requires the linked task to be done first   |
| `blocked_by` | Cannot start until the linked task is resolved        |
| `relates_to` | Loose association, no hard dependency                 |
| `supersedes` | This task replaces the linked task (it becomes obsolete) |
| `parent`     | This task is part of the linked task (hierarchy)      |
| `child`      | This task is a sub-task of the linked task            |

### Example with links

```json
{
  "id": "b7c1",
  "name": "Refactor theme provider",
  "description": "Extract theme logic into a dedicated context provider",
  "status": "planned",
  "created": "2026-09-14T14:00:00Z",
  "updated": "2026-09-14T14:00:00Z",
  "criteria": {
    "definition_of_done": ["ThemeProvider wraps App", "No regressions in dark mode"],
    "technical_requirements": ["Use React.createContext", "No new dependencies"]
  },
  "commits": [],
  "files_changed": [],
  "links": [
    { "task": "1d4e", "relation": "depends_on", "note": "Need dark mode toggle first" },
    { "task": "a3f2", "relation": "relates_to" },
    { "task": "c9d0", "relation": "supersedes", "note": "Replaces old theme approach in c9d0" }
  ],
  "notes": ""
}
```

### Viewing task graphs

You can explore task relationships by reading the JSON files:

```bash
# list all tasks
ls tasks/*.json

# find all links involving a specific task
grep -l '"task": "1d4e"' tasks/*.json
```
