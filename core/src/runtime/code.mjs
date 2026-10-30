// [QSQUO#apply]

import { registerPrimitive, registerStateReader, runsAsCode } from '../primitives.mjs';
import { parseSource } from '../parse.mjs';
import { printQuoteSource } from '../print-value.mjs';
import { declareRefusal } from '../errors.mjs';
import { isFn, makeKeyword, makeQuote } from '../types.mjs';
import { codeOf, applyFunction, refusalOfAParse } from '../eval.mjs';
import { declarationStep, namesAQuoteReads } from '../steps.mjs';
import { nearestOf } from '../nearness.mjs';

const AnyApplyArgsNotTakenError = declareRefusal('any/apply/ArgsNotTakenError');

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

// [QSQUO#held]
const QuoteFillNamesNameNotReadError = declareRefusal('quote/fill/NamesNameNotReadError');

registerPrimitive('quote/fill', (quote, names) => {
  const read = namesAQuoteReads(quote);
  for (const name of names.keys()) {
    if (!read.includes(name)) throw new QuoteFillNamesNameNotReadError({ name: makeKeyword(name), nearest: Object.freeze(nearestOf(read, name).map(makeKeyword)) });
  }
  return makeQuote([...read.filter(name => names.has(name)).map(name => declarationStep(name, [], names.get(name))), ...quote]);
});
