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
// Classes are built by small factories. Every generated type-error
// class extends `QlangTypeError` so `instanceof QlangTypeError`
// holds and `.kind` reads `type-error`; every generated arity-error
// class extends `ArityError` with `.kind === 'arity-error'`. The
// concrete class narrows the throw site to a single operand +
// position + condition: `FilterSubjectNotContainerError`, `AddLeftNotNumberError`,
// `SortElementsNotComparable`, and so on.

import {
  QlangTypeError,
  ArityError
} from './errors.mjs';
import { typeKeyword, keyword as makeKeyword } from './types.mjs';

// ── Factory primitives ─────────────────────────────────────────

function brand(cls, name) {
  Object.defineProperty(cls, 'name', { value: name });
  return cls;
}

// expectedType authoring form is one or more qlang type-keyword
// names — `'number'`, `'vec'`, or `['vec', 'set', 'map']`. The
// factory lowers each form to (a) a context value (single Keyword
// or frozen Vec of Keywords) for the structured `:expectedType`
// field, and (b) a humanised string ("Number", "Vec or Set",
// "Vec, Set, or Map") for the diagnostic message body.
function lowerExpectedType(input) {
  const names = Array.isArray(input) ? input : [input];
  const value = names.length === 1
    ? makeKeyword(names[0])
    : Object.freeze(names.map(makeKeyword));
  const human = formatExpectedTypeHuman(names);
  return { value, human };
}

function capitalise(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatExpectedTypeHuman(names) {
  const caps = names.map(capitalise);
  if (caps.length === 1) return caps[0];
  if (caps.length === 2) return `${caps[0]} or ${caps[1]}`;
  return caps.slice(0, -1).join(', ') + ', or ' + caps[caps.length - 1];
}

// Per-site identity rides on `this.name` / `this.fingerprint`,
// stamped by every factory below from its `className` argument. The
// context bag carries only structured data the throw site wants the
// downstream catch (or the user-facing :trail descriptor) to read —
// no `site` field, because that would duplicate the class identity
// without adding information.

// declareSubjectError — thrown when an operand receives a subject
// value whose type is not acceptable.
export function declareSubjectError(className, operand, expectedTypeInput) {
  const expectedType = lowerExpectedType(expectedTypeInput);
  const Cls = class extends QlangTypeError {
    constructor(actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} requires ${expectedType.human} subject, got ${actualType.name}`,
        {
          operand,
          position: 'subject',
          expectedType: expectedType.value,
          actualType,
          actualValue
        }
      );
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareModifierError — thrown when a captured argument has the
// wrong type at a specific numeric position.
export function declareModifierError(className, operand, position, expectedTypeInput) {
  const expectedType = lowerExpectedType(expectedTypeInput);
  const Cls = class extends QlangTypeError {
    constructor(actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} expects ${expectedType.human} at position ${position}, got ${actualType.name}`,
        {
          operand,
          position,
          expectedType: expectedType.value,
          actualType,
          actualValue
        }
      );
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareElementError — thrown when a specific element of a
// collection subject has the wrong type.
export function declareElementError(className, operand, expectedTypeInput) {
  const expectedType = lowerExpectedType(expectedTypeInput);
  const Cls = class extends QlangTypeError {
    constructor(index, actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand}: element ${index} expects ${expectedType.human}, got ${actualType.name}`,
        {
          operand,
          index,
          expectedType: expectedType.value,
          actualType,
          actualValue
        }
      );
      this.name = className;
      this.fingerprint = className;
    }
  };
  return brand(Cls, className);
}

// declareComparabilityError — thrown when an ordering or
// shape-matching check fails.
export function declareComparabilityError(className, operand) {
  const Cls = class extends QlangTypeError {
    constructor(leftValue, rightValue) {
      const leftType = typeKeyword(leftValue);
      const rightType = typeKeyword(rightValue);
      super(
        `${operand} cannot compare ${leftType.name} with ${rightType.name}`,
        {
          operand,
          leftType,
          rightType
        }
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
// specific count). Extends ArityError so `.kind === 'arity-error'`
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
