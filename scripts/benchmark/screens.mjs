// The first screen a run hands its child, which the run fixes with its hash
// under the number of the record it measures, the hash `screen` prints, so
// a run states which pages it read and two runs compare two screens [QSMSR#benchmark].

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pipeEnv } from '../pipe-env.mjs';

const benchDir = import.meta.dirname;
const screensDir = join(benchDir, 'screens');
const commandLine = join(benchDir, '..', '..', 'playground', 'src', 'bin.mjs');

// The first screen, the pages of the language and of the playground as the
// tree prints them, trimmed [QSMSR#benchmark].
export function firstScreen() {
  return execFileSync(process.execPath, [commandLine, '[::qlang ::host] | map ~(get [~it ~doc])'], { input: '', encoding: 'utf8', env: pipeEnv }).trim();
}

// A saved screen as the tree printed it, its line breaks those of the print
// whatever the checkout wrote [QSMSR#benchmark].
export function screenText(screenName) {
  return readFileSync(join(screensDir, `${screenName}.txt`), 'utf8').replace(/\r\n/g, '\n').trim();
}

export const shortHash = text => createHash('sha256').update(text).digest('hex').slice(0, 12);

// fixScreen(decision) → the first screen the tree prints, saved under the
// number of the decision a run measures, or under the number and its hash
// when an earlier measurement of the number read another page [QSMSR#benchmark].
export function fixScreen(decision) {
  mkdirSync(screensDir, { recursive: true });
  const text = firstScreen();
  const hash = shortHash(text);
  const plain = join(screensDir, `${decision}.txt`);
  const name = existsSync(plain) && screenText(decision) !== text ? `${decision}.${hash}` : decision;
  writeFileSync(join(screensDir, `${name}.txt`), `${text}\n`);
  return { name, hash };
}
