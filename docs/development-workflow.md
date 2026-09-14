# AI development workflow

## Canonical agent Skill

The repository contains an agent-independent procedural Skill at [`skills/task-driven-development/SKILL.md`](../skills/task-driven-development/SKILL.md).

Agents that support repository Skills SHOULD load it before editing. It is intentionally vendor-neutral and does not depend on a particular AI runtime. If an agent cannot automatically load repository Skills, the rules below and `AGENTS.md` remain fully authoritative.

The Skill is a procedure layer, not a replacement for repository policy. The durable source of truth is the combination of task JSON, relations, validator, Git history, and `AGENTS.md`.

## Rule 1 — every code change starts with an Issue

AI MUST NOT modify project code, configuration, tests, or documentation without an associated Task ID.

For a new task, the first durable artifact is a GitHub Issue with a title such as:

```text
TASK-a1b2 Short task title
```

The Issue should contain the goal, requirements, Definition of Ready, acceptance criteria, technical approach, and Definition of Done.

## Rule 2 — Issue registration is a hard gate

Creating the Issue is not enough to start implementation.

The `Register task from Issue` GitHub Actions workflow automatically transforms a valid Task Issue into:

- `tasks/<id>.json`;
- an entry in `tasks/index.json`;
- a registration Pull Request targeting `master`.

The registration PR is intentionally separate from the implementation PR. **The registration PR MUST be merged before the AI agent creates the implementation branch or implementation PR.** This keeps the implementation PR's Task ID resolvable from the default branch and prevents the CI failure caused by an unregistered Task ID.

The workflow is idempotent. Existing matching task metadata is not overwritten. Conflicts between the registry and task file fail loudly instead of being resolved silently.

The workflow does not push directly to `master`; normal branch protection remains authoritative.

## Rule 3 — a task must be ready before implementation

After registration is merged, the task must contain:

- `id`
- `title`
- `description`
- `requirements`
- `definitionOfReady`
- `acceptanceCriteria`
- `technicalApproach`
- `definitionOfDone`

AI may start implementation only when the Definition of Ready is satisfied.

## Rule 4 — commits are linked to tasks

Every commit related to a task MUST use:

```text
<type>: <task-id> | <description>
```

Examples:

```text
feat: 7c2a | add task registry
fix: 7c2a | reject circular dependencies
test: 7c2a | validate task metadata
docs: 7c2a | document AI workflow
```

When a task requires multiple commits, every commit MUST contain the same Task ID. Do not mix unrelated tasks in one commit.

## Rule 5 — task relationships

Relationships are stored in `tasks/relations.json` so each edge exists only once.

Supported relation types:

- `parent` — `from` is a child of `to`.
- `depends_on` — `from` cannot be completed correctly without `to`.
- `related` — contextual relationship without dependency.
- `duplicates` — `from` duplicates `to`.
- `derived_from` — `from` was created from `to`.
- `replaces` — `from` replaces `to`.
- `implements` — `from` implements a requirement or part of `to`.

Reverse views such as `blocks` or `child` are derived from the stored direction and are not stored as duplicate edges.

AI MUST create a relation when a new task is caused by, depends on, replaces, duplicates, or otherwise materially relates to an existing task.

## Rule 6 — no hidden scope expansion

If implementation reveals an unrelated change, AI creates a separate Issue and lets the registration workflow create its task metadata before implementation begins.

## Rule 7 — finish only after verification

A task may be marked `done` only after:

1. all requirements are implemented;
2. acceptance criteria are satisfied;
3. relevant tests pass;
4. production build is run when applicable;
5. task history is updated;
6. all related commits contain the Task ID;
7. `npm run tasks:validate` passes.

## Rule 8 — dependencies must be acyclic

`depends_on` and `parent` relations form a dependency graph. Circular dependencies are invalid and must be rejected by the validator.

## Repository commands

```bash
npm run tasks:validate
npm run test:run
npm run build
```

The task system is deliberately dependency-free and stored in Git so the repository itself remains the source of truth for why changes were made.
