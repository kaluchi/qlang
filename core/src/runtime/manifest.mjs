// `manifest` answers the nodes declared one name under a noun [D34],
// `laws` the laws declared under a name and `runLaws` runs them, each
// primitive reading the state of the call [D79]; the axes of one binding
// live in `axis.mjs`.

import { bindStateReader } from '../primitives.mjs';
import { isErrorValue, bindingValueOf, makeTag, errorAtRest, NULL } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { codeOf } from '../eval.mjs';
import { rootOf, withEnv } from '../state.mjs';
import { recordReadBy, pageOfRecord } from './axis.mjs';
import { namesUnder, lawsUnder, rootScopeOf } from './nouns.mjs';


bindStateReader('tag/manifest', (subject, state) => namesUnder(state.env, subject.name));

// The laws declared under the address of the record a value reads, as
// `doc` reads it: each one's last name and the pair of its page, null for
// a law without one, and its query, in the order of their declarations
// [D123].
const AnyLawsUnknownNameError = declareRefusal('any/laws/UnknownNameError');
bindStateReader('any/laws', (subject, state) => {
  const address = recordReadBy(subject, NULL, state, AnyLawsUnknownNameError).get('name').name;
  return new Map(lawsUnder(state.env, address).map(([lastName, record]) =>
    [lastName, Object.freeze([pageOfRecord(record), bindingValueOf(record).payload])]));
});

// A law runs as `apply` runs held code, one frame below the step, a law of
// a name the root declares in a lane over the root alone, as a word of the
// root runs in the root's scope [D278], and passes when it answers true
// [D14]; its result names the law by its address and
// the claim it proves by its page [D123], [D124], and holds the error it
// answered at rest, as `!|` grounds it [D13], [D220].
async function runLaw({ law, quote, says }, callerState) {
  const result = new Map();
  result.set('law', law);
  result.set('says', says);
  const actualValue = await codeOf(quote, callerState)(null);
  if (isErrorValue(actualValue)) {
    result.set('actual', null);
    result.set('error', errorAtRest(actualValue.tag, new Map(actualValue.descriptor)));
    result.set('ok', false);
    return result;
  }
  result.set('actual', actualValue);
  result.set('error', null);
  result.set('ok', actualValue === true);
  return result;
}

// A value reads its record as the axes do, a name its own and any other
// value its kind's, a keyword after it the member it holds, `::qlang |
// runLaws :values` [D124]: the laws declared under its address [D123],
// [D178].
async function resultsOfLaws(subject, anchor, state, UnknownNameError) {
  const address = recordReadBy(subject, anchor, state, UnknownNameError).get('name').name;
  const root = rootOf(state.env);
  const claims = lawsUnder(state.env, address).map(([lastName, lawRecord]) => ({
    law: makeTag(`${address}/${lastName}`),
    quote: bindingValueOf(lawRecord).payload,
    says: pageOfRecord(lawRecord),
    ofTheRoot: root.get(`${address}/${lastName}`) === lawRecord
  }));
  const results = [];
  for (const claim of claims) results.push(await runLaw(claim, claim.ofTheRoot ? withEnv(state, rootScopeOf(state.env)) : state));
  return results;
}

const AnyRunLawsUnknownNameError = declareRefusal('any/runLaws/UnknownNameError');
bindStateReader('any/runLaws', (subject, anchor, state) => resultsOfLaws(subject, anchor, state, AnyRunLawsUnknownNameError));
