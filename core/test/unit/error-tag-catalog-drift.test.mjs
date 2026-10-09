// Throw-site ↔ catalog drift guard for per-site error classes.
//
// A per-site error names itself in two planes: in JS, where the factory
// that builds the class records its throw-site spec, and in the tree of
// names, where a source of the language declares its kind under the
// noun of the place it guards, with the prose and the laws a reader
// reaches through `doc` [D152], [D153]. Nothing
// in the language forces the two to exist in pairs, so a renamed class or
// a fresh throw site without a kind drifts silently, and surfaces to a
// reader as `!| type | doc` answering a refusal of its own.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { throwSiteSpecOf, throwSiteSpecNames } from '../../src/errors.mjs';
import { nodeOf, splitAddress } from '../../src/runtime/nouns.mjs';
import { ROOT_KEY } from '../../src/env-keys.mjs';
import { bindingValueOf, isSpec } from '../../src/types.mjs';

// Refusals minted without going through a per-site factory, each with
// the site that mints it.
const REFUSALS_MINTED_OUTSIDE_A_THROW_SITE = new Map([
  ['quote/ParseError', 'errorFromParse lifts the peggy ParseError shape'],
  ['call/HostFailureError', 'errorFromForeign lifts a JavaScript error escaping an operand']
]);

const session = await createSession();

// The kinds the root declares under a noun whose name is a refusal's,
// `number/add/SubjectNotNumberError`.
const refusalKinds = [];
for (const [address, record] of session.env.get(ROOT_KEY)) {
  const [nounName, name] = splitAddress(address);
  if (nounName !== null && /Error$/.test(name) && isSpec(bindingValueOf(record))) refusalKinds.push([address, name]);
}

describe('every refusal names the place it guards [D64]', () => {
  it('a throw site names a verb, a noun or a step of the language', () => {
    const placeless = [...throwSiteSpecNames()].filter(address => throwSiteSpecOf(address).operand === undefined);
    expect(placeless).toEqual([]);
  });
});

describe('every throw site has its kind in the tree of names [D152]', () => {
  for (const address of throwSiteSpecNames()) {
    it(`${address} is declared under the noun it guards`, () => {
      expect(isSpec(bindingValueOf(nodeOf(session.env, address))),
        `${address} records a throw-site spec and no source of the language declares it under its noun`
      ).toBe(true);
    });
  }
});

describe('every refusal of the catalog has a throw site', () => {
  for (const [address] of refusalKinds) {
    if (throwSiteSpecOf(address) !== undefined) continue;
    it(`${address} is minted outside a per-site factory for a stated reason`, () => {
      expect(REFUSALS_MINTED_OUTSIDE_A_THROW_SITE.get(address),
        `${address} has no throw site under core/src and no entry naming what mints it`
      ).toBeDefined();
    });
  }

  it('the root holds the topic of the language and its kinds', () => {
    expect(nodeOf(session.env, 'qlang')).not.toBeNull();
    expect(isSpec(bindingValueOf(nodeOf(session.env, 'number')))).toBe(true);
  });
});
