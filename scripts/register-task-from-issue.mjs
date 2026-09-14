#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tasksDir = path.join(root, 'tasks');
const indexPath = path.join(tasksDir, 'index.json');
const eventPath = process.env.GITHUB_EVENT_PATH;

const writeOutput = (key, value) => {
  const output = process.env.GITHUB_OUTPUT;
  if (output) fs.appendFileSync(output, `${key}=${String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}\n`);
};

const fail = (message) => {
  console.error(`Task registration failed: ${message}`);
  writeOutput('status', 'error');
  process.exitCode = 1;
};

if (!eventPath || !fs.existsSync(eventPath)) fail('GITHUB_EVENT_PATH is missing');
if (process.exitCode) process.exit();

const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const issue = event.issue;
const title = issue?.title ?? '';
const body = issue?.body ?? '';

const match = title.match(/^TASK-([0-9a-f]{4})(?:\s+|:\s*|-\s*)(.+)$/);
if (!match) {
  console.log(`Ignoring issue title: ${title}`);
  writeOutput('status', 'invalid');
  process.exit(0);
}

const [, id, taskTitle] = match;
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const entries = Array.isArray(index.tasks) ? index.tasks : [];
const existingEntry = entries.find((entry) => entry?.id === id);
const taskPath = path.join(tasksDir, `${id}.json`);
const taskExists = fs.existsSync(taskPath);

if (existingEntry && !taskExists) fail(`registry entry ${id} exists but ${taskPath} is missing`);
if (taskExists && !existingEntry) fail(`task file ${taskPath} exists but registry entry ${id} is missing`);
if (existingEntry && taskExists) {
  console.log(`Task ${id} is already registered; no changes needed.`);
  writeOutput('status', 'already-registered');
  writeOutput('task_id', id);
  writeOutput('task_title', taskTitle.trim());
  process.exit(0);
}

const now = new Date().toISOString();
const task = {
  id,
  title: taskTitle.trim(),
  status: 'draft',
  createdAt: now,
  updatedAt: now,
  issue: {
    number: issue.number,
    url: issue.html_url ?? null,
    title
  },
  description: body.trim() || `Task created from GitHub Issue #${issue.number}.`,
  requirements: extractSection(body, 'Требования', 'Requirements'),
  definitionOfReady: extractSection(body, 'Definition of Ready'),
  acceptanceCriteria: extractCheckboxes(body, 'Acceptance Criteria'),
  technicalApproach: [],
  definitionOfDone: extractSection(body, 'Definition of Done'),
  history: [
    {
      at: now,
      event: 'created_from_issue',
      details: `Automatically registered from GitHub Issue #${issue.number}.`
    }
  ],
  commits: [],
  decisionLog: [],
  relations: []
};

for (const [name, value] of Object.entries({
  requirements: task.requirements,
  definitionOfReady: task.definitionOfReady,
  acceptanceCriteria: task.acceptanceCriteria,
  definitionOfDone: task.definitionOfDone
})) {
  if (value.length === 0) task[name] = [`See GitHub Issue #${issue.number} for the ${name} definition.`];
}

fs.writeFileSync(taskPath, `${JSON.stringify(task, null, 2)}\n`);
entries.push({ id, title: task.title, status: task.status });
index.tasks = entries;
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);

console.log(`Registered task ${id} from Issue #${issue.number}.`);
writeOutput('status', 'registered');
writeOutput('task_id', id);
writeOutput('task_title', task.title);

function extractSection(markdown, ...names) {
  const heading = names.map(escapeRegExp).join('|');
  const match = markdown.match(new RegExp(`^##\\s+(?:${heading})\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, 'im')); 
  if (!match) return [];
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);
}

function extractCheckboxes(markdown, section) {
  const items = extractSection(markdown, section);
  return items.map((item) => item.replace(/^\[[ xX]\]\s*/, '')).filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}
