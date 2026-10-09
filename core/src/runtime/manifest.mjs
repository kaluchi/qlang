// `manifest` answers the nodes declared one name under a noun [D62],
// and `runLaws` runs the laws of a page, each primitive reading the state
// of the call [D79]; the axes of one binding live in `axis.mjs`.

import { bindStateReader } from '../primitives.mjs';
import { isErrorValue } from '../types.mjs';
import { declareShapeError } from '../errors.mjs';
import { evalQuery } from '../eval.mjs';
import { claimsOfRecord, recordReadBy } from './axis.mjs';
import { namesUnder } from './nouns.mjs';
import { printQuoteSource } from '../quote.mjs';

const AnyRunLawsBindingNotFoundError = declareShapeError('any/RunLawsBindingNotFoundError',
  ({ name }) =>
    `runLaws: no declaration found for ${name.literal}`,
  { operand: 'runLaws' });

// The message of an error: a site's its own, a raised one's `:message`,
// and the address of a refusal by address or of a raise without one
// [D166].
function errorMessageOf(errorValue) {
  if (errorValue.originalError) return errorValue.originalError.message;
  return errorValue.descriptor.get('message') ?? `::${errorValue.tag.name}`;
}

bindStateReader('tag/manifest', (subject, state) => namesUnder(state.env, subject.name));

// A law runs one frame below the step in the caller's scope, the root
// among it, and passes when it answers true [D14]; its result
// names the claim it proves [D124].
async function runQuoteEntry({ law: quote, says }, callerState) {
  const result = new Map();
  result.set('law', quote);
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
// it holds, `::qlang | runLaws :values` [D124].
bindStateReader(['tag/runLaws', 'keyword/runLaws'], async (subject, anchor, state) => {
  const claims = claimsOfRecord(recordReadBy(subject, anchor, state, AnyRunLawsBindingNotFoundError));
  const entries = [];
  for (const claim of claims) entries.push(await runQuoteEntry(claim, state));
  return entries;
});
