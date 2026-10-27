// [QSQUO#apply]

import { registerPrimitive, registerStateReader, runsAsCode } from '../primitives.mjs';
import { parseSource } from '../parse.mjs';
import { printQuoteSource } from '../print-value.mjs';
import { errorFromParse, spanOfLocation } from '../error-convert.mjs';
import { declareRefusal } from '../errors.mjs';
import { isFn, makeKeyword, makeQuote } from '../types.mjs';
import { codeOf, applyFunction, layTag } from '../eval.mjs';
import { rootState, rootOf } from '../state.mjs';
import { ROOT_KEY } from '../scope-keys.mjs';
import { declarationStep, namesAQuoteReads } from '../steps.mjs';
import { nearestOf } from '../nearness.mjs';

const AnyApplyArgsNotTakenError = declareRefusal('any/apply/ArgsNotTakenError');

// [QSSYN#refusal], [QSPRN#span]
export async function refusalOfAParse(parseError, scope, uri) {
  const ofTheRoot = rootState(null, new Map([[ROOT_KEY, rootOf(scope)]]));
  const location = parseError.location ? await layTag('span', spanOfLocation(parseError.location, parseError.source), ofTheRoot) : undefined;
  return errorFromParse(parseError, scope, location, uri);
}

// [QSQUO#parse]
registerStateReader('string/parse', async (source, state) => {
  try {
    return parseSource(source, { uri: 'string/parse' });
  } catch (parseErr) {
    return await refusalOfAParse(parseErr, state.scope);
  }
});
registerPrimitive('quote/toString', quote => printQuoteSource(quote));

registerStateReader('any/apply', runsAsCode(['code'], async (subject, code, args, state) => {
  if (isFn(code)) return await applyFunction(code, subject, args, state);
  if (args.length > 0) throw new AnyApplyArgsNotTakenError({});
  return await code(subject);
}));

// [QSQUO#held], [QSQUO#apply]
registerStateReader('quote/answer', async (query, state) => await codeOf(query, state)(null));

// [D471]
const QuoteFillNamesNameNotReadError = declareRefusal('quote/fill/NamesNameNotReadError');

registerPrimitive('quote/fill', (quote, names) => {
  const read = namesAQuoteReads(quote);
  for (const name of names.keys()) {
    if (!read.includes(name)) throw new QuoteFillNamesNameNotReadError({ name: makeKeyword(name), nearest: Object.freeze(nearestOf(read, name).map(makeKeyword)) });
  }
  return makeQuote([...read.filter(name => names.has(name)).map(name => declarationStep(name, [], names.get(name))), ...quote]);
});
