// qlang runtime errors — base hierarchy.
//
// Concrete per-site type-error classes live next to the operand
// that raises them (see runtime/operand-errors.mjs for the
// factory and runtime/*.mjs for the generated classes). Every
// per-site class extends QlangTypeError so `instanceof` and
// `.kind === 'type-error'` still match the broad category.
//
// This file declares the hierarchy roots:
//
//   QlangError                       — abstract root
//     QlangTypeError                 — abstract type-error class
//     UnresolvedIdentifierError      — identifier not in env
//     DivisionByZeroError            — div(_, 0)
//     ArityError                     — too many captured args
//     QlangInvariantError            — registration-time invariant
//
// Source-mapping and observability fields on every QlangError:
//   .location       — qlang source position (set by evalNode wrapper
//                     when the error bubbles past an AST node).
//                     Lets editors squiggle the failing operand and
//                     Sentry breadcrumbs cite the qlang source line.
//   .fingerprint    — stable Sentry group key. Equals the per-site
//                     class name; survives minification because it
//                     is a string literal assigned in the constructor,
//                     not a class identifier the bundler can mangle.
//   .schemaVersion  — integer for forward-compat of the error
//                     contract; bumped when fields are added or
//                     renamed so older Sentry consumers can opt out.
//   .toJSON()       — Sentry-safe serialization. Drops `actualValue`
//                     from .context so user PII never lands in the
//                     observability backend.

const ERROR_SCHEMA_VERSION = 1;

export class QlangError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'QlangError';
    this.kind = kind;
    this.location = null;
    this.fingerprint = null;
    this.schemaVersion = ERROR_SCHEMA_VERSION;
  }

  // toJSON() — Sentry-safe serialization. The Sentry SDK calls
  // JSON.stringify on the error during transport, which invokes
  // this method. `context.actualValue` is dropped so user PII
  // (the actual Vec/Map/scalar that triggered the type-check)
  // never lands in the observability backend.
  toJSON() {
    const safeContext = this.context
      ? Object.fromEntries(
          Object.entries(this.context).filter(([k]) => k !== 'actualValue')
        )
      : null;
    return {
      name: this.name,
      kind: this.kind,
      message: this.message,
      fingerprint: this.fingerprint,
      location: this.location,
      context: safeContext,
      schemaVersion: this.schemaVersion
    };
  }
}

export class QlangTypeError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'type-error');
    this.name = 'QlangTypeError';
    this.context = context;
  }
}

export class UnresolvedIdentifierError extends QlangError {
  constructor(name) {
    super(`unresolved identifier: ${name}`, 'unresolved-identifier');
    this.name = 'UnresolvedIdentifierError';
    this.identifierName = name;
    this.fingerprint = 'UnresolvedIdentifierError';
  }
}

export class DivisionByZeroError extends QlangError {
  constructor() {
    super('division by zero', 'division-by-zero');
    this.name = 'DivisionByZeroError';
    this.fingerprint = 'DivisionByZeroError';
  }
}

export class ArityError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'arity-error');
    this.name = 'ArityError';
    this.context = context;
  }
}

// QlangInvariantError — abstract root for registration-time invariant
// violations raised when a runtime operand is constructed with
// incomplete or malformed metadata. These fire when langRuntime is
// assembled, not in response to user queries; they indicate that a
// runtime-module author forgot to provide a required meta field.
// Per-site subclasses live next to the dispatch helper that enforces
// the invariant (see runtime/dispatch.mjs).
export class QlangInvariantError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'invariant-error');
    this.name = 'QlangInvariantError';
    this.context = context;
  }
}

// EffectLaunderingError — abstract root for the @-prefix effect-marker
// invariant: a `let` binding whose body references an @-prefixed
// identifier (the qlang convention for side-effectful host operands
// like @callers, @refs, @hierarchy) must itself be @-prefixed, so
// the effect propagates through every alias. Two concrete subclasses
// fire from two different points:
//
//   EffectLaunderingAtLetParse — fired by parse-time AST validation
//     in src/effect-check.mjs when the AST scan finds an @-prefixed
//     OperandCall or Projection key inside a non-@-prefixed let body.
//
//   EffectLaunderingAtForce — fired at runtime by eval.mjs::forceThunk
//     when a non-@-prefixed conduit forces and the resolved value
//     turns out to be an @-prefixed function (the laundering path
//     where the function value was extracted via env-projection or
//     installed via use, so the parse-time scan could not see it).
export class EffectLaunderingError extends QlangError {
  constructor(message, context = {}) {
    super(message, 'effect-laundering');
    this.name = 'EffectLaunderingError';
    this.context = context;
  }
}

export class EffectLaunderingAtLetParse extends EffectLaunderingError {
  constructor({ letName, effectfulName, location = null }) {
    super(
      `let '${letName}' has an effectful body (references '${effectfulName}') ` +
      `but its name is not @-prefixed; rename to '@${letName}' or remove the effectful reference`,
      { site: 'EffectLaunderingAtLetParse', letName, effectfulName }
    );
    this.name = 'EffectLaunderingAtLetParse';
    this.fingerprint = 'EffectLaunderingAtLetParse';
    this.location = location;
  }
}

export class EffectLaunderingAtCall extends EffectLaunderingError {
  constructor({ bindingName, effectfulName }) {
    super(
      `identifier '${bindingName}' resolved to effectful function '${effectfulName}' ` +
      `but '${bindingName}' is not @-prefixed; the binding was laundered through env, ` +
      `use, or as — rename to '@${bindingName}' to mark the effect`,
      { site: 'EffectLaunderingAtCall', bindingName, effectfulName }
    );
    this.name = 'EffectLaunderingAtCall';
    this.fingerprint = 'EffectLaunderingAtCall';
  }
}
