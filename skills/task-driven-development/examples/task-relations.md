# Example: task relations

Store relationships in GitHub Issues, not in a repository registry.

Use references in the Issue body or comments:

```markdown
Depends on #123
Blocks #124
Related to #125
```

Or use GitHub sub-issues for parent/child structure.

Interpretation:

- `Depends on #123` — this task cannot be completed safely before #123.
- `Blocks #124` — #124 cannot proceed until this task is done.
- `Related to #125` — contextual relationship without a hard dependency.

Do not create a separate relations file, duplicate reverse edges, or store relationship data in the repository.
