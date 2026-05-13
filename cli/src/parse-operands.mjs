// String → qlang-value parsers the CLI binds alongside the format
// operands. Two parsers, each for a different communication scenario:
//
//   `parseJson`   — bridge to the external world. Accepts plain JSON
//                   (curl, kubectl, gh, jq output, hand-written .json
//                   files). Object keys become qlang keywords; arrays
//                   become Vecs; scalars pass through. Lossy with
//                   respect to qlang-only types — Sets become Vecs,
//                   keyword-as-value can not be distinguished from a
//                   String, error values have no plain-JSON form.
//
//   `parseTjson`  — bridge between qlang processes. Accepts the
//                   tagged-JSON wire format from core's codec.mjs;
//                   round-trippable with `tjson | @out`. `$keyword`,
//                   `$map`, `$set`, `$error` markers preserve every
//                   qlang-only type so identity is restored.
//
// Both parsers report parse failures as fail-track error values via
// per-site classes, never as raw JS SyntaxErrors — the user code can
// inspect via `!| /thrown` or `!| /message` like any other qlang
// operand error.

import { nullaryOp } from '@kaluchi/qlang-core/dispatch';
import {
  declareSubjectError,
  declareShapeError
} from '@kaluchi/qlang-core/operand-errors';
import {
  fromPlain,
  fromTaggedJSON
} from '@kaluchi/qlang-core';
import { bindHostBuiltin } from './host-builtin.mjs';

// ── Per-site error classes ─────────────────────────────────────

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

// ── Operand factories ──────────────────────────────────────────

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

// ── Binding ────────────────────────────────────────────────────

export function bindParseOperands(session) {
  bindHostBuiltin(session, 'parseJson',  parseJsonOperand);
  bindHostBuiltin(session, 'parseTjson', parseTjsonOperand);
}
