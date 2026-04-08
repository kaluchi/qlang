// qlang runtime errors — base hierarchy.
//
// Concrete per-site type-error classes live next to the operand
// that raises them (see runtime/operand-errors.mjs for the
// factory and runtime/*.mjs for the generated classes). Every
// per-site class extends QlangTypeError so `instanceof` and
// `.kind === 'type-error'` still match the broad category.
//
// This file only declares the hierarchy roots:
//
//   QlangError                       — abstract root
//     QlangTypeError                 — abstract type-error class
//     UnresolvedIdentifierError      — identifier not in env
//     DivisionByZeroError            — div(_, 0)
//     ArityError                     — too many captured args

export class QlangError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'QlangError';
    this.kind = kind;
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
  }
}

export class DivisionByZeroError extends QlangError {
  constructor() {
    super('division by zero', 'division-by-zero');
    this.name = 'DivisionByZeroError';
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
