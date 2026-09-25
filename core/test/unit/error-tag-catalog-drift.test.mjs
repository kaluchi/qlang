// Throw-site ↔ catalog drift guard for per-site error classes.
//
// A per-site error names itself in two planes: in JS, where the
// factory that builds the class records its throw-site spec — the
// `:category` it fires under, plus the `:operand` / `:position` /
// `:expectedType` an operand-slot check carries — and in the catalog,
// where a `::Tag` binding carries the prose and the `~(…)` examples a
// reader reaches through `docs` and `examples`. The bootstrap stamps
// the spec onto the binding, so each fact has one spelling and the
// two planes meet in env.
//
// Nothing in the language forces a class and a binding to exist in
// pairs, so a renamed class, a fresh throw site without a binding, or
// a binding restating facts the stamp overwrites all drift silently —
// and the drift surfaces to a user as `result !| type | spec` handing
// back nothing, or as `::SourceBindingNotFoundError` for a tag the
// catalog never bound.
//
// Six axes, one describe each:
//
//   1. each name the catalog binds is bound once, and every family
//      file contributes at least one name — a second BindStep under
//      one name shadows the first, which leaves a body no reader
//      reaches, and a file this reading stops seeing takes its tags
//      out of axis 4 without a red test;
//   2. every recorded throw-site spec has a `::Tag` binding to land
//      on;
//   3. every catalog error tag has a throw site, apart from the
//      handful minted outside a per-site factory and the value-class
//      constructors, which mint no ErrorValue at all;
//   4. a tag whose throw site records a spec declares no
//      `::builtin{…}` body — the facts have one spelling, at the
//      site, and a body restating them is what the stamp would
//      silently overwrite;
//   5. `:throws` is the reverse of the `:operand` each site
//      records, so no catalog body spells it and every Vec in env
//      equals what the registry derives;
//   6. the operand a tag names is the operand whose `:throws` Vec
//      lists that tag — the two halves of the same edge, so a
//      factory call that drops its `facts` argument leaves the tag
//      reachable from `:throws` while `spec | /operand` answers
//      nothing.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '../../src/session.mjs';
import {
  throwSiteSpecOf, throwSiteSpecNames, throwSiteTagsRaisedBy
} from '../../src/errors.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(here, '..', '..', 'lib', 'qlang');

// Tags whose ErrorValue is minted without going through a per-site
// factory, each with the site that mints it.
const ERROR_TAGS_MINTED_OUTSIDE_A_THROW_SITE = new Map([
  ['::Error',      'makeErrorValue default identity for a user `!{…}` literal'],
  ['::ParseError', 'errorFromParse lifts the peggy ParseError shape'],
  ['::ForeignFailureError', 'errorFromForeign lifts a JavaScript error escaping an operand']
]);

// Value-class constructors share the `::Tag` plane with the error
// tags, and raise errors rather than being ones, so the axes below
// read them out by kind.
const VALUE_CLASS_CONSTRUCTOR_TAGS = new Set([
  '::builtin', '::conduit', '::set',
  '::null', '::boolean', '::number', '::string', '::keyword', '::tag', '::vec', '::map', '::doc',
  '::quote', '::call', '::proj', '::bind', '::tagged', '::each', '::fail', '::group'
]);

// The core as a noun and the kind beneath every kind declare a page
// alone, and neither constructs nor refuses [D62].
const CORE_NOUNS_OF_A_PAGE_ALONE = new Set(['::qlang', '::any']);

// `core.qlang` is the orchestrator — one `use([…])` step and no
// BindStep of its own — so it is the one catalog file that binds
// nothing.
const CATALOG_ORCHESTRATOR = 'core.qlang';

// Every top-level BindStep in a catalog file — `:operand` or
// `::Tag` at column 0 — paired with whether the block under it opens
// a `::builtin{…}` body. The identifier shape follows the grammar's
// own `IdentStart` / `IdentTail` classes (UAX#31 plus `@`, `_`, `-`),
// with `/` for the namespaced form, so a declaration the parser
// accepts is one this reading sees.
const CATALOG_DECLARATION_RE = /^(::?[@_\p{ID_Start}][\p{ID_Continue}@_/-]*)\r?$/u;
const BODY_OPENING = '  ::builtin{';
const THROWS_FIELD = ':throws';

function catalogFiles() {
  return readdirSync(catalogDir, { recursive: true })
    .map(f => f.split(/[\\/]/).join('/'))
    .filter(f => f.endsWith('.qlang'));
}

function collectCatalogDeclarations() {
  const declarations = [];
  for (const relPath of catalogFiles()) {
    const lines = readFileSync(join(catalogDir, relPath), 'utf8').split('\n');
    let open = null;
    for (const line of lines) {
      const match = CATALOG_DECLARATION_RE.exec(line);
      if (match !== null) {
        open = {
          name: match[1], file: `core/lib/qlang/${relPath}`,
          declaresBody: false, declaresThrows: false
        };
        declarations.push(open);
      } else if (open !== null && line.startsWith(BODY_OPENING)) {
        open.declaresBody = true;
      } else if (open !== null && open.declaresBody && line.includes(THROWS_FIELD)) {
        open.declaresThrows = true;
      }
    }
  }
  return declarations;
}

const declarations = collectCatalogDeclarations();
const declarationsByName = new Map(declarations.map(d => [d.name, d]));
const session = await createSession();
const { result: tagBindings } = await session.evalCell('manifest :tag');
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

  // A formatting shift this reading stops seeing would drop every
  // tag in that file out of axis 4 silently, so each family file
  // answers for itself.
  for (const relPath of catalogFiles()) {
    if (relPath === CATALOG_ORCHESTRATOR) continue;
    it(`${relPath} contributes a declaration this reading sees`, () => {
      const bound = declarations.filter(d => d.file.endsWith(relPath));
      expect(bound.length,
        `core/lib/qlang/${relPath} binds nothing the column-0 reading picks up — ` +
        'either the file is empty or its declaration shape moved'
      ).toBeGreaterThan(0);
    });
  }
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
});

describe('per-site error classes — every catalog error tag has a throw site', () => {
  for (const [tagName] of catalogTags) {
    if (VALUE_CLASS_CONSTRUCTOR_TAGS.has(tagName) || CORE_NOUNS_OF_A_PAGE_ALONE.has(tagName)) continue;
    const className = tagName.slice('::'.length);
    if (throwSiteSpecOf(className) !== undefined) continue;
    it(`${tagName} is minted outside a per-site factory for a stated reason`, () => {
      expect(ERROR_TAGS_MINTED_OUTSIDE_A_THROW_SITE.get(tagName),
        `${tagName} has no throw site under core/src and no entry naming what mints it`
      ).toBeDefined();
    });
  }

  it('every value-class constructor tag the axes read out is bound', () => {
    for (const tagName of VALUE_CLASS_CONSTRUCTOR_TAGS) {
      expect(catalogTags.has(tagName),
        `${tagName} is read out as a constructor, and the catalog binds no such tag`
      ).toBe(true);
    }
  });
});

describe('`:throws` is the reverse of the `:operand` each site records', () => {
  // The stamp reads the Vec back off the registry, so a catalog
  // body spelling it again disagrees in the source while agreeing
  // in env — the drift this axis exists to keep out.
  for (const declaration of declarations) {
    if (!declaration.declaresThrows) continue;
    it(`${declaration.name} declares no \`:throws\` of its own`, () => {
      expect(declaration.declaresThrows,
        `${declaration.file} spells \`:throws\` on ${declaration.name}, which the ` +
        'stamp overwrites from the sites that name it'
      ).toBe(false);
    });
  }

  it('every binding raising a query fault carries it, and nothing else does', () => {
    for (const [bindingName, binding] of [
      ...operandBindings.map(b => [b.get('name'), b]),
      ...tagBindings.map(b => [b.get('name'), b])
    ]) {
      const derived = throwSiteTagsRaisedBy(bindingName).map(className => `::${className}`);
      if (derived.length === 0 && !binding.has('throws')) continue;
      expect(binding.has('throws'),
        `${bindingName} raises ${derived.length} query fault(s) and carries no \`:throws\``
      ).toBe(true);
      expect(binding.get('throws').map(tag => tag.literal),
        `${bindingName} carries a \`:throws\` the sites do not derive`).toEqual(derived);
    }
  });

  it('a category the reader cannot act on reaches no `:throws` Vec', () => {
    const carriedAnywhere = new Set([
      ...operandBindings.flatMap(b => b.get('throws').map(t => t.literal.slice(2))),
      ...tagBindings.flatMap(b => (b.get('throws') ?? []).map(t => t.literal.slice(2)))
    ]);
    for (const className of throwSiteSpecNames()) {
      if (throwSiteSpecOf(className).isQueryFault) continue;
      expect(carriedAnywhere.has(className),
        `${className} is a runtime or host failure and rides a binding's \`:throws\``
      ).toBe(false);
    }
  });
});

describe('per-site error classes — a binding and the tags it throws agree', () => {
  // `:throws` is derived and `:operand` is recorded — both halves of
  // one edge, read off the same registry. A site whose factory call drops the
  // `facts` argument breaks the return edge alone — the tag still
  // reads as thrown, and `spec | /operand` answers nothing. Both
  // planes carry `:throws`, and a tag spells its raiser the way
  // source writes it: an operand as a Keyword, a value-class
  // constructor as a TagKeyword.
  const raisers = [
    ...operandBindings.map(binding => [`:${binding.get('name')}`, binding]),
    ...tagBindings.map(binding => [binding.get('name'), binding])
  ];

  for (const [raiserName, raiserBinding] of raisers) {
    for (const thrownTag of raiserBinding.get('throws') ?? []) {
      it(`${raiserName} throws ${thrownTag.literal}, which names ${raiserName} back`, () => {
        expect(catalogTags.get(thrownTag.literal).get('operand')?.literal,
          `${raiserName} lists ${thrownTag.literal} in its \`:throws\`, and that tag's ` +
          'throw site records no matching `:operand` — pass it as the factory call\'s facts'
        ).toBe(raiserName);
      });
    }
  }
});

describe('per-site error classes — the structural facts have one spelling', () => {
  // The factory that builds the class records `:category` /
  // `:operand` / `:position` / `:expectedType`, and the bootstrap
  // stamps them onto the tag-binding. A catalog body re-stating them
  // is the drift this guard exists to prevent: the stamp overwrites
  // it, so the two spellings disagree in the source while agreeing
  // in env.
  for (const className of throwSiteSpecNames()) {
    it(`::${className} carries prose, and its facts come from the throw site`, () => {
      const declaration = declarationsByName.get(`::${className}`);
      expect(declaration,
        `::${className} records a spec, and no column-0 declaration under that name ` +
        'reaches this reading — the catalog binds it somewhere this axis cannot check'
      ).toBeDefined();
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
