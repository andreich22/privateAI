---
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: read
  issues: read
  copilot-requests: write

network: defaults

engine: copilot

safe-outputs:
  add-comment:

---

# AI Pull Request Review

Review the pull request as an independent engineering reviewer for `privateAI`.

## Required context

1. Read `AGENTS.md`.
2. Read `skills/task-driven-development/SKILL.md`.
3. Read `skills/git-workflow/SKILL.md`.
4. Identify the Issue number (`Closes #N`) and Task ID referenced by the pull request title/body and branch name.
5. Read the full GitHub Issue, including requirements, Definition of Ready, acceptance criteria, technical approach, Definition of Done, and comments.
6. Inspect the complete pull request diff.

## Review criteria

Check:

- requirements and acceptance criteria from the Issue;
- Definition of Ready/Done and Issue traceability (`Closes #N`, Task ID);
- correctness and likely regressions;
- privacy-first and local-inference invariants;
- security concerns and untrusted-input handling;
- browser, memory, lifecycle, and streaming implications where relevant;
- test coverage and validation quality;
- scope creep or unrelated changes;
- commit/branch/PR workflow compliance.

## Output

Add one concise pull request comment containing:

- `AI REVIEW: PASS`, `AI REVIEW: REVIEW_NEEDED`, or `AI REVIEW: FAIL`;
- a short summary;
- concrete findings ordered by severity;
- missing tests or acceptance criteria, if any;
- residual risks.

Do not modify files, create commits, merge the pull request, approve the pull request, bypass protection, or change repository settings.

If evidence is insufficient, choose `REVIEW_NEEDED` rather than guessing.
