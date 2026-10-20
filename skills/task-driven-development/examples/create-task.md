# Example: create a task

Use this sequence when a request has no existing Issue.

1. Choose an unused four-character lowercase hexadecimal ID.
2. Create a GitHub Issue titled `TASK-<id> <title>`.
3. Fill in the Issue body using the Task template:
   - Goal;
   - Requirements;
   - Definition of Ready;
   - Acceptance Criteria;
   - Technical Approach;
   - Definition of Done.
4. Link related Issues (`Depends on #N`, `Blocks #N`, `Related to #N`) or add sub-issues.
5. Confirm the Definition of Ready is satisfied.
6. Create branch `task/<id>-<short-name>` from the current default branch.
7. Only then begin changing implementation files.

There are no task files to create or register. The Issue is the task.

Minimal Issue body example:

```markdown
## Goal

Show actionable guidance when a local model fails to load.

## Requirements

- Explain the likely cause.
- Offer a practical next step.

## Definition of Ready

- Failure states are identified.

## Acceptance Criteria

- [ ] User sees an actionable error message.

## Technical Approach

- Reuse the existing error state in the loading screen.

## Definition of Done

- [ ] Acceptance criteria pass.
- [ ] Tests and build pass.
- [ ] PR merged with `Closes #N`.
```
