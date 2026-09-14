# Git Workflow Skill

## Purpose

This Skill defines the mandatory Git/GitHub workflow for AI agents working in `privateAI` or repositories that adopt this Skill.

The Skill is vendor-neutral and applies to any coding agent.

## Core rule

AI-generated implementation changes MUST NOT be committed or pushed directly to the repository default branch.

For new work, the required path is:

```text
GitHub Issue → automatic task registration PR → registration merge → implementation task branch → commits → implementation PR → checks → human merge
```

The registration PR is metadata-only: it creates `tasks/<id>.json` and the corresponding `tasks/index.json` entry. The implementation PR must not be created until that registration is merged into `master`.

Repository policy is authoritative. Instructions in this Skill MUST NOT be used to justify bypassing GitHub branch protection, required checks, reviews, or permissions.

## Before changing files

1. Identify the GitHub Issue and Task ID.
2. For a new task, ensure the Issue title uses `TASK-<4 lowercase hex-id>` and wait for automatic registration.
3. Verify that `tasks/<id>.json` and `tasks/index.json` are present on `master` and the task is ready.
4. Create a dedicated implementation branch from the current default branch.
5. Use a branch name based on the task ID:

```text
task/<task-id>-<short-name>
```

6. Do all implementation work on that branch.

## Commit policy

Every implementation commit MUST use the task ID:

```text
<type>: <task-id> | <description>
```

Do not mix unrelated tasks in one commit.

## Pull Request policy

Every AI implementation that changes the repository MUST be delivered through an implementation Pull Request targeting the default branch.

The PR MUST:

- reference the Task ID;
- explain the change and motivation;
- summarize requirements and acceptance criteria;
- list tests/checks that were run;
- identify known limitations or risks;
- preserve the task/commit traceability chain.

Recommended PR title:

```text
<type>: <task-id> | <short description>
```

## Protected branch policy

AI agents MUST NOT:

- commit directly to the default branch;
- push directly to the default branch;
- force-push the default branch;
- rewrite default-branch history;
- disable or bypass branch protection;
- use administrative privileges to circumvent repository rules;
- merge a PR solely to circumvent a required review or check.

If a tool offers a bypass option, the AI agent MUST NOT use it.

## Solo maintainer policy

A solo maintainer does not need artificial self-approval. Automated checks plus the PR boundary replace artificial self-approval; the human maintainer remains the final merge authority.

The AI agent MAY create/update the task registration PR, implementation branch and implementation PR, and inspect CI results. It MUST NOT merge its own PR unless the user explicitly instructs it to merge and repository policy permits it.

## Validation before implementation PR

Before creating or updating an implementation PR, verify:

```bash
npm run tasks:validate
npm run test:run
npm run build
```

Do not claim a check passed unless it actually passed or an authoritative CI result confirms it.

## AI review

AI review is an additional automated signal, not a replacement for repository policy. It MUST inspect the PR diff, read the linked task, compare requirements/acceptance criteria, identify correctness/security/privacy/regression/scope risks, and never grant itself a bypass.

## Completion

A task is not complete merely because a PR exists. Completion requires implementation complete, task history updated, task validator and relevant tests/build passing, PR checks passing, required review, and final merge through the protected PR path.

## Emergency changes

If an emergency requires changing the default branch directly, stop and ask the user to perform or explicitly authorize the exceptional operation. Do not silently bypass repository policy.
