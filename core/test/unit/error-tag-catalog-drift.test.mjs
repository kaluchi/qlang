// The refusals of the runtime and their pages in the catalog. A refusal
// names itself in two planes: in the JavaScript, where its site declares
// it by its address, and in the tree of names, where a source of the
// language pages it under the noun of the place it guards, with the
// prose, the facts and the laws a reader reaches through `doc` [D152],
// [D172]. Nothing in the language forces the two to exist in pairs, so a
// renamed address or a fresh site without a page drifts silently, and
// surfaces to a reader as `!| type | doc` answering a refusal of its own.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { declaredRefusals } from '../../src/errors.mjs';
import { nodeOf } from '../../src/runtime/nouns.mjs';
import { splitAddress } from '../../src/address.mjs';
import { ROOT_KEY } from '../../src/env-keys.mjs';
import { bindingValueOf, isDoc } from '../../src/types.mjs';

const session = await createSession();
const declared = new Set(declaredRefusals());

// The refusals the root pages under a noun, `number/add/SubjectNotNumberError`.
const refusalPages = [];
for (const [address, record] of session.env.get(ROOT_KEY)) {
  const [nounName, name] = splitAddress(address);
  if (nounName !== null && /Error$/.test(name) && isDoc(bindingValueOf(record))) refusalPages.push(address);
}

describe('every refusal a site of the runtime declares has its page under its noun [D152]', () => {
  for (const address of declared) {
    it(`${address} is paged under the noun it guards`, () => {
      expect(isDoc(bindingValueOf(nodeOf(session.env, address))),
        `${address} is declared by a site of the runtime and no source of the language pages it under its noun`
      ).toBe(true);
    });
  }
});

describe('every refusal the catalog pages is declared by a site of the runtime', () => {
  for (const address of refusalPages) {
    it(`${address} is declared by its site`, () => {
      expect(declared.has(address), `${address} has a page and no site under core/src declares it`).toBe(true);
    });
  }

  it('the root holds the topic of the language and its kinds', () => {
    expect(nodeOf(session.env, 'qlang')).not.toBeNull();
    expect(isDoc(bindingValueOf(nodeOf(session.env, 'number')))).toBe(true);
  });
});
