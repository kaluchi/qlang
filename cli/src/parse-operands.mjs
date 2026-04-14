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
  keyword,
  describeType,
  fromTaggedJSON
} from '@kaluchi/qlang-core';

// ── Per-site error classes ─────────────────────────────────────

const ParseJsonSubjectNotString =
  declareSubjectError('ParseJsonSubjectNotString', 'parseJson', 'String');
const ParseJsonInvalidJson =
  declareShapeError('ParseJsonInvalidJson',
    ({ message }) => `parseJson: invalid JSON — ${message}`);

const ParseTjsonSubjectNotString =
  declareSubjectError('ParseTjsonSubjectNotString', 'parseTjson', 'String');
const ParseTjsonInvalidJson =
  declareShapeError('ParseTjsonInvalidJson',
    ({ message }) => `parseTjson: invalid tagged-JSON — ${message}`);

// ── jsonToQlang — recursive plain-JSON to qlang-shape lift ─────

// JSON object → Map with keyword keys; JSON array → Vec; scalars
// pass through. Mirrors the jdt-search module's same-named helper;
// kept inline here to avoid a CLI dependency on the jdt-search
// package and to keep the conversion adjacent to its sole consumer.
function jsonToQlang(jsonVal) {
  if (Array.isArray(jsonVal)) return jsonVal.map(jsonToQlang);
  if (jsonVal !== null && typeof jsonVal === 'object') {
    const qlangMap = new Map();
    for (const [jsonKey, nestedVal] of Object.entries(jsonVal)) {
      qlangMap.set(keyword(jsonKey), jsonToQlang(nestedVal));
    }
    return qlangMap;
  }
  return jsonVal;
}

// ── Operand factories ──────────────────────────────────────────

const parseJsonOperand = nullaryOp('parseJson', (subject) => {
  if (typeof subject !== 'string') {
    throw new ParseJsonSubjectNotString(describeType(subject), subject);
  }
  let parsed;
  try {
    parsed = JSON.parse(subject);
  } catch (jsParseError) {
    throw new ParseJsonInvalidJson({ message: jsParseError.message });
  }
  return jsonToQlang(parsed);
});

const parseTjsonOperand = nullaryOp('parseTjson', (subject) => {
  if (typeof subject !== 'string') {
    throw new ParseTjsonSubjectNotString(describeType(subject), subject);
  }
  let parsed;
  try {
    parsed = JSON.parse(subject);
  } catch (jsParseError) {
    throw new ParseTjsonInvalidJson({ message: jsParseError.message });
  }
  return fromTaggedJSON(parsed);
});

// ── Binding ────────────────────────────────────────────────────

export function bindParseOperands(session) {
  session.bind('parseJson',  parseJsonOperand);
  session.bind('parseTjson', parseTjsonOperand);
}
