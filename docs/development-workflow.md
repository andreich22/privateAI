# AI development workflow

## Source of truth

GitHub Issues are the only source of truth for tasks. There is no task registry in the repository: no `tasks/` files, no task index, no relations file, and no registration workflow.

A task is a GitHub Issue titled:

```text
TASK-<4 lowercase hex-id> <title>
```

The Issue body must contain:

- Goal;
- Requirements;
- Definition of Ready;
- Acceptance Criteria;
- Technical Approach;
- Definition of Done.

Task IDs are exactly four lowercase hexadecimal characters and must be unique. Issue status is the task status: open means planned/in progress, closed means completed or cancelled. Use labels for additional classification when useful.

## Canonical agent Skill

The repository contains an agent-independent procedural Skill at [`skills/task-driven-development/SKILL.md`](../skills/task-driven-development/SKILL.md).

Agents that support repository Skills SHOULD load it before editing. It is intentionally vendor-neutral and does not depend on a particular AI runtime. If an agent cannot automatically load repository Skills, the rules below and `AGENTS.md` remain fully authoritative.

The Skill is a procedure layer, not a replacement for repository policy. The durable source of truth is the combination of GitHub Issues, Git history, and `AGENTS.md`.

## Rule 1 — every code change starts with an Issue

AI MUST NOT modify project code, configuration, tests, or documentation without an associated Task ID and its GitHub Issue.

For a new task, the first durable artifact is a GitHub Issue:

```text
TASK-a1b2 Short task title
```

Do not start implementation merely because the Issue exists. First verify that its Definition of Ready is satisfied.

## Rule 2 — no registration gate

There is no automatic registration PR and no file-based task metadata. The Issue itself is sufficient once:

- its title has a valid unique Task ID;
- its body contains all required sections;
- its Definition of Ready is satisfied.

Do not wait for a registration workflow. Do not create or update `tasks/` files.

## Rule 3 — create a task branch

Create the implementation branch from the current default branch:

```text
task/<task-id>-<short-name>
```

Never commit or push directly to `master`. All implementation work happens on the task branch.

## Rule 4 — commits are linked to tasks

Every commit related to a task MUST use:

```text
<type>: <task-id> | <description>
```

Examples:

```text
feat: 7c2a | add task issue template
fix: 7c2a | reject invalid task IDs
test: 7c2a | cover Issue-only workflow docs
docs: 7c2a | document AI workflow
```

When a task requires multiple commits, every commit MUST contain the same Task ID. Do not mix unrelated tasks in one commit.

## Rule 5 — task relationships live in GitHub

Use GitHub-native links instead of a repository registry:

- `Depends on #N` — this task cannot be completed correctly without #N;
- `Blocks #N` — this task blocks #N;
- `Related to #N` — contextual relationship;
- GitHub sub-issues — parent/child structure;
- issue references in comments and PR descriptions for context.

Do not maintain `tasks/relations.json` or duplicate relationship data anywhere in the repository.

## Rule 6 — pull requests

Every implementation PR MUST:

- target `master`;
- reference the Issue number and Task ID;
- use `Closes #N` so the merge closes the Issue automatically;
- explain the change and motivation;
- summarize requirements and acceptance criteria;
- list tests/checks that were run;
- identify known limitations and risks.

Recommended PR title:

```text
<type>: <task-id> | <short description>
```

## Rule 7 — no hidden scope expansion

If implementation reveals unrelated work, create a separate GitHub Issue and link it from the current Issue or PR. Do not silently expand the current task.

## Rule 8 — finish only after verification

An Issue may be closed only when:

1. all requirements are implemented;
2. acceptance criteria are satisfied;
3. relevant tests pass;
4. production build is run when applicable;
5. decisions, validation, and known limitations are recorded in the Issue and PR;
6. all related commits contain the Task ID;
7. the implementation PR is merged through the protected PR path.

Prefer `Closes #N` in the PR so the merge closes the Issue automatically. If the Issue is closed manually, verify the PR has been merged first.

## Protected branch policy

AI agents MUST NOT:

- commit directly to `master`;
- push directly to `master`;
- force-push `master`;
- rewrite `master` history;
- disable or bypass branch protection;
- merge their own PR without explicit user instruction and repository policy permission.

The human maintainer remains the final merge authority.

## Repository commands

```bash
npm run test:run
npm run build
npm run version:check
```

Run relevant E2E tests when the change affects critical user flows:

```bash
npm run test:e2e
```
