# Example: complete a task

Before closing the Issue:

1. Confirm every acceptance criterion in the Issue.
2. Run relevant tests.
3. Run `npm run build` when the change affects production compilation/bundling.
4. Run `npm run version:check`.
5. Record meaningful decisions, validation, and known limitations as Issue comments and in the PR description.
6. Review the diff for unrelated changes, regressions, privacy issues, and unnecessary dependencies.
7. Open the implementation PR with `Closes #N` and the Task ID.
8. Merge through the protected PR path after checks pass.
9. Verify that the merge closed the Issue.

There is no separate status update, task file, or `done` PR.

Example commit sequence for one task:

```text
feat: a1b2 | implement loading error state
test: a1b2 | cover loading failure message
```

Both commits belong to `a1b2`; the Issue and PR retain the traceability.
