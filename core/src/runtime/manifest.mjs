// [QSDSP#walk], [QSDSP#residence]

import { registerStateReader } from '../primitives.mjs';
import { isErrorValue, bindingValueOf, makeTag, errorAtRest, beneathTags } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { codeOf } from '../eval.mjs';
import { rootOf, withScope } from '../state.mjs';
import { recordReadBy, pageOfRecord } from './axis.mjs';
import { namesUnder, lawsUnder, rootScopeOf } from '../nouns.mjs';

// [QSSLF#manifest]
const AnyManifestUnknownNameError = declareRefusal('any/manifest/UnknownNameError');
registerStateReader('any/manifest', (subject, anchor, state) =>
  namesUnder(state.scope, recordReadBy(subject, anchor, state, AnyManifestUnknownNameError).get('name').name));

// [QSSLF#laws]
const AnyLawsUnknownNameError = declareRefusal('any/laws/UnknownNameError');
registerStateReader('any/laws', (subject, anchor, state) => {
  const address = recordReadBy(subject, anchor, state, AnyLawsUnknownNameError).get('name').name;
  return new Map(lawsUnder(state.scope, address).map(([lastName, record]) =>
    [lastName, Object.freeze([pageOfRecord(record), bindingValueOf(record).payload])]));
});

// [QSSLF#laws], [QSERR#catch]
async function runLaw({ law, quote, says }, callerState) {
  const result = new Map();
  result.set('law', law);
  result.set('says', says);
  const actualValue = await codeOf(quote, callerState)(null);
  if (isErrorValue(actualValue)) {
    result.set('actual', null);
    result.set('error', errorAtRest(actualValue.tag, new Map(actualValue.facts)));
    result.set('ok', false);
    return result;
  }
  result.set('actual', actualValue);
  result.set('error', null);
  result.set('ok', beneathTags(actualValue) === true);
  return result;
}

// [QSSLF#laws]
async function resultsOfLaws(subject, anchor, state, UnknownNameError) {
  const address = recordReadBy(subject, anchor, state, UnknownNameError).get('name').name;
  const root = rootOf(state.scope);
  const claims = lawsUnder(state.scope, address).map(([lastName, lawRecord]) => ({
    law: makeTag(`${address}/${lastName}`),
    quote: beneathTags(bindingValueOf(lawRecord).payload),
    says: pageOfRecord(lawRecord),
    ofTheRoot: root.get(`${address}/${lastName}`) === lawRecord
  }));
  const results = [];
  for (const claim of claims) results.push(await runLaw(claim, claim.ofTheRoot ? withScope(state, rootScopeOf(state.scope)) : state));
  return results;
}

const AnyRunLawsUnknownNameError = declareRefusal('any/runLaws/UnknownNameError');
registerStateReader('any/runLaws', (subject, anchor, state) => resultsOfLaws(subject, anchor, state, AnyRunLawsUnknownNameError));
