// The screens a run hands a child: the pages of the language and the
// command line as the tree printed them [D26], saved under a name,
// so a run states which pages it read and two runs compare two screens.
// `none` is the empty screen, a child with no page.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pipeEnv } from '../pipe-env.mjs';

const benchDir = import.meta.dirname;
const screensDir = join(benchDir, 'screens');
const commandLine = join(benchDir, '..', '..', 'cli', 'src', 'bin.mjs');

// The first screen the tree prints, the pages of the language and the
// command line, or what another query prints, a screen a run tries
// against it.
export function firstScreen(query = '[::qlang ::cli] | map ~([/ doc])') {
  return execFileSync(process.execPath, [commandLine, query], { input: '', encoding: 'utf8', env: pipeEnv });
}

export function screenText(screenName) {
  if (screenName === 'none') return '';
  return readFileSync(join(screensDir, `${screenName}.txt`), 'utf8').trim();
}

export const shortHash = text => createHash('sha256').update(text).digest('hex').slice(0, 12);

export const screenHash = screenName => shortHash(screenText(screenName));

// fixScreen(decision) → the first screen the tree prints, saved under the
// number of the decision a run measures, or under the number and its hash
// when an earlier measurement of the number read another page [D26].
export function fixScreen(decision) {
  mkdirSync(screensDir, { recursive: true });
  const text = firstScreen().trim();
  const hash = shortHash(text);
  const plain = join(screensDir, `${decision}.txt`);
  const name = existsSync(plain) && readFileSync(plain, 'utf8').trim() !== text ? `${decision}.${hash}` : decision;
  writeFileSync(join(screensDir, `${name}.txt`), `${text}\n`);
  return { name, hash };
}

// saveScreen(name, query) — the first screen of the tree, or what the
// query prints, under a name.
export function saveScreen(screenName, query) {
  mkdirSync(screensDir, { recursive: true });
  const text = firstScreen(query);
  writeFileSync(join(screensDir, `${screenName}.txt`), text);
  console.log(`screen ${screenName}: ${shortHash(text.trim())}`);
}
