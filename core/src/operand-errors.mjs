// Per-site error class factories — shared infrastructure for every
// operand throw site in the runtime plus the Rule 10 arity check in
// `rule10.mjs` and the AST-dispatch shape checks in `eval.mjs`. Lives
// at the `src/` root because both the core evaluator modules and
// every `runtime/*.mjs` operand impl consume the factories below;
// the `src/` root sits upstream of both layers so the imports flow
// inward consistently.
//
// Principle: **one throw site, one class**. No error class is
// shared across two different operand sites. Each check raises an
// exception whose class name uniquely identifies where it fired,
// so a stack trace or `instanceof` check pinpoints the failure
// without scraping the message string.
//
// Classes are built by small factories. Every generated typeError
// class extends `QlangTypeError` so `instanceof QlangTypeError`
// holds and `.kind` reads `typeError`; every generated arityError
// class extends `ArityError` with `.kind === 'arityError'`. The
// concrete class narrows the throw site to a single operand +
// position + condition: `FilterSubjectNotContainerError`, `AddLeftNotNumberError`,
// `SortElementsNotComparable`, and so on.

import {
  QlangTypeError,
  ArityError
} from './errors.mjs';
import { typeKeyword } from './types.mjs';

// ── Factory primitives ─────────────────────────────────────────

function brand(cls, name) {
  Object.defineProperty(cls, 'name', { value: name });
  return cls;
}

// expectedType authoring form is one or more qlang type-keyword
// names — `'number'`, `'vec'`, or `['vec', 'set', 'map']`. The
// factory lowers each form to a humanised string ("Number",
// "Vec or Set", "Vec, Set, or Map") for the diagnostic message
// body. The structured Keyword form lives on the tag-binding's
// catalog `::Tag ::builtin{:expectedType :number}` body; consumers
// reach it through `result !| type | spec | /expectedType`.
function lowerExpectedTypeHuman(input) {
  const names = Array.isArray(input) ? input : [input];
  const caps = names.map(name => name.charAt(0).toUpperCase() + name.slice(1));
  if (caps.length === 1) return caps[0];
  if (caps.length === 2) return `${caps[0]} or ${caps[1]}`;
  return caps.slice(0, -1).join(', ') + ', or ' + caps[caps.length - 1];
}

// Per-site identity rides on `this.name` / `this.fingerprint`,
// stamped by every factory below from its `className` argument. The
// context bag carries only structured data the throw site wants the
// downstream catch (or the user-facing :trail descriptor) to read —
// no `site` field, because that would duplicate the tag identity
// without adding information.

// declareSubjectError — thrown when an operand receives a subject
// value whose type is not acceptable. `operand` / `position` /
// `expectedType` are per-tag static constants — the catalog body
// `::TagName ::builtin{:category :typeError :operand :op
// :position :subject :expectedType :type}` holds them and the
// `spec` axis returns them on demand (`::TagName | spec | /operand`).
// JS-side context carries only dynamic facts.
export function declareSubjectError(className, operand, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  const Cls = class extends QlangTypeError {
    constructor(actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} requires ${expectedTypeHuman} subject, got ${actualType.name}`,
        { actualType, actualValue }
      );
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareModifierError — thrown when a captured argument has the
// wrong type at a specific numeric position. Per-tag static
// (`:operand` / `:position` / `:expectedType`) lives in the catalog
// body; JS context carries only `:actualType` / `:actualValue`.
export function declareModifierError(className, operand, position, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  const Cls = class extends QlangTypeError {
    constructor(actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} expects ${expectedTypeHuman} at position ${position}, got ${actualType.name}`,
        { actualType, actualValue }
      );
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareElementError — thrown when a specific element of a
// collection subject has the wrong type. Per-tag static `:operand` /
// `:expectedType` lives in the catalog body; per-instance `:index`
// stays in JS context because it varies per throw.
export function declareElementError(className, operand, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  const Cls = class extends QlangTypeError {
    constructor(index, actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand}: element ${index} expects ${expectedTypeHuman}, got ${actualType.name}`,
        { index, actualType, actualValue }
      );
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareComparabilityError — thrown when an ordering or
// shape-matching check fails. Per-tag static `:operand` lives in the
// catalog body; JS context carries the pairwise dynamic types.
export function declareComparabilityError(className, operand) {
  const Cls = class extends QlangTypeError {
    constructor(leftValue, rightValue) {
      const leftType = typeKeyword(leftValue);
      const rightType = typeKeyword(rightValue);
      super(
        `${operand} cannot compare ${leftType.name} with ${rightType.name}`,
        { leftType, rightType }
      );
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareShapeError — thrown by a site with custom diagnostic
// wording that does not fit the pattern-based factories above.
// The class still carries structured context and a unique site
// name for debugging.
export function declareShapeError(className, buildMessage) {
  const Cls = class extends QlangTypeError {
    constructor(context = {}) {
      super(buildMessage(context), context);
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareArityError — thrown by a site whose failure is an
// incorrect captured-arg count (too few, too many, or an unsupported
// specific count). Extends ArityError so `.kind === 'arityError'`
// and `instanceof ArityError` both match, while the concrete
// per-site class still identifies the throw location uniquely.
export function declareArityError(className, buildMessage) {
  const Cls = class extends ArityError {
    constructor(context = {}) {
      super(buildMessage(context), context);
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}
