// Pure value-to-String formatter impls for the `:cli/format` host
// catalog — `pretty` renders qlang-literal form, `tjson` renders
// the tagged-JSON wire form, `template(:s)` does `{{slot}}`
// substitution. Catalog declaration lives in
// `cli/lib/qlang/format.qlang`.

import { valueOp, nullaryOp } from '@kaluchi/qlang-core/dispatch';
import { declareModifierError } from '@kaluchi/qlang-core/operand-errors';
import { printValue, toTaggedJSON } from '@kaluchi/qlang-core';

const TemplateModifierNotStringError =
  declareModifierError('TemplateModifierNotStringError', 'template', 1, 'string');

const SUBSTITUTION_SLOT_RE = /\{\{([^}]+)\}\}/g;

function renderSubstitutionSlot(subject, slotSource) {
  const slotPath = slotSource.trim();
  if (slotPath === '.') {
    return typeof subject === 'string' ? subject : printValue(subject);
  }
  const projectionSegments = slotPath.split('/').filter((s) => s.length > 0);
  let projectedValue = subject;
  for (const segmentName of projectionSegments) {
    if (!(projectedValue instanceof Map)) {
      projectedValue = null;
      break;
    }
    const lookedUp = projectedValue.get(segmentName);
    projectedValue = lookedUp === undefined ? null : lookedUp;
  }
  if (projectedValue === null) return 'null';
  return typeof projectedValue === 'string' ? projectedValue : printValue(projectedValue);
}

function applyTemplate(subject, templateString) {
  return templateString.replace(SUBSTITUTION_SLOT_RE, (_match, slotSource) =>
    renderSubstitutionSlot(subject, slotSource));
}

const prettyOperand = nullaryOp('pretty', (subject) => printValue(subject));
const tjsonOperand  = nullaryOp('tjson',  (subject) => JSON.stringify(toTaggedJSON(subject)));
const templateOperand = valueOp('template', 2, (subject, templateString) => {
  if (typeof templateString !== 'string') {
    throw new TemplateModifierNotStringError(templateString);
  }
  return applyTemplate(subject, templateString);
});

export const formatImpls = {
  pretty:   prettyOperand,
  tjson:    tjsonOperand,
  template: templateOperand
};
