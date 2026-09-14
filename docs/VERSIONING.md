# Versioning

privateAI uses [Semantic Versioning](https://semver.org/) in the form `MAJOR.MINOR.PATCH`.

## Source of truth

The application version is stored only in `package.json` under `version`. Vite injects this value into the frontend at build time, so the UI and build cannot drift from package metadata.

`package-lock.json` must contain the same root version. CI checks this with `npm run version:check`.

## When to bump

- **PATCH** — backwards-compatible bug fixes and small internal changes with no new user-facing capability.
- **MINOR** — backwards-compatible user-facing features.
- **MAJOR** — incompatible changes to the application behavior or public interfaces.

Until the first stable `1.0.0` release, `0.x.y` versions may evolve more freely, but the same SemVer rules should be followed whenever practical.

## Commands

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

These commands update `package.json` and `package-lock.json` without creating a Git commit or tag. The resulting files must be reviewed and committed as part of the task/PR history.

After changing the version, run:

```bash
npm run version:check
npm run test:run
npm run build
```

## Releases

A release should use the version from `package.json` as its Git tag, for example `v0.1.0`. Version bumps are intentional repository changes and should be traceable to a task and pull request.
