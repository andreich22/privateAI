#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const [currentPath, baselinePath] = process.argv.slice(2);

if (!currentPath) {
  console.error('Usage: node scripts/check-coverage.mjs <current-summary.json> [baseline-summary.json]');
  process.exit(2);
}

const loadSummary = async (path) => {
  const data = JSON.parse(await readFile(path, 'utf8'));
  return data.total ?? data;
};

const current = await loadSummary(currentPath);
const metrics = ['lines', 'statements', 'functions', 'branches'];

console.log('Test coverage:');
for (const metric of metrics) {
  const value = current[metric]?.pct;
  console.log(`  ${metric.padEnd(10)} ${value}%`);
}

if (!baselinePath) {
  console.log('Coverage regression check: skipped (no baseline provided).');
  process.exit(0);
}

const baseline = await loadSummary(baselinePath);
let failed = false;

console.log('\nCoverage regression check against master:');
for (const metric of metrics) {
  const currentPct = Number(current[metric]?.pct);
  const baselinePct = Number(baseline[metric]?.pct);

  if (!Number.isFinite(currentPct) || !Number.isFinite(baselinePct)) {
    console.error(`  ${metric}: unable to compare coverage`);
    failed = true;
    continue;
  }

  const delta = currentPct - baselinePct;
  const sign = delta > 0 ? '+' : '';
  console.log(
    `  ${metric.padEnd(10)} ${currentPct.toFixed(2)}% vs ${baselinePct.toFixed(2)}% (${sign}${delta.toFixed(2)} pp)`,
  );

  if (currentPct + Number.EPSILON < baselinePct) {
    failed = true;
  }
}

if (failed) {
  console.error('\nCoverage must not decrease compared with master.');
  process.exit(1);
}

console.log('\nCoverage did not decrease compared with master.');
