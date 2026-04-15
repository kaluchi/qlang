// Pure value-to-String formatters the CLI binds alongside the I/O
// operands. Each formatter takes the pipeValue subject and returns
// a rendered String; chaining them in front of `@out` is how a
// query produces stdout.
//
// Operands:
//
//   `pretty`        any subject → String, the canonical
//                   qlang-literal display form (printValue
//                   exposed as an operand). Round-trips through
//                   parse + eval back to the same value.
//
//   `tjson`         any subject → String, the tagged-JSON wire
//                   format from core's codec.mjs. Round-trips
//                   through `parseTjson` so two qlang processes
//                   chained over a Unix pipe preserve identity
//                   for keyword / Set / Map / error values that
//                   plain JSON cannot represent.
//
//   `template(:s)`  any subject + String captured → String.
//                   `{{.}}` substitutes the whole subject;
//                   `{{key}}` projects the keyword `:key` from a
//                   Map subject; `{{a/b/c}}` chains projections.
//                   String-typed substitutions embed as raw
//                   characters (so URLs and names appear without
//                   surrounding quotes); every other type renders
//                   via printValue. Missing fields render as
//                   `null`. The captured arg must be a String.
//
// The format family rounds out as concrete user demands surface;
// `ndjson` is intentionally absent — the qlang composition
// `vec * json | join("\n")` already yields the same byte sequence
// without a dedicated operand.

import { valueOp, nullaryOp } from '@kaluchi/qlang-core/dispatch';
import {
  declareModifierError
} from '@kaluchi/qlang-core/operand-errors';
import {
  printValue,
  toTaggedJSON,
  keyword,
  describeType
} from '@kaluchi/qlang-core';

// ── Per-site error classes ─────────────────────────────────────

const TemplateModifierNotString =
  declareModifierError('TemplateModifierNotString', 'template', 1, 'String');

// ── template — substitute pipeline values into a String ────────

const TEMPLATE_PLACEHOLDER = /\{\{([^}]+)\}\}/g;

function renderTemplatePlaceholder(subject, placeholderExpr) {
  const trimmedExpr = placeholderExpr.trim();
  if (trimmedExpr === '.') {
    return typeof subject === 'string' ? subject : printValue(subject);
  }
  const projectionSegments = trimmedExpr.split('/').filter((s) => s.length > 0);
  let projectedValue = subject;
  for (const segmentName of projectionSegments) {
    if (!(projectedValue instanceof Map)) {
      projectedValue = null;
      break;
    }
    const lookedUp = projectedValue.get(keyword(segmentName));
    projectedValue = lookedUp === undefined ? null : lookedUp;
  }
  if (projectedValue === null) return 'null';
  return typeof projectedValue === 'string' ? projectedValue : printValue(projectedValue);
}

function applyTemplate(subject, templateString) {
  return templateString.replace(TEMPLATE_PLACEHOLDER, (_match, placeholderExpr) =>
    renderTemplatePlaceholder(subject, placeholderExpr));
}

// ── Operand factories ──────────────────────────────────────────

const prettyOperand = nullaryOp('pretty', (subject) => printValue(subject));

const tjsonOperand  = nullaryOp('tjson',  (subject) => JSON.stringify(toTaggedJSON(subject)));

// valueOp arity 2 = subject + 1 captured. Partial form fills the
// subject from pipeValue; full form (both captured) lets the
// captured args evaluate against the outer pipeValue. Only the
// partial form is exercised by the existing tests, but the
// dispatcher honours both shapes for free.
const templateOperand = valueOp('template', 2, (subject, templateString) => {
  if (typeof templateString !== 'string') {
    throw new TemplateModifierNotString(describeType(templateString), templateString);
  }
  return applyTemplate(subject, templateString);
});

// ── Binding ────────────────────────────────────────────────────

export function bindFormatOperands(session) {
  session.bind('pretty',   prettyOperand);
  session.bind('tjson',    tjsonOperand);
  session.bind('template', templateOperand);
}
