# Task-Driven Development Skill

## Purpose

This is the canonical, agent-independent procedure for changing the `privateAI` repository.

It is designed to be usable by different AI agents and runtimes. It does not assume Cursor, Claude, Codex, Copilot, or any other specific product.

Repository contract:

- `AGENTS.md` contains mandatory project-wide constraints.
- `tasks/index.json` is the task registry.
- `tasks/<id>.json` is the source of truth for an individual task.
- `tasks/relations.json` is the source of truth for task relationships.
- `scripts/validate-tasks.mjs` enforces structural integrity.
- Git history records implementation changes.

If the current agent runtime supports repository skills, load this file before editing. If it does not, follow the same workflow from `AGENTS.md`; lack of automatic Skill loading never permits bypassing the task workflow.

## Non-negotiable rules

1. Do not modify project code, configuration, tests, or documentation without an associated Task ID.
2. If no suitable task exists, create the task before making the implementation change.
3. Task IDs are exactly four lowercase hexadecimal characters and must be unique.
4. Do not silently expand the scope of an existing task. Create another task and relate it instead.
5. Every commit must use `<type>: <task-id> | <description>`.
6. All commits belonging to one task use that task's ID.
7. Task relationships belong in `tasks/relations.json`; do not duplicate reverse edges in task files.
8. `depends_on` and `parent` relationships must not form cycles.
9. Before setting a task to `done`, run `npm run tasks:validate` and the relevant tests/build.
10. A task is not done merely because the code compiles: acceptance criteria, task history, commit metadata, and validation must be complete.

## Workflow

### 1. Understand the request

Determine the smallest concrete change requested by the user.

Inspect the repository before editing. Check existing implementation, tests, documentation, and related tasks. Do not guess about APIs or existing abstractions.

### 2. Find or create a task

Search `tasks/index.json` and the task files for an existing task that exactly covers the request.

If one exists:

- verify its status and scope;
- read its requirements and acceptance criteria;
- inspect its relations;
- continue only if the requested work belongs to that task.

If none exists, create a new task file `tasks/<id>.json` and register it in `tasks/index.json` before changing implementation files.

A task should contain at least:

- `id`
- `title`
- `status`
- `createdAt` / `updatedAt`
- `description`
- `requirements`
- `definitionOfReady`
- `acceptanceCriteria`
- `technicalApproach`
- `definitionOfDone`
- `history`
- `commits`

Record important implementation choices in `decisionLog`.

### 3. Check Definition of Ready

Before implementation, verify that the task has enough information to start safely:

- goal and scope are clear;
- requirements are explicit;
- acceptance criteria are testable;
- technical direction is understood;
- required dependencies and relations are known.

Move the task to `ready` only when its Definition of Ready is satisfied.

### 4. Inspect relationships

Read `tasks/relations.json` and identify relevant tasks.

Use the existing relation types:

- `parent` — structural parent;
- `depends_on` — implementation dependency;
- `related` — relevant but non-blocking relationship;
- `duplicates` — same intent as another task;
- `derived_from` — task originated from another task;
- `replaces` — task replaces another task;
- `implements` — task implements another task/specification.

Reverse views such as `blocks` or `child` should be derived rather than stored as duplicate edges.

Never create a self-relation. Never introduce a cycle through `parent` or `depends_on`.

### 5. Implement the smallest change

Change only what the task requires.

Preserve project invariants from `AGENTS.md`, especially local-first execution, privacy, browser-side inference, memory safety, streaming behavior, and minimal dependencies.

If implementation reveals unrelated work, stop expanding the current scope. Create a new task and add an appropriate relationship.

### 6. Validate continuously

Run the smallest relevant checks during development. Before completion, at minimum:

```bash
npm run tasks:validate
```

Also run relevant unit/component/e2e tests. Run:

```bash
npm run build
```

when the change can affect production compilation or bundling.

Do not claim a check passed unless it was actually run or verified through an authoritative CI result.

### 7. Commit with the task ID

Every implementation commit must follow:

```text
<type>: <task-id> | <description>
```

Examples:

```text
feat: a1b2 | add model download progress
fix: a1b2 | handle cancelled file access
refactor: a1b2 | isolate model lifecycle helper
test: a1b2 | cover permission restoration
```

Use the same Task ID for every commit belonging to the task.

### 8. Update task history

After meaningful implementation milestones, update the task's history and decision log.

Before completion, record:

- final status;
- relevant commit SHAs and messages;
- decisions that affect future maintenance;
- validation performed;
- any known limitations.

### 9. Complete the task

Set the task to `done` only after:

- all requirements are implemented;
- all acceptance criteria are satisfied;
- relevant tests/build pass;
- `npm run tasks:validate` passes;
- task history and commit metadata are complete;
- the final diff contains no accidental or unrelated changes.

## Scope management

The task is the unit of traceability.

If a change is useful but not necessary to satisfy the current acceptance criteria, do not bundle it casually. Create a separate task and relate it using `related`, `derived_from`, `parent`, or another appropriate relation.

A task may have multiple commits, but those commits must keep the same Task ID.

## Agent handoff

A future agent should be able to understand the work without relying on chat history.

Before handing off, ensure the repository contains enough information to answer:

1. What was requested?
2. Why was it requested?
3. What was implemented?
4. What decisions were made?
5. Which tasks are related?
6. Which commits implement it?
7. What remains unfinished?
8. Which validations were run?

The repository, not the transient conversation, is the durable project memory.
