# Example: task relations

Store relationships in `tasks/relations.json`, not as duplicated reverse edges inside both tasks.

Example:

```json
{
  "version": 1,
  "allowedTypes": ["parent", "depends_on", "related", "duplicates", "derived_from", "replaces", "implements"],
  "relations": [
    { "from": "a1b2", "type": "depends_on", "to": "c3d4" },
    { "from": "e5f6", "type": "derived_from", "to": "a1b2" }
  ]
}
```

Interpretation:

- `a1b2 depends_on c3d4` means `a1b2` cannot be completed safely before `c3d4`.
- `e5f6 derived_from a1b2` means `e5f6` originated from the earlier task.
- A reverse view such as `c3d4 blocks a1b2` should be calculated, not stored separately.

Never create a self-link. Do not create cycles involving `depends_on` or `parent`.
