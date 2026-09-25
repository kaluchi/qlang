// String → qlang-value parser impl for the `:cli/parse` host
// catalog — `parseTjson` for the tagged-JSON wire format, where the
// core's `parseJson` reads plain JSON. Catalog declaration lives in
// `cli/lib/qlang/parse.qlang`.

import { nullaryOp } from '@kaluchi/qlang-core/dispatch';
import { declareSubjectError } from '@kaluchi/qlang-core/operand-errors';
import { declareShapeError } from '@kaluchi/qlang-core/errors';
import { fromTaggedJSON } from '@kaluchi/qlang-core';

const ParseTjsonSubjectNotStringError =
  declareSubjectError('ParseTjsonSubjectNotStringError', 'parseTjson', 'string');
const ParseTjsonInvalidJsonError =
  declareShapeError('ParseTjsonInvalidJsonError',
    ({ message }) => `parseTjson: invalid tagged-JSON — ${message}`,
  { operand: 'parseTjson' }
);

const parseTjsonOperand = nullaryOp('parseTjson', (subject) => {
  if (typeof subject !== 'string') {
    throw new ParseTjsonSubjectNotStringError(subject);
  }
  let parsed;
  try {
    parsed = JSON.parse(subject);
  } catch (jsParseError) {
    throw new ParseTjsonInvalidJsonError({ message: jsParseError.message });
  }
  return fromTaggedJSON(parsed);
});

export const parseImpls = {
  parseTjson: parseTjsonOperand
};
