# Task-Driven Development Skill

## Purpose

This is the canonical, agent-independent procedure for changing the `privateAI` repository.

Repository contract:

- `AGENTS.md` contains mandatory project-wide constraints.
- `tasks/index.json` is the task registry.
- `tasks/<id>.json` is the source of truth for an individual task.
- `tasks/relations.json` is the source of truth for task relationships.
- `scripts/validate-tasks.mjs` enforces structural integrity.
- `scripts/register-task-from-issue.mjs` defines the deterministic Issue → task metadata transformation.
- `.github/workflows/register-task-issue.yml` automates registration from GitHub Issues.
- Git history records implementation changes.

## Non-negotiable rules

1. Do not modify project code, configuration, tests, or documentation without an associated Task ID.
2. New tasks MUST start as a GitHub Issue titled `TASK-<4 lowercase hex-id> <title>` (the registration script also accepts `TASK-<id>: <title>` and `TASK-<id>-<title>`).
3. The Issue registration workflow MUST register `tasks/<id>.json` and `tasks/index.json` before an AI agent creates the implementation PR.
4. If the registration PR is not merged into `master`, do not create the implementation branch or implementation PR.
5. Task IDs are exactly four lowercase hexadecimal characters and must be unique.
6. Do not silently expand the scope of an existing task. Create another task and relate it instead.
7. Every commit must use `<type>: <task-id> | <description>`.
8. All commits belonging to one task use the same ID.
9. Task relationships belong in `tasks/relations.json`; do not duplicate reverse edges in task files.
10. `depends_on` and `parent` relationships must not form cycles.
11. Before setting a task to `done`, run `npm run tasks:validate` and the relevant tests/build.
12. A task is not done merely because the code compiles: acceptance criteria, task history, commit metadata, and validation must be complete.

## Workflow

### 1. Understand the request

Determine the smallest concrete change requested by the user. Inspect the repository, tests, documentation, and related tasks before editing. Do not guess about APIs or existing abstractions.

### 2. Create the GitHub Task Issue

If no suitable task exists, create a GitHub Issue first. The Issue should contain the goal, requirements, Definition of Ready, acceptance criteria, technical approach, and Definition of Done.

Example title:

```text
TASK-a1b2 Short task title
```

Do not start implementation merely because the Issue exists.

### 3. Wait for automatic registration

The `Register task from Issue` workflow creates a registration PR containing:

- `tasks/<id>.json`;
- the corresponding entry in `tasks/index.json`.

The registration PR is deliberately separate from the implementation PR. It must pass normal repository checks and be merged before implementation starts. The workflow never pushes directly to `master`, so branch protection remains authoritative.

Registration is idempotent. Existing matching task metadata is not overwritten. A registry/task-file conflict fails loudly.

### 4. Verify registration and Definition of Ready

After registration is merged:

- confirm the Task ID exists in `tasks/index.json`;
- read `tasks/<id>.json`;
- verify the Definition of Ready;
- inspect `tasks/relations.json` and add required relationships.

Move the task to `ready` only when its Definition of Ready is satisfied.

### 5. Create implementation branch

Only after registration is present in `master`, create:

```text
task/<task-id>-<short-name>
```

Never create the implementation PR before registration is merged.

### 6. Implement the smallest change

Change only what the task requires. Preserve project invariants from `AGENTS.md`, especially local-first execution, privacy, browser-side inference, memory safety, streaming behavior, and minimal dependencies.

If implementation reveals unrelated work, create a new Issue and let the registration workflow create its task metadata before implementation begins.

### 7. Validate continuously

Before completion, at minimum:

```bash
npm run tasks:validate
```

Also run relevant unit/component/e2e tests and `npm run build` when production compilation can be affected. Do not claim a check passed unless it actually passed or an authoritative CI result confirms it.

### 8. Commit with the task ID

Every implementation commit must follow:

```text
<type>: <task-id> | <description>
```

Use the same Task ID for every commit belonging to the task.

### 9. Update task history

Before completion, record final status, relevant commit SHAs/messages, decisions, validation, and known limitations.

### 10. Complete the task

Set the task to `done` only after all requirements and acceptance criteria are satisfied, relevant tests/build pass, `npm run tasks:validate` passes, history/commit metadata are complete, and the implementation PR has passed repository checks and is merged through the protected PR path.

## Scope management

The task is the unit of traceability. If a change is useful but not necessary to satisfy current acceptance criteria, create a separate Issue/task and relate it using `related`, `derived_from`, `parent`, or another appropriate relation.

## Agent handoff

The repository should contain enough information to understand what was requested, why, what was implemented, which decisions were made, which tasks are related, which commits implement it, what remains, and which validations were run. The repository, not transient chat history, is the durable project memory.
