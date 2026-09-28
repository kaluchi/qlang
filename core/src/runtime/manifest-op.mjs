// `manifest`, `runLaws` — reflective operands over the tree of
// names and the declarations it holds.
//
// `manifest` is asked of a noun and answers what lies below it in the
// tree of names, the nouns under its path and the verbs that live on
// it [D62], so `::qlang | manifest` lists the nouns of the core and of
// the hosts; a refusal is reached from the place it guards, its `/throws`
// [D64]. `runLaws` runs every law of the page of a named binding,
// yielding `{:law :actual :ok :error}` per law, so `::number | spec |
// /verbs * (runLaws * /ok)` runs the laws of the verbs of numbers
// [D123].
//
// The introspection surface for "what does THIS one binding do" is the
// axes in `axis.mjs` (`::vec/count | source` / `| doc` / `| spec`),
// which read the declaration where it was written.

import { bindStateReader } from '../primitives.mjs';
import { isErrorValue } from '../types.mjs';
import { declareShapeError } from '../errors.mjs';
import { declareSubjectError } from '../operand-errors.mjs';
import { evalQuery } from '../eval.mjs';
import { declaringRecordOf, lawsOfRecord, refusalOf } from './axis.mjs';
import { namesUnder } from './nouns.mjs';
import { printQuoteSource } from '../quote.mjs';

// `manifest` resides on `::tag` and `runLaws` on `::keyword` and
// `::tag`, each primitive reading the state of the call [D79].
declareSubjectError('ManifestSubjectNotTagError', 'manifest', 'tag');
const RunLawsBindingNotFoundError = declareShapeError('RunLawsBindingNotFoundError',
  ({ bindingName }) =>
    `runLaws: no binding-step found for '${bindingName}' across loaded modules`,
  { operand: 'runLaws' });

// Extract a human-readable message from an error value — runtime
// errors carry `.originalError`, user-created errors carry
// `:message` in the descriptor.
function errorMessageOf(errorValue) {
  if (errorValue.originalError) return errorValue.originalError.message;
  return errorValue.descriptor.get('message');
}

// `manifest` — asked of a noun, the set of what lies below it in the
// tree of names [D62].
bindStateReader('manifest', (subject, state) => namesUnder(state.env, subject.name));

// `runLaws` — execute every Quote segment in a binding's docs
// as a self-test expression.
//
// Each example evaluates one frame below the `runLaws` step,
// against the caller's env, with a null initial pipeValue: the
// snippet sees every module loaded through `use :ns` in the
// surrounding session, so `"no.such.Type" | @type !| type` under
// `use :jdt/graph` reaches the documented `::TypeNotFound`. Env
// immutability keeps the example's BindStep writes off the
// session env — `evalQuery` forges its own env through `envSet`
// when it stamps the inline-AST Quote. An example passes when it
// answers `true` [D14], and every other answer, an ErrorValue
// among them, counts as `:ok false`; the return is a Vec of result
// Maps, one per Quote segment.
async function runQuoteEntry(quote, callerState) {
  const result = new Map();
  result.set('law', quote);
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

// A name reads the record of its binding as the axes do, a tag name
// that no tag binds the record of the verb it addresses [D62], and a
// name that names no binding is refused as `doc` refuses it,
// with the addresses where the verbs of that name live.
function recordNamedBy(env, subject) {
  const record = declaringRecordOf(env, subject);
  if (record === null) throw new RunLawsBindingNotFoundError(refusalOf(env, subject));
  return record;
}

bindStateReader('runLaws', async (subject, state) => {
  const quotes = lawsOfRecord(recordNamedBy(state.env, subject));
  const entries = [];
  for (const exampleQuote of quotes) entries.push(await runQuoteEntry(exampleQuote, state));
  return entries;
});
