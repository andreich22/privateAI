# Example: complete a task

Before marking a task `done`:

1. Confirm every acceptance criterion.
2. Run `npm run tasks:validate`.
3. Run relevant tests.
4. Run `npm run build` when the change affects production compilation/bundling.
5. Record meaningful decisions in `decisionLog`.
6. Record every implementation commit SHA and exact commit message in `commits`.
7. Add or update task history with the final status.
8. Review the diff for unrelated changes, regressions, privacy issues, and unnecessary dependencies.
9. Set `status` to `done` only after all Definition of Done items are satisfied.

Example commit sequence for one task:

```text
feat: a1b2 | implement loading error state
 test: a1b2 | cover loading failure message
```

Both commits belong to `a1b2`. The task history should retain both commit SHAs.
