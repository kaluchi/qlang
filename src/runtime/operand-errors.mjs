// Per-site error classes for runtime operands.
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
// position + condition: `FilterSubjectNotVec`, `AddLeftNotNumber`,
// `SortElementsNotComparable`, and so on.

import {
  QlangTypeError,
  ArityError
} from '../errors.mjs';

// ── Factory primitives ─────────────────────────────────────────

function brand(cls, name) {
  Object.defineProperty(cls, 'name', { value: name });
  return cls;
}

// declareSubjectError — thrown when an operand receives a subject
// value whose type is not acceptable.
export function declareSubjectError(className, operand, expectedType) {
  const Cls = class extends QlangTypeError {
    constructor(actualType, actualValue) {
      super(
        `${operand} requires ${expectedType} subject, got ${actualType}`,
        {
          site: className,
          operand,
          position: 'subject',
          expectedType,
          actualType,
          actualValue
        }
      );
      this.name = className;
    }
  };
  return brand(Cls, className);
}

// declareModifierError — thrown when a captured argument has the
// wrong type at a specific numeric position.
export function declareModifierError(className, operand, position, expectedType) {
  const Cls = class extends QlangTypeError {
    constructor(actualType, actualValue) {
      super(
        `${operand} expects ${expectedType} at position ${position}, got ${actualType}`,
        {
          site: className,
          operand,
          position,
          expectedType,
          actualType,
          actualValue
        }
      );
      this.name = className;
    }
  };
  return brand(Cls, className);
}

// declareElementError — thrown when a specific element of a
// collection subject has the wrong type.
export function declareElementError(className, operand, expectedType) {
  const Cls = class extends QlangTypeError {
    constructor(index, actualType, actualValue) {
      super(
        `${operand}: element ${index} expects ${expectedType}, got ${actualType}`,
        {
          site: className,
          operand,
          index,
          expectedType,
          actualType,
          actualValue
        }
      );
      this.name = className;
    }
  };
  return brand(Cls, className);
}

// declareComparabilityError — thrown when an ordering or
// shape-matching check fails.
export function declareComparabilityError(className, operand) {
  const Cls = class extends QlangTypeError {
    constructor(leftType, rightType) {
      super(
        `${operand} cannot compare ${leftType} with ${rightType}`,
        {
          site: className,
          operand,
          leftType,
          rightType
        }
      );
      this.name = className;
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
      const message = buildMessage(context);
      super(message, { site: className, ...context });
      this.name = className;
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
      const message = buildMessage(context);
      super(message, { site: className, ...context });
      this.name = className;
    }
  };
  return brand(Cls, className);
}
