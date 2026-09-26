// String → qlang-value parser for the `:cli/parse` host catalog —
// `parseTjson` for the tagged-JSON wire format, where the core's
// `parseJson` reads plain JSON — a plain function over the string the
// head of its verb checks [D80]. Catalog declaration lives in
// `cli/lib/qlang/parse.qlang`.

import { declareSubjectError } from '@kaluchi/qlang-core/operand-errors';
import { declareShapeError } from '@kaluchi/qlang-core/errors';
import { fromTaggedJSON } from '@kaluchi/qlang-core';

declareSubjectError('ParseTjsonSubjectNotStringError', 'parseTjson', 'string');
const ParseTjsonInvalidJsonError =
  declareShapeError('ParseTjsonInvalidJsonError',
    ({ message }) => `parseTjson: invalid tagged-JSON — ${message}`,
  { operand: 'parseTjson' }
);

export const parseImpls = {
  parseTjson: subject => {
    let parsed;
    try {
      parsed = JSON.parse(subject);
    } catch (jsParseError) {
      throw new ParseTjsonInvalidJsonError({ message: jsParseError.message });
    }
    return fromTaggedJSON(parsed);
  }
};
