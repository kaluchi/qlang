// Throw-site ↔ catalog drift guard for the CLI host operands.
//
// The core suite pins the same contract for `core/src` against the
// language catalog; this file pins the host half — the `:cli/io`,
// `:cli/format` and `:cli/parse` namespaces the locator installs.
// A host operand's per-site error class records its structural facts
// where the factory call builds it, and names itself again as a
// `::Tag` binding in `cli/lib/qlang/*.qlang` that carries the prose
// and the `~(…)` examples. The namespace-resolution pass stamps the
// recorded facts onto that binding, so each fact has one spelling.
//
// The two halves drift silently: a renamed class leaves `result !|
// type | docs` unresolvable, and a `::builtin{…}` body restating a
// recorded fact disagrees with the stamp that overwrites it.
//
// Three axes, one describe each:
//
//   1. every throw site under `cli/src` has a `::Tag` binding in a
//      CLI catalog file, and that binding reaches env carrying the
//      category the site recorded;
//   2. every `::Tag` a CLI catalog file declares has a throw site;
//   3. a tag whose throw site records a spec declares no
//      `::builtin{…}` body of its own.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '@kaluchi/qlang-core/session';
import { throwSiteSpecOf } from '@kaluchi/qlang-core/errors';
import { createCliLocator, installCliCatalog } from '../src/cli-locator.mjs';
import '../src/io-operands.mjs';
import '../src/format-operands.mjs';
import '../src/parse-operands.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');
const catalogDir = join(here, '..', 'lib', 'qlang');

// Every form that puts a name in the throw-site registry opens with
// the class name as a string literal.
const DECLARATION_RE = /(?:declare[A-Za-z]+Error|recordThrowSiteSpec)\(\s*'([A-Za-z0-9]+)'/g;

// A `::Tag` at column 0, paired with whether the block under it
// opens a `::builtin{…}` body.
const CATALOG_TAG_RE = /^::([\p{ID_Start}][\p{ID_Continue}_]*Error)\r?$/u;
const BODY_OPENING = '  ::builtin{';

function collectThrowSites() {
  const throwSites = new Map();
  for (const fileName of readdirSync(srcDir).filter(f => f.endsWith('.mjs'))) {
    const source = readFileSync(join(srcDir, fileName), 'utf8');
    for (const match of source.matchAll(DECLARATION_RE)) {
      throwSites.set(match[1], `cli/src/${fileName}`);
    }
  }
  return throwSites;
}

function collectCatalogTags() {
  const declared = new Map();
  for (const fileName of readdirSync(catalogDir).filter(f => f.endsWith('.qlang'))) {
    const lines = readFileSync(join(catalogDir, fileName), 'utf8').split('\n');
    let open = null;
    for (const line of lines) {
      const match = CATALOG_TAG_RE.exec(line);
      if (match !== null) {
        open = { file: `cli/lib/qlang/${fileName}`, declaresBody: false };
        declared.set(match[1], open);
      } else if (open !== null && line.startsWith(BODY_OPENING)) {
        open.declaresBody = true;
      } else if (line.length > 0 && !line.startsWith(' ')) {
        open = null;
      }
    }
  }
  return declared;
}

const throwSites = collectThrowSites();
const declaredTags = collectCatalogTags();

const session = await createSession({
  locator: createCliLocator({
    stdinReader: () => Promise.resolve(''),
    stdoutWrite: () => {},
    stderrWrite: () => {}
  })
});
await installCliCatalog(session);
// The tags the session binds, each under its `::Name` key, as the
// environment holds them.
const catalogTags = new Map([...session.env].filter(([name]) => name.startsWith('::')));

describe('CLI host operands — every throw site carries a catalog tag', () => {
  for (const [className, file] of throwSites) {
    it(`::${className} is declared in a CLI catalog file`, () => {
      expect(declaredTags.has(className),
        `${file} throws ${className} with no \`::${className}\` tag-binding under cli/lib/qlang`
      ).toBe(true);
      expect(catalogTags.has(`::${className}`),
        `::${className} is declared but does not reach env through the locator install`
      ).toBe(true);
    });

    it(`::${className} reaches env with the category its site recorded`, () => {
      expect(catalogTags.get(`::${className}`).get('category').name,
        `::${className} reached env without the category ${file} records`
      ).toBe(throwSiteSpecOf(className).category);
    });
  }
});

describe('CLI host operands — every catalog tag has a throw site', () => {
  for (const [className, declaration] of declaredTags) {
    it(`::${className} is raised somewhere under cli/src`, () => {
      expect(throwSites.has(className),
        `${declaration.file} declares ::${className} with no throw site under cli/src`
      ).toBe(true);
    });
  }
});

describe('CLI host operands — the structural facts have one spelling', () => {
  for (const [className, declaration] of declaredTags) {
    it(`::${className} carries prose, and its facts come from the throw site`, () => {
      expect(declaration.declaresBody,
        `${declaration.file} gives ::${className} a \`::builtin{…}\` body while its ` +
        'throw site already records the same facts — drop the body and keep the prose'
      ).toBe(false);
    });
  }
});
