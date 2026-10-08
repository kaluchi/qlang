// Per-site error class factories for the operand slot checks — a
// subject, a captured argument at a numeric position, an element of
// a collection subject, a pair of shapes. Each one spells the
// operand, the slot it guards and the value-class it requires, and
// lowers that triple into both halves of the diagnostic: the
// human wording the message carries and the structured
// `:operand` / `:position` / `:expectedType` the throw-site spec
// records.
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
// exception whose address identifies where it fired, so a reader of
// the error finds the place without scraping the message. Every class
// here extends `QlangTypeError`, so `instanceof QlangTypeError` holds
// and `.kind` reads `typeError`, while the concrete class narrows the
// throw site to one operand, place and condition:
// `number/AddLeftNotNumberError`, `map/KeysSubjectNotMapError`.

import {
  QlangTypeError,
  brand,
  lastNameOf,
  recordPlaceRefusal,
  recordThrowSiteSpec
} from './errors.mjs';
import { typeKeyword } from './types.mjs';

// The kinds a site expects, one or more names, `'number'` or
// `['vec', 'set', 'map']`, written for the message as the tags a reader
// writes, `::vec, ::set or ::map`, and recorded as names.
function lowerExpectedTypeHuman(input) {
  const tags = (Array.isArray(input) ? input : [input]).map(name => `::${name}`);
  return tags.length === 1 ? tags[0] : `${tags.slice(0, -1).join(', ')} or ${tags.at(-1)}`;
}

// The place a position names in a full application: 1 the subject, 2
// the first modifier [D72].
function placeOf(position) {
  return position === 1 ? 'as its subject' : `in modifier ${position - 1}`;
}

// A refusal's identity is its address, which every factory below
// takes [D158]; the context carries only the facts the site wants the
// reader of the error to see.

// declareSubjectError — thrown when an operand receives a subject
// value whose type is not acceptable. `operand` / `position` /
// `expectedType` are the facts of the site, which the registry
// records; JS-side context carries only dynamic facts.
export function declareSubjectError(address, operand, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  recordThrowSiteSpec(address, 'typeError',
    { operand, position: 'subject', expectedType: expectedTypeInput });
  const Cls = class extends QlangTypeError {
    constructor(actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} takes a subject of ${expectedTypeHuman}, got ::${actualType.name}`,
        { actualType, actualValue }
      );
      this.name = lastNameOf(address);
    }
  };
  recordPlaceRefusal(address, Cls);
  return brand(Cls, address);
}

// declareModifierError — thrown when a captured argument has the
// wrong type at a specific numeric position. The recorded spec
// carries `:operand` / `:position` / `:expectedType`; JS context
// carries only `:actualType` / `:actualValue`.
export function declareModifierError(address, operand, position, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  recordThrowSiteSpec(address, 'typeError', { operand, position, expectedType: expectedTypeInput });
  const Cls = class extends QlangTypeError {
    constructor(actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} takes ${expectedTypeHuman} ${placeOf(position)}, got ::${actualType.name}`,
        { actualType, actualValue }
      );
      this.name = lastNameOf(address);
    }
  };
  recordPlaceRefusal(address, Cls);
  return brand(Cls, address);
}

// declareElementError — thrown when a specific element of a
// collection subject has the wrong type. The recorded spec carries
// `:operand` / `:expectedType`; per-instance `:index` stays in JS
// context because it varies per throw.
export function declareElementError(address, operand, expectedTypeInput) {
  const expectedTypeHuman = lowerExpectedTypeHuman(expectedTypeInput);
  recordThrowSiteSpec(address, 'typeError', { operand, expectedType: expectedTypeInput });
  const Cls = class extends QlangTypeError {
    constructor(index, actualValue) {
      const actualType = typeKeyword(actualValue);
      super(
        `${operand} takes elements of ${expectedTypeHuman}, and element ${index} is ::${actualType.name}`,
        { index, actualType, actualValue }
      );
      this.name = lastNameOf(address);
    }
  };
  return brand(Cls, address);
}

// declareComparabilityError — thrown when a shape-matching check of
// a pair fails. The recorded spec carries `:operand`;
// JS context carries the pairwise dynamic types.
export function declareComparabilityError(address, operand) {
  recordThrowSiteSpec(address, 'typeError', { operand });
  const Cls = class extends QlangTypeError {
    constructor(leftValue, rightValue) {
      const leftType = typeKeyword(leftValue);
      const rightType = typeKeyword(rightValue);
      super(
        `${operand} cannot compare ::${leftType.name} with ::${rightType.name}`,
        { leftType, rightType }
      );
      this.name = lastNameOf(address);
    }
  };
  return brand(Cls, address);
}
