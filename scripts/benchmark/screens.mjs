// The screens a run hands a child [D142]: the first page of the
// language as the tree printed it, saved under a name, so a run states
// which page it read and two runs compare two pages. `none` is the
// empty screen, a child with no page.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const benchDir = import.meta.dirname;
const screensDir = join(benchDir, 'screens');
const commandLine = join(benchDir, '..', '..', 'cli', 'src', 'bin.mjs');

// The first screen the tree prints, `::qlang | doc | content`.
export function firstScreen() {
  return execFileSync(process.execPath, [commandLine, '::qlang | doc | content'], { input: '', encoding: 'utf8' });
}

export function screenText(screenName) {
  if (screenName === 'none') return '';
  return readFileSync(join(screensDir, `${screenName}.txt`), 'utf8').trim();
}

export const shortHash = text => createHash('sha256').update(text).digest('hex').slice(0, 12);

export const screenHash = screenName => shortHash(screenText(screenName));

// saveScreen(name) — the first screen of the tree under a name.
export function saveScreen(screenName) {
  mkdirSync(screensDir, { recursive: true });
  const text = firstScreen();
  writeFileSync(join(screensDir, `${screenName}.txt`), text);
  console.log(`screen ${screenName}: ${shortHash(text.trim())}`);
}
