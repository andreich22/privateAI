---
name: task-workflow
description: Use ALWAYS when making any code changes. Enforces task-based workflow: create a task JSON before editing code, use task IDs in git commits, and update task status on completion. Triggers on any request that involves editing, creating, or modifying files.
---

# Task Workflow

Every code change MUST be tracked through a task. Follow this workflow exactly.

## 1. Before any code change — create or update a task

When the user asks you to make a change:

1. Generate a unique 4-character hex ID (random, lowercase, e.g. `3f7a`).
2. Create `tasks/<id>.json` with this structure:

```json
{
  "id": "<id>",
  "name": "<short title>",
  "description": "<what and why>",
  "status": "in_progress",
  "created": "<ISO 8601 now>",
  "updated": "<ISO 8601 now>",
  "criteria": {
    "definition_of_done": [
      "<concrete condition 1>",
      "<concrete condition 2>"
    ],
    "technical_requirements": [
      "<constraint or requirement>"
    ]
  },
  "commits": [],
  "files_changed": [],
  "links": [],
  "notes": ""
}
```

3. Show the task to the user before starting work.
4. Only proceed after the user confirms (or if the task is trivial and they already approved the change).

## 2. Git commit format

Every commit MUST reference the task ID:

```
<type>: <id> | <description>
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- All commits for the same task share the same `<id>`
- Examples:
  - `feat: 3f7a | Add dark mode toggle component`
  - `fix: 3f7a | Handle edge case in theme persistence`
  - `test: 3f7a | Add tests for ThemeToggle`

## 3. Update task as you work

- Append each commit to the `commits` array in the task JSON.
- Add modified files to `files_changed`.
- Update `updated` timestamp.
- Update `status` to `"done"` when all criteria are met.
- Update `notes` with rationale, trade-offs, or decisions.

## 4. Task lifecycle

| Status        | When                                          |
| ------------- | --------------------------------------------- |
| `planned`     | Task defined, work not started yet            |
| `in_progress` | Actively coding                               |
| `done`        | All definition_of_done criteria are met        |
| `cancelled`   | No longer needed or superseded                |

## 5. Looking up existing tasks

Before creating a new task, check if a relevant task already exists in `tasks/`. Read existing task files to understand context.

## 5a. Linking tasks

When creating a new task, consider whether it relates to existing tasks. Add links using the `links` array.

Link types:
- `depends_on` — this task needs the linked task done first
- `blocked_by` — cannot start until the linked task is resolved
- `relates_to` — loose association, no hard dependency
- `supersedes` — this task replaces the linked task
- `parent` — this task is a sub-task of the linked task
- `child` — this task contains the linked task as a sub-task

Rules:
- When a new task depends on an uncompleted task, add `{"task": "<id>", "relation": "depends_on"}` to both tasks (the dependent gets `depends_on`, the prerequisite gets a reciprocal `child` or just the dependent's link).
- When a task replaces an older one, add `{"task": "<old_id>", "relation": "supersedes"}`.
- Always check existing tasks before creating links to avoid duplicates.

## 6. Task file location

All tasks live in `tasks/<id>.json`. The schema is defined in `tasks/schema.json`.

## 7. Multiple commits per task

A single task can (and often should) have multiple commits. Each commit is appended to the `commits` array with its hash, message, and timestamp. The commit message always includes the task ID.

## 8. Final report

When a task is completed, report:
- Task ID and name
- Files changed
- Commits made (with hashes)
- Whether all criteria are met
- Any notes or caveats
