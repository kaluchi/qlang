#!/usr/bin/env node
// The coverage of the sources of the core by its requirements alone, the
// cases of the conformance suite and the laws of the catalog, run by the test
// files of their two sections, `QSWRK/cases` and `QSSLF/laws`, under the
// coverage of vitest with no threshold: the share of
// each axis they reach, and by module the lines of code they reach not,
// which a test of another suite holds or nothing does [QSWRK#tooling].
//
//   node scripts/sensors/requirements-coverage.mjs [lines of the modules shown]

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const core = fileURLToPath(new URL('../../core', import.meta.url));
const vitest = fileURLToPath(new URL('../../node_modules/vitest/vitest.mjs', import.meta.url));
const shown = Number(process.argv[2] ?? 12);
const RUNNERS = ['test/unit/QSWRK/cases.test.mjs', 'test/unit/QSSLF/laws.test.mjs'];

const report = mkdtempSync(join(tmpdir(), 'requirements-coverage-'));
const run = spawnSync(process.execPath, [vitest, 'run', '--coverage', '--coverage.reporter=json-summary', '--coverage.reporter=json',
  `--coverage.reportsDirectory=${report}`, ...['lines', 'functions', 'branches', 'statements'].map(axis => `--coverage.thresholds.${axis}=0`), ...RUNNERS],
{ cwd: core, encoding: 'utf8', maxBuffer: 1 << 28 });
if (run.status !== 0) {
  process.stderr.write(run.stdout + run.stderr);
  process.exit(run.status ?? 1);
}
const { total } = JSON.parse(readFileSync(join(report, 'coverage-summary.json'), 'utf8'));
const final = JSON.parse(readFileSync(join(report, 'coverage-final.json'), 'utf8'));
rmSync(report, { recursive: true, force: true });

console.log(['lines', 'branches', 'functions', 'statements'].map(axis => `${axis} ${total[axis].pct.toFixed(1)}%`).join(' · '));
// The lines of a module no statement the requirements ran stands on.
const unreached = Object.entries(final).map(([path, { s, statementMap }]) => {
  const lines = new Set();
  for (const [id, count] of Object.entries(s)) if (count === 0) lines.add(statementMap[id].start.line);
  return [path.replace(/\\/g, '/').replace(/^.*\/core\/src\//, ''), lines.size];
}).filter(([, count]) => count > 0).sort((left, right) => right[1] - left[1]);
console.log(`lines no requirement reaches ${unreached.reduce((sum, [, count]) => sum + count, 0)}, in ${unreached.length} modules: ${unreached.slice(0, shown).map(([module, count]) => `${module} ${count}`).join(', ')}`);
