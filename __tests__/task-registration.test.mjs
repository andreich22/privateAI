import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const script = path.resolve('scripts/register-task-from-issue.mjs');

const createFixture = ({ title = 'TASK-a1b2 Example task', body = '' } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'privateai-task-registration-'));
  fs.mkdirSync(path.join(root, 'tasks'));
  fs.writeFileSync(path.join(root, 'tasks/index.json'), JSON.stringify({ version: 1, tasks: [] }, null, 2));
  const eventPath = path.join(root, 'event.json');
  fs.writeFileSync(eventPath, JSON.stringify({ issue: { number: 123, title, body, html_url: 'https://github.com/example/repo/issues/123' } }));
  return { root, eventPath };
};

const run = ({ root, eventPath }) => execFileSync(process.execPath, [script], {
  cwd: root,
  env: { ...process.env, GITHUB_EVENT_PATH: eventPath },
  encoding: 'utf8'
});

describe('register-task-from-issue', () => {
  it('registers a valid Task Issue and is idempotent', () => {
    const fixture = createFixture({
      body: '# Goal\nDo the thing.\n\n## Requirements\n- Keep it deterministic.\n\n## Acceptance Criteria\n- [ ] It works.\n\n## Definition of Done\n- Tests pass.'
    });

    run(fixture);
    const index = JSON.parse(fs.readFileSync(path.join(fixture.root, 'tasks/index.json'), 'utf8'));
    const task = JSON.parse(fs.readFileSync(path.join(fixture.root, 'tasks/a1b2.json'), 'utf8'));
    expect(index.tasks).toEqual([{ id: 'a1b2', title: 'Example task', status: 'draft' }]);
    expect(task.id).toBe('a1b2');
    expect(task.issue.number).toBe(123);
    expect(task.requirements).toContain('Keep it deterministic.');
    expect(task.acceptanceCriteria).toContain('It works.');

    const before = fs.readFileSync(path.join(fixture.root, 'tasks/a1b2.json'), 'utf8');
    run(fixture);
    const after = fs.readFileSync(path.join(fixture.root, 'tasks/a1b2.json'), 'utf8');
    expect(after).toBe(before);
  });

  it('accepts the pipe separator used by Task Issue titles', () => {
    const fixture = createFixture({ title: 'TASK-a1b2 | Pipe task title' });
    run(fixture);

    const index = JSON.parse(fs.readFileSync(path.join(fixture.root, 'tasks/index.json'), 'utf8'));
    const task = JSON.parse(fs.readFileSync(path.join(fixture.root, 'tasks/a1b2.json'), 'utf8'));
    expect(index.tasks).toEqual([{ id: 'a1b2', title: 'Pipe task title', status: 'draft' }]);
    expect(task.title).toBe('Pipe task title');
  });

  it('rejects a conflicting task file instead of overwriting it', () => {
    const fixture = createFixture({ title: 'TASK-a1b2 Another task' });
    fs.writeFileSync(path.join(fixture.root, 'tasks/a1b2.json'), JSON.stringify({ id: 'a1b2', title: 'Existing task' }));

    expect(() => run(fixture)).toThrow();
  });

  it('rejects an already registered task when index and task file disagree', () => {
    const fixture = createFixture({ title: 'TASK-a1b2 Example task' });
    fs.writeFileSync(path.join(fixture.root, 'tasks/index.json'), JSON.stringify({
      version: 1,
      tasks: [{ id: 'a1b2', title: 'Example task', status: 'draft' }]
    }, null, 2));
    fs.writeFileSync(path.join(fixture.root, 'tasks/a1b2.json'), JSON.stringify({
      id: 'a1b2',
      title: 'Example task',
      status: 'in_progress'
    }, null, 2));

    expect(() => run(fixture)).toThrow(/status mismatch/);
  });

  it('rejects an already registered task when index and task title disagree', () => {
    const fixture = createFixture({ title: 'TASK-a1b2 Example task' });
    fs.writeFileSync(path.join(fixture.root, 'tasks/index.json'), JSON.stringify({
      version: 1,
      tasks: [{ id: 'a1b2', title: 'Example task', status: 'draft' }]
    }, null, 2));
    fs.writeFileSync(path.join(fixture.root, 'tasks/a1b2.json'), JSON.stringify({
      id: 'a1b2',
      title: 'Different task',
      status: 'draft'
    }, null, 2));

    expect(() => run(fixture)).toThrow(/title mismatch/);
  });

  it('keeps index and task file synchronized after registration', () => {
    const fixture = createFixture({ title: 'TASK-c3d4 Synchronized task' });
    run(fixture);

    const index = JSON.parse(fs.readFileSync(path.join(fixture.root, 'tasks/index.json'), 'utf8'));
    const task = JSON.parse(fs.readFileSync(path.join(fixture.root, 'tasks/c3d4.json'), 'utf8'));
    expect(index.tasks).toContainEqual({ id: task.id, title: task.title, status: task.status });
  });

  it('ignores an issue without a valid Task ID', () => {
    const fixture = createFixture({ title: 'Feature request without task id' });
    run(fixture);
    const index = JSON.parse(fs.readFileSync(path.join(fixture.root, 'tasks/index.json'), 'utf8'));
    expect(index.tasks).toEqual([]);
  });
});
