// `manifest` answers the nodes declared one name under a noun [D62],
// `laws`, `links` and `snippets` the definitions in each role under a
// name, and `runLaws` runs its laws, each primitive reading the state of
// the call [D79]; the axes of one binding live in `axis.mjs`.

import { bindStateReader } from '../primitives.mjs';
import { isErrorValue, bindingValueOf, makeTagKeyword, isValueClass, NULL } from '../types.mjs';
import { declareRefusal } from '../errors.mjs';
import { evalQuery } from '../eval.mjs';
import { recordReadBy, pageTextOfRecord } from './axis.mjs';
import { namesUnder, definitionsInRole } from './nouns.mjs';
import { printQuoteSource } from '../quote.mjs';


// The message of an error: its `:message` where it carries one, a raise's
// or a host's failure's, and the address of any other [D166], [D172].
function errorMessageOf(errorValue) {
  return errorValue.descriptor.get('message') ?? `::${errorValue.tag.name}`;
}

bindStateReader('tag/manifest', (subject, state) => namesUnder(state.env, subject.name));

// The definitions in a role under the address of the record a value reads,
// as `doc` reads it: each one's last name and its value, in the order of
// their declarations, a law a claim, a link a page to open and a snippet a
// query to run [D169], [D174].
function inRole(roleName, UnknownNameError) {
  return (subject, state) => {
    const address = recordReadBy(subject, NULL, state, UnknownNameError).get('name').name;
    return new Map(definitionsInRole(state.env, address, roleName).map(([lastName, record]) => [lastName, bindingValueOf(record)]));
  };
}

const AnyLawsUnknownNameError = declareRefusal('any/laws/UnknownNameError');
const AnyLinksUnknownNameError = declareRefusal('any/links/UnknownNameError');
const AnySnippetsUnknownNameError = declareRefusal('any/snippets/UnknownNameError');
bindStateReader('any/laws', inRole('law', AnyLawsUnknownNameError));
bindStateReader('any/links', inRole('link', AnyLinksUnknownNameError));
bindStateReader('any/snippets', inRole('snippet', AnySnippetsUnknownNameError));

// A law runs one frame below the step in the caller's scope, the root
// among it, and passes when it answers true [D14]; its result names the
// law by its address and the claim it proves by its page [D124], [D174].
async function runQuoteEntry({ law, quote, says }, callerState) {
  const result = new Map();
  result.set('law', law);
  result.set('says', says);
  const actualValue = await evalQuery(printQuoteSource(quote), callerState.env, callerState);
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

// A name reads its record as the axes do, a keyword after it the member
// it holds, `::qlang | runLaws :values` [D124]: the laws declared under
// its address [D174].
async function resultsOfLaws(subject, anchor, state, UnknownNameError) {
  const address = recordReadBy(subject, anchor, state, UnknownNameError).get('name').name;
  const claims = definitionsInRole(state.env, address, 'law').map(([lastName, lawRecord]) => ({
    law: makeTagKeyword(`${address}/${lastName}`),
    quote: lawQuoteOf(bindingValueOf(lawRecord)),
    says: pageTextOfRecord(lawRecord)
  }));
  const entries = [];
  for (const claim of claims) entries.push(await runQuoteEntry(claim, state));
  return entries;
}

// The quote beneath the tags of a law, a host's tag over it among them.
function lawQuoteOf(value) {
  let beneath = value;
  while (isValueClass(beneath, 'taggedInstance')) beneath = beneath.payload;
  return beneath;
}

const TagRunLawsUnknownNameError = declareRefusal('tag/runLaws/UnknownNameError');
const KeywordRunLawsUnknownNameError = declareRefusal('keyword/runLaws/UnknownNameError');
bindStateReader('tag/runLaws', (subject, anchor, state) => resultsOfLaws(subject, anchor, state, TagRunLawsUnknownNameError));
bindStateReader('keyword/runLaws', (subject, anchor, state) => resultsOfLaws(subject, anchor, state, KeywordRunLawsUnknownNameError));
