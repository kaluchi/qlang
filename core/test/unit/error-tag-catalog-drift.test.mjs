// Throw-site ↔ catalog drift guard for per-site error classes.
//
// Every per-site error class names itself twice: once in JS — a
// `declare*Error` factory call or a `this.fingerprint` stamp in a
// hand-written class — and once in the catalog as a `::Tag` binding
// whose `::builtin{…}` body carries `:category`, and for the
// operand-bound factories `:operand` / `:position`. Nothing forces
// the two halves to agree, so a renamed class, a fresh throw site
// without a tag-binding, or a `:operand` naming a different operand
// than the message the factory builds all drift silently — and the
// drift surfaces to a user as `result !| type | spec` handing back
// facts about some other operand, or as `::AxisBindingNotFoundError`
// for a tag that has no catalog entry at all.
//
// Three axes, one describe each:
//
//   1. every JS throw site has a `::Tag` binding in the catalog;
//   2. every catalog error tag has a JS throw site, apart from the
//      handful minted outside a per-site factory (listed below with
//      the site that mints each);
//   3. `:operand` and `:position` on the tag-binding body match the
//      arguments the factory call passes at the throw site.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '../../src/session.mjs';
import { isTagKeyword } from '../../src/types.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', '..', 'src');

// `declareSubjectError(name, operand, expectedType)`,
// `declareModifierError(name, operand, position, expectedType)`,
// `declareElementError(name, operand, expectedType)` and
// `declareComparabilityError(name, operand)` carry the operand (and
// for the modifier form, the position) as literal arguments at the
// call site. `declareShapeError`, `declareArityError` and
// `declareNumericDomainError` take a message builder, so only their
// class name is harvested.
const FACTORY_CALL_RE =
  /declare(Subject|Modifier|Element|Comparability|Shape|Arity|NumericDomain)Error\(\s*'([A-Za-z0-9]+)'(?:,\s*'([^']*)')?(?:,\s*(\d+))?/g;
// Hand-written classes (registry, session, codec, bootstrap, render
// invariants) stamp their per-site identity through `fingerprint`.
const FINGERPRINT_RE = /this\.fingerprint\s*=\s*'([A-Za-z0-9]+)'/g;

const OPERAND_BOUND_FACTORIES = new Set(['Subject', 'Modifier', 'Element', 'Comparability']);

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

function collectThrowSites() {
  const throwSites = new Map();
  const sourceFiles = readdirSync(srcDir, { recursive: true })
    .map(f => f.split(/[\\/]/).join('/'))
    .filter(f => f.endsWith('.mjs'));

  for (const relPath of sourceFiles) {
    const source = readFileSync(join(srcDir, relPath), 'utf8');
    for (const match of source.matchAll(FACTORY_CALL_RE)) {
      const [, factory, className, operand, position] = match;
      throwSites.set(className, {
        file: `core/src/${relPath}`,
        factory,
        operand: OPERAND_BOUND_FACTORIES.has(factory) ? operand : undefined,
        position: factory === 'Modifier' ? Number(position) : undefined
      });
    }
    for (const match of source.matchAll(FINGERPRINT_RE)) {
      if (throwSites.has(match[1])) continue;
      throwSites.set(match[1], { file: `core/src/${relPath}`, factory: 'class' });
    }
  }
  return throwSites;
}

// The tag-binding body writes `:operand` as a Keyword for a
// value-namespace operand (`:add`, `:@tap`) and as a TagKeyword for
// a value-class constructor (`::conduit`), while the factory call
// passes the source spelling as a string. Comparing through the
// literal covers both planes with one reading.
function operandLiteralOf(declaredOperand) {
  if (declaredOperand === undefined) return undefined;
  return isTagKeyword(declaredOperand) ? declaredOperand.literal : declaredOperand.name;
}

const throwSites = collectThrowSites();
const session = await createSession();
const { result: tagBindings } = await session.evalCell('manifest(:tag)');
const catalogTags = new Map(tagBindings.map(binding => [binding.get('name'), binding]));

describe('per-site error classes — every throw site carries a catalog tag', () => {
  for (const [className, site] of throwSites) {
    it(`::${className} is declared in the catalog`, () => {
      expect(catalogTags.has(`::${className}`),
        `${site.file} throws ${className} with no \`::${className}\` tag-binding — ` +
        'add one so `result !| type | docs / spec` resolves'
      ).toBe(true);
    });
  }
});

describe('per-site error classes — every catalog error tag has a throw site', () => {
  for (const [tagName] of catalogTags) {
    const className = tagName.slice('::'.length);
    if (throwSites.has(className)) continue;
    it(`${tagName} is minted outside a per-site factory for a stated reason`, () => {
      expect(TAGS_MINTED_OUTSIDE_A_THROW_SITE.get(tagName),
        `${tagName} has no throw site under core/src and no entry naming what mints it`
      ).toBeDefined();
    });
  }
});

describe('per-site error classes — catalog :operand / :position match the throw site', () => {
  for (const [className, site] of throwSites) {
    const tagBinding = catalogTags.get(`::${className}`);
    if (tagBinding === undefined || site.operand === undefined) continue;

    it(`::${className} names :operand ${site.operand}`, () => {
      expect(operandLiteralOf(tagBinding.get('operand')),
        `${site.file} builds its message around '${site.operand}'`
      ).toBe(site.operand);
    });

    it(`::${className} names the ${site.factory === 'Modifier' ? `position ${site.position}` : 'subject'} slot`, () => {
      const declaredPosition = tagBinding.get('position');
      if (site.factory === 'Modifier') {
        expect(declaredPosition,
          `${site.file} declares the captured slot at position ${site.position}`
        ).toBe(site.position);
        return;
      }
      if (site.factory === 'Subject') {
        expect(declaredPosition?.name,
          `${site.file} declares a subject-shape check`
        ).toBe('subject');
        return;
      }
      // Element and comparability checks read a collection member or
      // a pair, neither of which sits at a numbered slot, so the
      // tag-binding carries no `:position`.
      expect(declaredPosition).toBeUndefined();
    });
  }
});
