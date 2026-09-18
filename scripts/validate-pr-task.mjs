import fs from 'node:fs';

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath || !fs.existsSync(eventPath)) {
  console.error('GITHUB_EVENT_PATH is required.');
  process.exit(1);
}

const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const pr = event.pull_request;

if (!pr) {
  console.log('Not a pull_request event; nothing to validate.');
  process.exit(0);
}

const text = `${pr.title ?? ''}\n${pr.body ?? ''}`;
const matches = [...text.matchAll(/\b([0-9a-f]{4})\b/gi)].map((m) => m[1].toLowerCase());
const uniqueIds = [...new Set(matches)];

if (uniqueIds.length === 0) {
  console.error('PR must reference a Task ID (exactly four lowercase hexadecimal characters).');
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync('tasks/index.json', 'utf8'));
const knownIds = new Set(index.tasks.map((task) => task.id));
const knownMatches = uniqueIds.filter((id) => knownIds.has(id));

if (knownMatches.length === 0) {
  console.error(`PR references Task ID(s), but none exist in tasks/index.json: ${uniqueIds.join(', ')}`);
  process.exit(1);
}

const headBranch = pr.head?.ref ?? '';
const taskBranchPattern = /^task\/([0-9a-f]{4})-[a-z0-9][a-z0-9-]*$/;
const branchMatch = headBranch.match(taskBranchPattern);

if (!branchMatch) {
  // Keep compatibility with feature branches created before task-prefixed branch enforcement.
  // The PR must still reference a known Task ID in its title/body.
  console.warn(`PR branch is not task-prefixed; using referenced Task ID for compatibility: ${headBranch}`);
  console.log(`PR task validation passed via PR body: ${knownMatches[0]}`);
  process.exit(0);
}

const branchTaskId = branchMatch[1];
if (!knownIds.has(branchTaskId)) {
  console.error(`PR branch references unknown Task ID: ${branchTaskId}`);
  process.exit(1);
}

if (!knownMatches.includes(branchTaskId)) {
  console.error(`PR title/body must reference the branch Task ID: ${branchTaskId}`);
  process.exit(1);
}

console.log(`PR task validation passed: ${branchTaskId}`);
