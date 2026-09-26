// Per-site error class factories for the operand slot checks — a
// subject, a captured argument at a numeric position, an element of
// a collection subject, a pair of shapes. Each one spells the
// operand, the slot it guards and the value-class it requires, and
// lowers that triple into both halves of the diagnostic: the
// human wording the message carries and the structured
// `:operand` / `:position` / `:expectedType` the throw-site spec
// records for the tag-binding.
//
// The generic forms — a site with custom wording, an arity refusal,
// a magnitude outside the finite-double domain, a runtime invariant —
// live in `errors.mjs` next to the category roots they declare under.
//
// Lives at the `src/` root because both the core evaluator modules
// and every `runtime/*.mjs` operand impl consume the factories below;
// the `src/` root sits upstream of both layers so the imports flow
// inward consistently.
//
// Principle: **one throw site, one class**. No error class is
// shared across two different operand sites. Each check raises an
// exception whose class name uniquely identifies where it fired,
// so a stack trace or `instanceof` check pinpoints the failure
// without scraping the message string. Every class here extends
// `QlangTypeError`, so `instanceof QlangTypeError` holds and `.kind`
// reads `typeError`, while the concrete class narrows the throw site
// to a single operand + position + condition:
// `FilterSubjectNotContainerError`, `AddLeftNotNumberError`,
// `SortElementsNotComparable`, and so on.

import {
  QlangTypeError,
  brand,
  recordPlaceRefusal,
  recordThrowSiteSpec
} from './errors.mjs';
import { typeKeyword } from './types.mjs';

// expectedType authoring form is one or more qlang type-keyword
// names — `'number'`, `'vec'`, or `['vec', 'set', 'map']`. The
// factory lowers each form to a humanised string ("Number",
// "Vec or Set", "Vec, Set, or Map") for the diagnostic message
// body, and records the structured Keyword form in the same call
// for the bootstrap to stamp onto the tag-binding; consumers reach
// it through `result !| type | spec | /expectedType`.
function lowerExpectedTypeHuman(input) {
  const names = Array.isArray(input) ? input : [input];
  const caps = names.map(name => name.charAt(0).toUpperCase() + name.slice(1));
  if (caps.length === 1) return caps[0];
  if (caps.length === 2) return `${caps[0]} or ${caps[1]}`;
  return caps.slice(0, -1).join(', ') + ', or ' + caps[caps.length - 1];
}

// Per-site identity rides on `this.name`,
// stamped by every factory below from its `className` argument. The
// context bag carries only structured data the throw site wants the
// downstream catch (or the user-facing :trail descriptor) to read —
// no `site` field, because that would duplicate the tag identity
// without adding information.

// declareSubjectError — thrown when an operand receives a subject
// value whose type is not acceptable. `operand` / `position` /
// `expectedType` are per-tag static constants: the recorded spec
// carries them onto the tag-binding, and the `spec` axis returns
// them on demand (`::TagName | spec | /operand`). JS-side context
// carries only dynamic facts.
export function declareSubjectError(className, operand, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  recordThrowSiteSpec(className, 'typeError',
    { operand, position: 'subject', expectedType: expectedTypeInput });
  const Cls = class extends QlangTypeError {
    constructor(actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} requires ${expectedTypeHuman} subject, got ${actualType.name}`,
        { actualType, actualValue }
      );
      this.name = className;
    }
  };
  recordPlaceRefusal(className, Cls);
  return brand(Cls, className);
}

// declareModifierError — thrown when a captured argument has the
// wrong type at a specific numeric position. The recorded spec
// carries `:operand` / `:position` / `:expectedType`; JS context
// carries only `:actualType` / `:actualValue`.
export function declareModifierError(className, operand, position, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  recordThrowSiteSpec(className, 'typeError', { operand, position, expectedType: expectedTypeInput });
  const Cls = class extends QlangTypeError {
    constructor(actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} expects ${expectedTypeHuman} at position ${position}, got ${actualType.name}`,
        { actualType, actualValue }
      );
      this.name = className;
    }
  };
  recordPlaceRefusal(className, Cls);
  return brand(Cls, className);
}

// declareElementError — thrown when a specific element of a
// collection subject has the wrong type. The recorded spec carries
// `:operand` / `:expectedType`; per-instance `:index` stays in JS
// context because it varies per throw.
export function declareElementError(className, operand, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  recordThrowSiteSpec(className, 'typeError', { operand, expectedType: expectedTypeInput });
  const Cls = class extends QlangTypeError {
    constructor(index, actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand}: element ${index} expects ${expectedTypeHuman}, got ${actualType.name}`,
        { index, actualType, actualValue }
      );
      this.name = className;
    }
  };
  return brand(Cls, className);
}

// declareComparabilityError — thrown when a shape-matching check of
// a pair fails. The recorded spec carries `:operand`;
// JS context carries the pairwise dynamic types.
export function declareComparabilityError(className, operand) {
  recordThrowSiteSpec(className, 'typeError', { operand });
  const Cls = class extends QlangTypeError {
    constructor(leftValue, rightValue) {
      const leftType = typeKeyword(leftValue);
      const rightType = typeKeyword(rightValue);
      super(
        `${operand} cannot compare ${leftType.name} with ${rightType.name}`,
        { leftType, rightType }
      );
      this.name = className;
    }
  };
  return brand(Cls, className);
}
