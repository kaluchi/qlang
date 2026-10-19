// The refusals of the runtime and their pages in the catalog. A refusal names
// itself in two planes: in the JavaScript, where its site declares it by its
// address, and in the tree of names, where a source of the language pages it
// under the noun of the place it guards, with the prose, the facts and the
// laws a reader reaches through `doc` [QSNAM#address], [QSERR#site]. Nothing
// in the language forces the two to exist in pairs, so a renamed address or a
// fresh site without a page drifts silently, and surfaces to a reader as `!|
// type | doc` answering a refusal of its own.

import { describe, it, expect } from 'vitest';
import { createSession } from '../../src/session.mjs';
import { declaredRefusals } from '../../src/errors.mjs';
import { declaresALabel, isVerb, nodeOf, ruleRefusalsOf } from '../../src/nouns.mjs';
import { splitAddress } from '../../src/address.mjs';
import { ROOT_KEY } from '../../src/scope-keys.mjs';
import { bindingValueOf, isDoc, isKind } from '../../src/types.mjs';

const session = await createSession();
const declared = new Set(declaredRefusals());

// The refusals the verbs and the kinds of the root raise by rule, which their
// definitions page as the declared ones are paged [QSERR#site].
const ruleBorn = new Set([...session.scope.get(ROOT_KEY).keys()]
  .filter(address => isVerb(session.scope, address) || isKind(bindingValueOf(nodeOf(session.scope, address))))
  .flatMap(address => ruleRefusalsOf(session.scope, address)));

// The refusals the root pages under a noun,
// `number/add/SubjectNotNumberError`.
const refusalPages = [];
for (const [address, record] of session.scope.get(ROOT_KEY)) {
  const [nounName, name] = splitAddress(address);
  if (nounName !== null && /Error$/.test(name) && isDoc(bindingValueOf(record))) refusalPages.push(address);
}

describe('every refusal a site of the runtime declares has its page under its noun [QSNAM#address]', () => {
  for (const address of declared) {
    it(`${address} is paged under the noun it guards`, () => {
      expect(isDoc(bindingValueOf(nodeOf(session.scope, address))),
        `${address} is declared by a site of the runtime and no source of the language pages it under its noun`
      ).toBe(true);
    });
  }
});

describe('every refusal the catalog pages is declared by a site of the runtime or raised by rule', () => {
  for (const address of refusalPages) {
    it(`${address} is declared by its site or raised by rule`, () => {
      expect(declared.has(address) || ruleBorn.has(address), `${address} has a page, no site under core/src declares it and no rule raises it`).toBe(true);
    });
  }

  it('the root holds the topic of the language and its kinds', () => {
    expect(nodeOf(session.scope, 'qlang')).not.toBeNull();
    expect(declaresALabel(nodeOf(session.scope, 'number'))).toBe(true);
  });
});
