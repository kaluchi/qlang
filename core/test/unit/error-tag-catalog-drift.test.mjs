// Throw-site ↔ catalog drift guard for per-site error classes.
//
// A per-site error names itself in two planes: in JS, where the
// factory that builds the class records its throw-site spec — the
// `:category` it fires under, plus the `:operand` / `:position` /
// `:expectedType` an operand-slot check carries — and in the catalog,
// where a `::Tag` binding carries the prose and the `~{…}` examples a
// reader reaches through `docs` and `examples`. The bootstrap stamps
// the spec onto the binding, so each fact has one spelling and the
// two planes meet in env.
//
// Nothing in the language forces a class and a binding to exist in
// pairs, so a renamed class, a fresh throw site without a binding, or
// a binding restating facts the stamp overwrites all drift silently —
// and the drift surfaces to a user as `result !| type | spec` handing
// back nothing, or as `::AxisBindingNotFoundError` for a tag the
// catalog never bound.
//
// Five axes, one describe each:
//
//   1. each name the catalog binds is bound once — a second BindStep
//      under the same name shadows the first, which leaves a body no
//      reader reaches and which `manifest` cannot show;
//   2. every recorded throw-site spec has a `::Tag` binding to land
//      on, and a class that stamps its own `fingerprint` outside a
//      factory records a spec of its own;
//   3. every catalog error tag has a throw site, apart from the
//      handful minted outside a per-site factory (listed below with
//      the site that mints each);
//   4. a tag whose throw site records a spec declares no
//      `::builtin{…}` body — the facts have one spelling, at the
//      site, and a body restating them is what the stamp would
//      silently overwrite;
//   5. the operand a tag names is the operand whose `:throws` Vec
//      lists that tag — the two halves of the same edge, authored in
//      the catalog on one side and recorded at the site on the
//      other, so a factory call that drops its `facts` argument
//      leaves the tag reachable from `:throws` while `spec |
//      /operand` answers nothing.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '../../src/session.mjs';
import { throwSiteSpecOf, throwSiteSpecNames } from '../../src/errors.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', '..', 'src');
const catalogDir = join(here, '..', '..', 'lib', 'qlang');

// A class outside the QlangError hierarchy stamps its per-site
// identity by hand — `SourceLoadError` is the one, raised by the two
// host loaders. The factories stamp `this.fingerprint = className`
// from their argument, so a literal here means a hand-written class.
const HAND_STAMPED_FINGERPRINT_RE = /this\.fingerprint\s*=\s*'([A-Za-z0-9]+)'/g;

// Tags whose ErrorValue is minted without going through a per-site
// factory or a fingerprint-stamping class, each with the site that
// mints it.
const TAGS_MINTED_OUTSIDE_A_THROW_SITE = new Map([
  ['::Error',       'makeErrorValue default identity for a user `!{…}` literal'],
  ['::ParseError',  'errorFromParse lifts the peggy ParseError shape'],
  ['::builtin',     'catalog descriptor constructor in runtime/tagged.mjs'],
  ['::conduit',     'Conduit value-class constructor in runtime/tagged.mjs'],
  ['::json',        'JSON-shape constructor in runtime/tagged.mjs'],
  ['::qlang',       'qlang-shape constructor in runtime/tagged.mjs']
]);

// Tags one class raises from more than one operand, each with what
// makes the shared identity the right reading.
const TAGS_SHARED_ACROSS_OPERANDS = new Map([
  ['::EvalSubjectNotMapOrQuoteError',
   '`apply` funnels its subject through the same AST-or-source check `eval` does'],
  ['::AxisBindingNotFoundError',
   'the four axis-operands carry the axis as `:axisName` context, not as identity']
]);

function collectHandStampedClasses() {
  const handStamped = new Map();
  const sourceFiles = readdirSync(srcDir, { recursive: true })
    .map(f => f.split(/[\\/]/).join('/'))
    .filter(f => f.endsWith('.mjs'));

  for (const relPath of sourceFiles) {
    const source = readFileSync(join(srcDir, relPath), 'utf8');
    for (const match of source.matchAll(HAND_STAMPED_FINGERPRINT_RE)) {
      handStamped.set(match[1], `core/src/${relPath}`);
    }
  }
  return handStamped;
}

// Every top-level BindStep in a catalog file — `:operand` or
// `::Tag` at column 0 — paired with whether the block under it opens
// a `::builtin{…}` body. The identifier shape follows the grammar's
// own `IdentStart` / `IdentTail` classes (UAX#31 plus `@`, `_`, `-`),
// with `/` for the namespaced form, so a declaration the parser
// accepts is one this reading sees.
const CATALOG_DECLARATION_RE = /^(::?[@_\p{ID_Start}][\p{ID_Continue}@_/-]*)\r?$/u;
const BODY_OPENING = '  ::builtin{';

function collectCatalogDeclarations() {
  const declarations = [];
  const catalogFiles = readdirSync(catalogDir, { recursive: true })
    .map(f => f.split(/[\\/]/).join('/'))
    .filter(f => f.endsWith('.qlang'));
  for (const relPath of catalogFiles) {
    const lines = readFileSync(join(catalogDir, relPath), 'utf8').split('\n');
    let open = null;
    for (const line of lines) {
      const match = CATALOG_DECLARATION_RE.exec(line);
      if (match !== null) {
        open = { name: match[1], file: `core/lib/qlang/${relPath}`, declaresBody: false };
        declarations.push(open);
      } else if (open !== null && line.startsWith(BODY_OPENING)) {
        open.declaresBody = true;
      }
    }
  }
  return declarations;
}

const handStamped = collectHandStampedClasses();
const declarations = collectCatalogDeclarations();
const declarationsByName = new Map(declarations.map(d => [d.name, d]));
const session = await createSession();
const { result: tagBindings } = await session.evalCell('manifest(:tag)');
const { result: operandBindings } = await session.evalCell('manifest');
const catalogTags = new Map(tagBindings.map(binding => [binding.get('name'), binding]));

describe('catalog declarations — each name is bound once', () => {
  // A second BindStep under the same name shadows the first, so
  // `manifest` shows one entry either way and every drift axis below
  // passes while the catalog carries a stale body nothing reads.
  // Reading the sources directly is what surfaces it.
  const timesBound = new Map();
  for (const { name } of declarations) {
    timesBound.set(name, (timesBound.get(name) ?? 0) + 1);
  }

  for (const [name, count] of timesBound) {
    if (count === 1) continue;
    const files = declarations.filter(d => d.name === name).map(d => d.file);
    it(`${name} is declared once`, () => {
      expect(count, `${name} is declared ${count} times across ${files.join(', ')} — ` +
        'the later declaration shadows the earlier, which leaves a body no reader reaches'
      ).toBe(1);
    });
  }

  it('the catalog binds at least one name per family file', () => {
    expect(declarations.length).toBeGreaterThan(100);
  });
});

describe('per-site error classes — every throw site carries a catalog tag', () => {
  for (const className of throwSiteSpecNames()) {
    it(`::${className} is declared in the catalog`, () => {
      expect(catalogTags.has(`::${className}`),
        `${className} records a throw-site spec with no \`::${className}\` tag-binding — ` +
        'add one so `result !| type | docs / spec` resolves'
      ).toBe(true);
    });
  }

  for (const [className, file] of handStamped) {
    it(`::${className} records a spec alongside its hand-stamped fingerprint`, () => {
      expect(throwSiteSpecOf(className),
        `${file} stamps ${className} as a per-site identity without recording its spec — ` +
        'the tag-binding then has no category to carry'
      ).toBeDefined();
    });
  }
});

describe('per-site error classes — every catalog error tag has a throw site', () => {
  for (const [tagName] of catalogTags) {
    const className = tagName.slice('::'.length);
    if (throwSiteSpecOf(className) !== undefined) continue;
    it(`${tagName} is minted outside a per-site factory for a stated reason`, () => {
      expect(TAGS_MINTED_OUTSIDE_A_THROW_SITE.get(tagName),
        `${tagName} has no throw site under core/src and no entry naming what mints it`
      ).toBeDefined();
    });
  }
});

describe('per-site error classes — an operand and the tags it throws agree', () => {
  // `:throws` is authored, `:operand` is recorded: the catalog names
  // the tags an operand raises, and the factory call at each site
  // names the operand back. A site whose factory call drops the
  // `facts` argument breaks the return edge alone — the tag still
  // reads as thrown, and `spec | /operand` answers nothing.
  const operandOf = (binding) => {
    const declared = binding.get('operand');
    if (declared === undefined) return undefined;
    return declared.literal ?? `:${declared.name}`;
  };

  for (const operandBinding of operandBindings) {
    const operandName = `:${operandBinding.get('name')}`;
    for (const thrownTag of operandBinding.get('throws')) {
      if (TAGS_SHARED_ACROSS_OPERANDS.has(thrownTag.literal)) continue;
      it(`${operandName} throws ${thrownTag.literal}, which names ${operandName} back`, () => {
        expect(operandOf(catalogTags.get(thrownTag.literal)),
          `${operandName} lists ${thrownTag.literal} in its \`:throws\`, and that tag's ` +
          'throw site records no matching `:operand` — pass it as the factory call\'s facts'
        ).toBe(operandName);
      });
    }
  }

  it('a tag one class raises from several operands says why', () => {
    for (const [tagName, reason] of TAGS_SHARED_ACROSS_OPERANDS) {
      expect(catalogTags.has(tagName), `${tagName} is listed as shared but bound nowhere`).toBe(true);
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});

describe('per-site error classes — the structural facts have one spelling', () => {
  // The factory that builds the class records `:category` /
  // `:operand` / `:position` / `:expectedType`, and the bootstrap
  // stamps them onto the tag-binding. A catalog body re-stating them
  // is the drift this guard exists to prevent: the stamp overwrites
  // it, so the two spellings disagree in the source while agreeing
  // in env.
  for (const className of throwSiteSpecNames()) {
    const declaration = declarationsByName.get(`::${className}`);
    if (declaration === undefined) continue;
    it(`::${className} carries prose, and its facts come from the throw site`, () => {
      expect(declaration.declaresBody,
        `${declaration.file} gives ::${className} a \`::builtin{…}\` body while its ` +
        'throw site already records the same facts — drop the body and keep the prose'
      ).toBe(false);
    });
  }

  it('the stamped binding answers with the category the site recorded', () => {
    for (const className of throwSiteSpecNames()) {
      const binding = catalogTags.get(`::${className}`);
      expect(binding.get('category').name,
        `::${className} reached env without the category its throw site records`
      ).toBe(throwSiteSpecOf(className).category);
    }
  });
});
