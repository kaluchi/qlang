// The primitive of `parseTjson`, a verb of the noun `::qlang/cli` [D92]
// that reads the tagged JSON `tjson` writes, where the core's `parseJson`
// reads plain JSON; a plain function over the string its head checks
// [D80].

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
