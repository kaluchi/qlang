// The imports of the core [QSWRK#tooling]: no module of `core/src` imports a module
// that imports it, through the parser `core/gen` holds and the loaders of
// `core/host` among them, no module outside `runtime/` imports one inside it,
// the session and the root of the package aside, and the records of the steps
// reach no module of the parser.

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { importsOfCore, cyclesOf } from '../../../scripts/core-imports.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const ABOVE_THE_WORDS = new Set(['core/src/session.mjs', 'core/src/index.mjs']);
const isOfTheWords = path => path.startsWith('core/src/runtime/');
const OF_THE_PARSER = new Set(['core/src/parse.mjs', 'core/gen/grammar.mjs', 'core/src/walk.mjs']);

// The imports of a module outside the words that reach into them.
const reachesIntoTheWords = imports => [...imports].filter(([path]) => !isOfTheWords(path) && !ABOVE_THE_WORDS.has(path))
  .flatMap(([path, targets]) => targets.filter(isOfTheWords).map(target => `${path} → ${target}`));

describe('the imports of core/src', () => {
  const imports = importsOfCore(repoRoot);

  it('[QSWRK#tooling] form no cycle, the parser and the modules its grammar imports among them', () => {
    expect(cyclesOf(imports)).toEqual([]);
    expect(imports.get('core/src/parse.mjs')).toContain('core/gen/grammar.mjs');
    expect(imports.get('core/gen/grammar.mjs')).toEqual(expect.arrayContaining(['core/src/steps.mjs', 'core/src/walk.mjs']));
  });

  it('[QSWRK#tooling] reach the words and the root from the session and the root of the package alone', () => {
    expect(reachesIntoTheWords(imports)).toEqual([]);
    expect(imports.get('core/src/session.mjs')).toContain('core/src/runtime/index.mjs');
  });

  it('[QSWRK#tooling] keep the records of the steps below the parser, reaching none of its modules', () => {
    const reached = new Set();
    const reach = path => imports.get(path).filter(target => !reached.has(target)).forEach(target => { reached.add(target); reach(target); });
    reach('core/src/steps.mjs');
    expect([...reached].filter(path => OF_THE_PARSER.has(path))).toEqual([]);
    expect(reached).toContain('core/src/types.mjs');
  });

  it('[QSWRK#tooling] find a cycle and a reach into the words where a module writes one, the words and the session aside', () => {
    const written = new Map([
      ['core/src/a.mjs', ['core/src/b.mjs']],
      ['core/src/b.mjs', ['core/src/a.mjs', 'core/src/runtime/c.mjs']],
      ['core/src/runtime/c.mjs', ['core/src/runtime/d.mjs']],
      ['core/src/runtime/d.mjs', []],
      ['core/src/session.mjs', ['core/src/runtime/c.mjs']]
    ]);
    expect(cyclesOf(written)).toEqual([['core/src/a.mjs', 'core/src/b.mjs']]);
    expect(reachesIntoTheWords(written)).toEqual(['core/src/b.mjs → core/src/runtime/c.mjs']);
  });

  it('[QSWRK#tooling] read the loaders the imports of the package map through every condition', () => {
    expect(imports.get('core/src/runtime/bootstrap.mjs')).toEqual(expect.arrayContaining(['core/host/load-source-node.mjs', 'core/src/load-source-web.mjs']));
  });

  // The imports of a tree written from its sources.
  const importsWritten = sources => {
    const tree = mkdtempSync(join(tmpdir(), 'qlang-imports-'));
    try {
      for (const [path, text] of Object.entries(sources)) {
        mkdirSync(dirname(join(tree, path)), { recursive: true });
        writeFileSync(join(tree, path), text);
      }
      return importsOfCore(tree);
    } finally {
      rmSync(tree, { recursive: true, force: true });
    }
  };

  it('[QSWRK#tooling] read a cycle a module writes in double quotes, through the parser', () => {
    const written = importsWritten({
      'core/package.json': '{"imports":{}}',
      'core/src/a.mjs': 'import { b } from "./b.mjs";\n',
      'core/src/b.mjs': 'import "../gen/grammar.mjs";\n',
      'core/gen/grammar.mjs': '  const a = import("../src/a.mjs");\n',
      'core/host/load.mjs': ''
    });
    expect(cyclesOf(written)).toEqual([['core/gen/grammar.mjs', 'core/src/a.mjs', 'core/src/b.mjs']]);
  });

  it('[QSWRK#tooling] read a cycle a module closes through a loader the imports of the package map, a name they map to no module naming none', () => {
    const written = importsWritten({
      'core/package.json': JSON.stringify({ imports: { '#load': { node: './host/load.mjs', default: './src/load.mjs' }, '#boot': './src/boot.mjs' } }),
      'core/src/boot.mjs': "import { load } from '#load';\nimport '#unmapped';\n",
      'core/src/load.mjs': '',
      'core/host/load.mjs': "import '#boot';\n",
      'core/gen/grammar.mjs': ''
    });
    expect(written.get('core/src/boot.mjs')).toEqual(['core/host/load.mjs', 'core/src/load.mjs']);
    expect(cyclesOf(written)).toEqual([['core/host/load.mjs', 'core/src/boot.mjs']]);
  });
});
