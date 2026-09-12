// Throw-site ↔ catalog drift guard for the CLI host operands.
//
// The core suite pins the same contract for `core/src` against the
// language catalog; this file pins the host half — the `:cli/io`,
// `:cli/format` and `:cli/parse` namespaces the locator installs.
// A host operand's per-site error class names itself in
// `cli/src/*-operands.mjs` and again as a `::Tag` binding in
// `cli/lib/qlang/*.qlang`, and the two drift silently: a renamed
// class leaves `result !| type | docs` unresolvable, and a
// `:position` that disagrees with the factory call makes
// `result !| type | spec | /position` point at the wrong slot.
//
// Three axes, one describe each:
//
//   1. every throw site under `cli/src` has a `::Tag` binding in a
//      CLI catalog file;
//   2. every `::Tag` a CLI catalog file declares has a throw site;
//   3. `:operand` / `:position` on the tag-binding body match the
//      arguments the factory call passes.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSession } from '@kaluchi/qlang-core/session';
import { isTagKeyword } from '@kaluchi/qlang-core';
import { createCliLocator, installCliCatalog } from '../src/cli-locator.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');
const catalogDir = join(here, '..', 'lib', 'qlang');

const FACTORY_CALL_RE =
  /declare(Subject|Modifier|Element|Comparability|Shape|Arity)Error\(\s*'([A-Za-z0-9]+)'(?:,\s*'([^']*)')?(?:,\s*(\d+))?/g;
const CATALOG_TAG_RE = /^::([A-Za-z0-9]+Error)$/gm;
const OPERAND_BOUND_FACTORIES = new Set(['Subject', 'Modifier', 'Element', 'Comparability']);

function collectThrowSites() {
  const throwSites = new Map();
  for (const fileName of readdirSync(srcDir).filter(f => f.endsWith('.mjs'))) {
    const source = readFileSync(join(srcDir, fileName), 'utf8');
    for (const match of source.matchAll(FACTORY_CALL_RE)) {
      const [, factory, className, operand, position] = match;
      throwSites.set(className, {
        file: `cli/src/${fileName}`,
        factory,
        operand: OPERAND_BOUND_FACTORIES.has(factory) ? operand : undefined,
        position: factory === 'Modifier' ? Number(position) : undefined
      });
    }
  }
  return throwSites;
}

function collectCatalogTagNames() {
  const declared = new Map();
  for (const fileName of readdirSync(catalogDir).filter(f => f.endsWith('.qlang'))) {
    const source = readFileSync(join(catalogDir, fileName), 'utf8');
    for (const match of source.matchAll(CATALOG_TAG_RE)) {
      declared.set(match[1], `cli/lib/qlang/${fileName}`);
    }
  }
  return declared;
}

function operandLiteralOf(declaredOperand) {
  if (declaredOperand === undefined) return undefined;
  return isTagKeyword(declaredOperand) ? declaredOperand.literal : declaredOperand.name;
}

const throwSites = collectThrowSites();
const declaredTagNames = collectCatalogTagNames();

const session = await createSession({
  locator: createCliLocator({
    stdinReader: () => Promise.resolve(''),
    stdoutWrite: () => {},
    stderrWrite: () => {}
  })
});
await installCliCatalog(session);
const { result: tagBindings } = await session.evalCell('manifest(:tag)');
const catalogTags = new Map(tagBindings.map(binding => [binding.get('name'), binding]));

describe('CLI host operands — every throw site carries a catalog tag', () => {
  for (const [className, site] of throwSites) {
    it(`::${className} is declared in a CLI catalog file`, () => {
      expect(declaredTagNames.has(className),
        `${site.file} throws ${className} with no \`::${className}\` tag-binding under cli/lib/qlang`
      ).toBe(true);
      expect(catalogTags.has(`::${className}`),
        `::${className} is declared but does not reach env through the locator install`
      ).toBe(true);
    });
  }
});

describe('CLI host operands — every catalog tag has a throw site', () => {
  for (const [className, catalogFile] of declaredTagNames) {
    it(`::${className} is raised somewhere under cli/src`, () => {
      expect(throwSites.has(className),
        `${catalogFile} declares ::${className} with no throw site under cli/src`
      ).toBe(true);
    });
  }
});

describe('CLI host operands — catalog :operand / :position match the throw site', () => {
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
      expect(declaredPosition?.name,
        `${site.file} declares a subject-shape check`
      ).toBe('subject');
    });
  }
});
