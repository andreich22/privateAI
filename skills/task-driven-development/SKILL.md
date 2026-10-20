# Task-Driven Development Skill

## Purpose

This is the canonical, agent-independent procedure for changing the `privateAI` repository.

Repository contract:

- `AGENTS.md` contains mandatory project-wide constraints.
- GitHub Issues are the single source of truth for tasks, requirements, acceptance criteria, status, and relationships.
- Git history records implementation changes.
- `docs/development-workflow.md` describes the same workflow in repository policy form.

There is no task registry in the repository. Do not create or maintain `tasks/` files.

## Non-negotiable rules

1. Do not modify project code, configuration, tests, or documentation without an associated GitHub Issue.
2. Every task MUST be a GitHub Issue titled `TASK-<4 lowercase hex-id> <title>`.
3. The Issue body MUST contain Goal, Requirements, Definition of Ready, Acceptance Criteria, Technical Approach, and Definition of Done.
4. Task IDs are exactly four lowercase hexadecimal characters and must be unique.
5. Implementation may start only when the Definition of Ready is satisfied. There is no registration PR or file-based registration gate.
6. Do not silently expand the scope of an existing task. Create another Issue and link it.
7. Every commit must use `<type>: <task-id> | <description>`.
8. All commits belonging to one task use the same ID.
9. Task relationships live in GitHub Issues (`Depends on #N`, `Blocks #N`, `Related to #N`, sub-issues). Do not create a separate relationship registry.
10. The implementation PR MUST use `Closes #N` so the merge closes the Issue.
11. A task is not done merely because code compiles: acceptance criteria, validation, PR merge, and Issue closure must be complete.

## Workflow

### 1. Understand the request

Determine the smallest concrete change requested by the user. Inspect the repository, tests, documentation, and related Issues before editing. Do not guess about APIs or existing abstractions.

### 2. Create or locate the GitHub Task Issue

If no suitable Issue exists, create one with a title such as:

```text
TASK-a1b2 Short task title
```

The Issue body is the task. Include:

- Goal;
- Requirements;
- Definition of Ready;
- Acceptance Criteria;
- Technical Approach;
- Definition of Done.

Do not start implementation merely because the Issue exists.

### 3. Verify the Definition of Ready

Read the Issue and confirm that all preconditions are satisfied. If the Issue is incomplete or contradictory, update it before starting.

There is no automatic registration step. Do not create task JSON files and do not wait for a registration PR.

### 4. Create the implementation branch

Create a branch from the current default branch:

```text
task/<task-id>-<short-name>
```

Never commit or push directly to `master`.

### 5. Implement the smallest change

Change only what the Issue requires. Preserve project invariants from `AGENTS.md`, especially local-first execution, privacy, browser-side inference, memory safety, streaming behavior, and minimal dependencies.

If implementation reveals unrelated work, create a new Issue and link it from the current Issue or PR.

### 6. Validate continuously

Before completion, at minimum:

```bash
npm run test:run
npm run build
npm run version:check
```

Run relevant E2E tests when the change affects critical user flows:

```bash
npm run test:e2e
```

Do not claim a check passed unless it actually passed or an authoritative CI result confirms it.

### 7. Commit with the task ID

Every implementation commit must follow:

```text
<type>: <task-id> | <description>
```

Use the same Task ID for every commit belonging to the task.

### 8. Open the implementation PR

The PR must:

- target `master`;
- reference the Issue number and Task ID;
- use `Closes #N`;
- summarize requirements and acceptance criteria;
- list validation performed;
- identify known limitations and risks.

### 9. Record decisions in the Issue

Use Issue comments for durable decisions, validation results, and known limitations. The PR description is also part of the durable history. Do not maintain a separate task history file.

### 10. Complete through merge

The task is complete when:

- all requirements and acceptance criteria are satisfied;
- relevant tests/build pass;
- the implementation PR passes repository checks and is merged through the protected PR path;
- the Issue is closed, preferably automatically by `Closes #N`.

Do not create a separate "mark as done" PR.

## Scope management

The Issue is the unit of traceability. If a change is useful but not necessary to satisfy current acceptance criteria, create a separate Issue and link it using `Related to #N`, `Depends on #N`, `Blocks #N`, or a sub-issue relationship.

## Agent handoff

GitHub Issues, PR descriptions, and Git history should contain enough information to understand what was requested, why, what was implemented, which decisions were made, which tasks are related, which commits implement the task, what remains, and which validations were run. The repository and its Issues, not transient chat history, are the durable project memory.
