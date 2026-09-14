# Git Workflow Skill

## Purpose

This Skill defines the mandatory Git/GitHub workflow for AI agents working in `privateAI` or repositories that adopt this Skill.

The Skill is vendor-neutral and applies to any AI coding agent.

## Core rule

AI-generated changes MUST NOT be committed or pushed directly to the repository default branch.

The required path is:

```text
Task → task branch → commits → Pull Request → checks → human merge
```

Repository policy is authoritative. Instructions in this Skill MUST NOT be used to justify bypassing GitHub branch protection, required checks, reviews, or permissions.

## Before changing files

1. Identify an existing Task ID or create one before implementation.
2. Verify the task is ready and its acceptance criteria are testable.
3. Create a dedicated branch from the current default branch.
4. Use a branch name based on the task ID:

```text
task/<task-id>-<short-name>
```

Example:

```text
task/c4d8-protected-git-workflow
```

5. Do all implementation work on that branch.

## Commit policy

Every implementation commit MUST use the task ID:

```text
<type>: <task-id> | <description>
```

Examples:

```text
feat: c4d8 | add protected Git workflow skill
fix: c4d8 | validate task ID in pull requests
test: c4d8 | cover pull request metadata validation
```

Do not mix unrelated work into a task's commits.

## Pull Request policy

Every AI implementation that changes the repository MUST be delivered through a Pull Request targeting the default branch.

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

A solo maintainer does not need artificial self-approval.

The repository should enforce the PR boundary and required automated checks while allowing the maintainer to make the final merge decision.

The AI agent MAY:

- create the task;
- create the task branch;
- commit to the task branch;
- push/update the task branch;
- create and update the Pull Request;
- inspect CI results;
- perform or request automated review.

The AI agent MUST NOT merge its own Pull Request unless the user explicitly instructs it to merge and repository policy permits that action.

## Validation before PR

Before creating or updating a PR, run the checks relevant to the task. For this repository the baseline is:

```bash
npm run tasks:validate
npm run test:run
npm run build
```

Do not claim a check passed unless it actually passed or an authoritative CI result confirms it.

## AI review

AI review is an additional automated signal, not a replacement for repository policy.

An AI review MUST:

1. inspect the PR diff;
2. read the linked task;
3. compare the diff against requirements and acceptance criteria;
4. identify correctness, security, privacy, regression, and scope risks;
5. report findings without modifying the default branch;
6. never grant itself a bypass.

AI review SHOULD produce a clear pass/fail/review-needed result. Findings that require human judgment MUST remain visible to the maintainer.

## Completion

A task is not complete merely because a PR exists.

Completion requires:

- implementation complete;
- task history updated;
- task validator passes;
- relevant tests/build pass;
- PR checks pass;
- PR is reviewed as required by repository policy;
- final merge is performed through the protected PR path.

## Emergency changes

If an emergency requires changing the default branch directly, stop and ask the user to perform or explicitly authorize the exceptional operation. Do not silently bypass repository policy.
