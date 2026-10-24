// [QSQUO#apply]

import { registerPrimitive, registerStateReader, runsAsCode } from '../primitives.mjs';
import { parseSource } from '../parse.mjs';
import { printQuoteSource } from '../print-value.mjs';
import { errorFromParse } from '../error-convert.mjs';
import { declareRefusal } from '../errors.mjs';
import { isFn } from '../types.mjs';
import { codeOf, applyFunction } from '../eval.mjs';

const AnyApplyArgsNotTakenError = declareRefusal('any/apply/args/NotTakenError');

// [QSQUO#parse]
registerStateReader('string/parse', (source, state) => {
  try {
    return parseSource(source, { uri: 'string/parse' });
  } catch (parseErr) {
    return errorFromParse(parseErr, state.scope);
  }
});
registerPrimitive('quote/toString', quote => printQuoteSource(quote));

registerStateReader('any/apply', runsAsCode(['code'], async (subject, code, args, state) => {
  if (isFn(code)) return await applyFunction(code, subject, args, state);
  if (args.length > 0) throw new AnyApplyArgsNotTakenError({ actualValue: args });
  return await code(subject);
}));

// [QSQUO#held]
registerStateReader('quote/open', async (query, state) => await codeOf(query, state)(null));
