import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lockJson = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));

const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const version = packageJson.version;

if (!semver.test(version)) {
  console.error(`Invalid application version: ${version}`);
  process.exit(1);
}

if (lockJson.version !== version || lockJson.packages?.['']?.version !== version) {
  console.error(`package-lock.json version does not match package.json (${version}).`);
  process.exit(1);
}

console.log(`Application version: ${version}`);
