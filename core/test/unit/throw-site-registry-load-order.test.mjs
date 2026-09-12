// The stamp pass reads the throw-site spec registry, so the registry
// has to be full by the time `buildLangRuntime` runs.
//
// A per-site class records its spec as a side effect of its module
// loading. `runtime/index.mjs` pulls in every module that declares
// one — the operand impls by way of the primitive registry, the two
// host-boundary seams (`codec.mjs`, `session.mjs`) by an import of
// their own. A third seam added without that import would record
// nothing before the stamp pass, and its `::Tag` bindings would reach
// env with no `:category` to answer `spec` with — for a host that
// imported the `./runtime` subpath, while a host coming through the
// package entry saw the full reading.
//
// This file imports the runtime alone, then reads every factory call
// out of `core/src/**` by source and asks the registry for each name.
// The invariant is structural, so the reading is too.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import '../../src/runtime/index.mjs';
import { throwSiteSpecOf } from '../../src/errors.mjs';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

// `declareSubjectError('Foo', …)` / `declarePerSiteError('Foo', …)` /
// `recordThrowSiteSpec('Foo', …)` — every form that puts a name in
// the registry opens with the class name as a string literal.
const DECLARATION_RE = /(?:declare[A-Za-z]+Error|recordThrowSiteSpec)\(\s*'([A-Za-z0-9]+)'/g;

function declaredClassNames() {
  const declared = new Map();
  const sourceFiles = readdirSync(srcDir, { recursive: true })
    .map(f => f.split(/[\\/]/).join('/'))
    .filter(f => f.endsWith('.mjs'));
  for (const relPath of sourceFiles) {
    const source = readFileSync(join(srcDir, relPath), 'utf8');
    for (const match of source.matchAll(DECLARATION_RE)) {
      declared.set(match[1], `core/src/${relPath}`);
    }
  }
  return declared;
}

describe('throw-site registry — the runtime import graph reaches every declaration', () => {
  const declared = declaredClassNames();

  it('the source reading finds the declarations it is meant to check', () => {
    expect(declared.size).toBeGreaterThan(100);
  });

  for (const [className, file] of declared) {
    it(`${className} records its spec before the stamp pass`, () => {
      expect(throwSiteSpecOf(className),
        `${file} declares ${className}, and importing core/src/runtime/index.mjs alone ` +
        'does not load that module — add the import there, or the tag-binding reaches ' +
        'env with no category for `spec` to answer with'
      ).toBeDefined();
    });
  }
});
