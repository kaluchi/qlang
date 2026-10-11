// `manifest` answers the nodes declared one name under a noun [D62],
// `laws` the laws declared under a name and `runLaws` runs them, each
// primitive reading the state of the call [D79]; the axes of one binding
// live in `axis.mjs`.

import { bindStateReader } from '../primitives.mjs';
import { isErrorValue, bindingValueOf, makeTag, NULL } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { codeOf } from '../eval.mjs';
import { recordReadBy, pageOfRecord, pageTextOfRecord } from './axis.mjs';
import { namesUnder, lawsUnder } from './nouns.mjs';


// The message of an error: its `:message` where it carries one, a raise's
// or a host's failure's, and the address of any other [D166], [D172].
function errorMessageOf(errorValue) {
  return errorValue.descriptor.get('message') ?? `::${errorValue.tag.name}`;
}

bindStateReader('tag/manifest', (subject, state) => namesUnder(state.env, subject.name));

// The laws declared under the address of the record a value reads, as
// `doc` reads it: each one's last name and the pair of its page, null for
// a law without one, and its query, in the order of their declarations
// [D174].
const AnyLawsUnknownNameError = declareRefusal('any/laws/UnknownNameError');
bindStateReader('any/laws', (subject, state) => {
  const address = recordReadBy(subject, NULL, state, AnyLawsUnknownNameError).get('name').name;
  return new Map(lawsUnder(state.env, address).map(([lastName, record]) =>
    [lastName, Object.freeze([pageOfRecord(record), bindingValueOf(record).payload])]));
});

// A law runs as `apply` runs code, one frame below the step, and passes
// when it answers true [D14]; its result names the law by its address and
// the claim it proves by its page [D124], [D174].
async function runLaw({ law, quote, says }, callerState) {
  const result = new Map();
  result.set('law', law);
  result.set('says', says);
  const actualValue = await codeOf(quote, callerState)(null);
  if (isErrorValue(actualValue)) {
    result.set('actual', null);
    result.set('error', errorMessageOf(actualValue));
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
// runLaws :values` [D124]: the laws declared under its address [D174],
// [D178].
async function resultsOfLaws(subject, anchor, state, UnknownNameError) {
  const address = recordReadBy(subject, anchor, state, UnknownNameError).get('name').name;
  const claims = lawsUnder(state.env, address).map(([lastName, lawRecord]) => ({
    law: makeTag(`${address}/${lastName}`),
    quote: bindingValueOf(lawRecord).payload,
    says: pageTextOfRecord(lawRecord)
  }));
  const results = [];
  for (const claim of claims) results.push(await runLaw(claim, state));
  return results;
}

const AnyRunLawsUnknownNameError = declareRefusal('any/runLaws/UnknownNameError');
bindStateReader('any/runLaws', (subject, anchor, state) => resultsOfLaws(subject, anchor, state, AnyRunLawsUnknownNameError));
