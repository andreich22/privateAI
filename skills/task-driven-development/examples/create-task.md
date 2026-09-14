# Example: create a task

Use this sequence when a request has no existing task.

1. Choose an unused four-character lowercase hexadecimal ID.
2. Create `tasks/<id>.json` with the required fields.
3. Register the task in `tasks/index.json`.
4. Define scope, requirements, Definition of Ready, acceptance criteria, technical approach, and Definition of Done.
5. Set status to `ready` only after the Definition of Ready is satisfied.
6. Add task relationships in `tasks/relations.json` when another task is relevant.
7. Only then begin changing implementation files.

Minimal example:

```json
{
  "id": "a1b2",
  "title": "Improve model loading error UX",
  "status": "ready",
  "description": "Show actionable guidance when a local model fails to load.",
  "requirements": ["Explain the likely cause", "Offer a practical next step"],
  "definitionOfReady": ["Failure states are identified"],
  "acceptanceCriteria": ["User sees an actionable error message"],
  "technicalApproach": ["Reuse the existing error state in the loading screen"],
  "definitionOfDone": ["Acceptance criteria pass", "Tests pass", "Task validator passes"],
  "history": [],
  "commits": [],
  "relations": []
}
```
