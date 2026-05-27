// String → qlang-value parser impls for the `:cli/parse` host
// catalog — `parseJson` for plain JSON (lossy on qlang-only
// types), `parseTjson` for the tagged-JSON wire format. Catalog
// declaration lives in `cli/lib/qlang/parse.qlang`.

import { nullaryOp } from '@kaluchi/qlang-core/dispatch';
import {
  declareSubjectError,
  declareShapeError
} from '@kaluchi/qlang-core/operand-errors';
import { fromPlain, fromTaggedJSON } from '@kaluchi/qlang-core';

const ParseJsonSubjectNotStringError =
  declareSubjectError('ParseJsonSubjectNotStringError', 'parseJson', 'string');
const ParseJsonInvalidJsonError =
  declareShapeError('ParseJsonInvalidJsonError',
    ({ message }) => `parseJson: invalid JSON — ${message}`);

const ParseTjsonSubjectNotStringError =
  declareSubjectError('ParseTjsonSubjectNotStringError', 'parseTjson', 'string');
const ParseTjsonInvalidJsonError =
  declareShapeError('ParseTjsonInvalidJsonError',
    ({ message }) => `parseTjson: invalid tagged-JSON — ${message}`);

const parseJsonOperand = nullaryOp('parseJson', (subject) => {
  if (typeof subject !== 'string') {
    throw new ParseJsonSubjectNotStringError(subject);
  }
  let parsed;
  try {
    parsed = JSON.parse(subject);
  } catch (jsParseError) {
    throw new ParseJsonInvalidJsonError({ message: jsParseError.message });
  }
  return fromPlain(parsed);
});

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
  parseJson:  parseJsonOperand,
  parseTjson: parseTjsonOperand
};
