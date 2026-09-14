# Automated releases

Versioned releases are created automatically after a pull request is merged into `master`.

## Release flow

1. A Task defines the change.
2. The implementation PR changes `package.json` and `package-lock.json` with a SemVer bump.
3. CI validates the version and the rest of the project.
4. After the PR is merged, `.github/workflows/release.yml` compares the base commit version with the merge commit version.
5. If the version increased, the workflow creates tag `vX.Y.Z` and a GitHub Release targeting the merge commit.
6. If the version did not change, the workflow exits without creating a release.

## Safety rules

- Versions must be valid `MAJOR.MINOR.PATCH` SemVer.
- The merged version must be greater than the base version.
- The workflow never moves an existing tag to another commit.
- An existing release is treated as an idempotent success.
- The release workflow has only `contents: write` permission.

This makes the release lifecycle explicit: `Task → PR → version bump → merge → Release`.
